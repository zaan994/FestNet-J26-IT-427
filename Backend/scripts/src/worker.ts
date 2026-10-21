/**
 * FestNet trusted backend — LOCAL WORKER.
 *
 * Runs exactly the same services as the Cloud Functions (Backend/functions/src), on your machine
 * with a service account. Use it when the project is not on the Blaze plan, or for development.
 *
 *   npm run worker                       everything (recommended)
 *   npm run worker device=FESTNET_001    raw-chunk processing for one band only (+ all requests)
 *   npm run worker push=off              C2 alerts stored and shown, but no push notifications sent
 *
 * Handles:
 *   devices/{id}/raw/{chunk}            → C1 health + HRI (+ history, stats, HRI alerts)
 *   devices/{id}/latest/sosPressCount   → band SOS emergencies
 *   commands/{uid}/{id}                 → staff actions (events, devices, assignments, alerts …)
 *   sosRequests/{uid}/{id}              → attendee-app SOS
 *   claimRequests/{uid}/{id}            → attendee claim codes
 *
 * Do NOT run this while the Cloud Functions are deployed — both would act on every request
 * (commands are claimed safely, but raw chunks would be processed twice).
 */
import type { DataSnapshot, Query } from "firebase-admin/database";

import { escalateDue } from "../../functions/src/c2/escalation";
import { FcmSender } from "../../functions/src/c2/sender-fcm";
import { processRawChunk, pruneRaw } from "../../functions/src/health/store";
import { redeemClaim } from "../../functions/src/services/assignments";
import { executeCommand } from "../../functions/src/services/commands";
import type { ServiceContext } from "../../functions/src/services/context";
import { handleAppSos, handleDeviceSos } from "../../functions/src/services/emergencies";
import { paths, type ClaimRequest, type Command, type RawChunk, type SosRequest } from "../../functions/src/shared";
import { parseCli } from "./args";
import { auth, db, messaging, target } from "./firebase";

const { values } = parseCli(["device", "push"] as const);

/** C2 escalation check interval (alerts escalate between timeout and timeout + this). */
const ESCALATION_INTERVAL_MS = 30_000;

const ctx: ServiceContext = {
  db,
  now: () => Date.now(),
  lookupUid: async (email) => {
    try {
      return (await auth.getUserByEmail(email)).uid;
    } catch {
      return null;
    }
  },
  log: (level, message, data) => {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${data ? " " + JSON.stringify(data) : ""}`;
    (level === "error" ? console.error : console.log)(line);
  },
  // C2 push notifications through FCM (Admin SDK). push=off stores alerts without sending pushes.
  sender: values.push === "off" ? undefined : new FcmSender(messaging),
  // C2 alert handling runs in its own per-band queue (never delays C1 health processing).
  defer: (key, task) => enqueue(key, task),
};

const listeners: { query: Query; event: "child_added" | "value"; cb: (s: DataSnapshot) => void }[] = [];
function listen(query: Query, event: "child_added" | "value", cb: (s: DataSnapshot) => void) {
  query.on(event, cb);
  listeners.push({ query, event, cb });
}

/** Serialises work per key (one band's chunks strictly in order). */
const queues = new Map<string, Promise<void>>();
function enqueue(key: string, task: () => Promise<void>) {
  const next = (queues.get(key) ?? Promise.resolve()).then(task).catch((err) => ctx.log("error", `task failed (${key})`, { error: String(err) }));
  queues.set(key, next);
}

const fmt = (v: unknown, unit = "") => (v === null || v === undefined ? "—" : `${v}${unit}`);

// ---------------------------------------------------------------------------
// Per-band: raw chunks + SOS button
// ---------------------------------------------------------------------------
const watchedBands = new Set<string>();
async function watchBand(deviceId: string) {
  if (watchedBands.has(deviceId)) return;
  watchedBands.add(deviceId);

  // Housekeeping only — a failure here must never stop processing.
  try {
    const removed = await pruneRaw(ctx, deviceId);
    if (removed) ctx.log("info", `${deviceId}: removed ${removed} old raw chunks`);
  } catch (err) {
    ctx.log("warn", `${deviceId}: could not prune old raw chunks (deploy the rules: firebase deploy --only database)`, { error: String(err) });
  }

  // Push keys are time-ordered: process chunks that arrive from now on.
  const startKey = db.ref().push().key as string;
  listen(db.ref(paths.deviceRaw(deviceId)).orderByKey().startAt(startKey), "child_added", (snap) => {
    const chunk = snap.val() as RawChunk | null;
    if (!chunk || typeof chunk.seq !== "number" || typeof chunk.t0UptimeMs !== "number") return;
    enqueue(`raw:${deviceId}`, async () => {
      const r = await processRawChunk(ctx, deviceId, chunk);
      if (r.skipped) return void ctx.log("info", `${deviceId} seq=${chunk.seq} skipped (${r.skipped})`);
      const h = r.health!;
      console.log(
        `${deviceId} seq=${h.seq} ${h.assignmentId ?? "unassigned"} worn=${h.worn ? "y" : "n"} ` +
          `hr=${fmt(h.heartRate.bpm)}(${h.heartRate.quality}) rmssd=${fmt(h.hrv.rmssdMs, "ms")} surface=${fmt(h.temperature.surfaceC, "C")} ` +
          `activity=${h.activity.level} HRI=${fmt(h.hri.hriScore)} ${h.hri.status} conf=${h.hri.confidence.level} flags=${h.signal.flags.length}`,
      );
      if (r.hriAlert) console.log(`  >>> automated HRI alert (needs human review): ${r.hriAlert.reasons.join(" | ")}`);
    });
  });

  // SOS button: a change of sosPressCount. Idempotency keys make re-processing on restart safe.
  let last: number | null = null;
  listen(db.ref(`${paths.deviceLatest(deviceId)}/sosPressCount`), "value", (snap) => {
    const count = snap.val();
    if (typeof count !== "number" || count === last) return;
    last = count;
    if (count > 0) enqueue(`sos:${deviceId}`, () => handleDeviceSos(ctx, deviceId, count));
  });
  ctx.log("info", `watching band ${deviceId}`);
}

// ---------------------------------------------------------------------------
// Request queues: commands / sosRequests / claimRequests — every uid
// ---------------------------------------------------------------------------
function watchQueue(root: string, handle: (uid: string, id: string, value: unknown) => Promise<void>) {
  listen(db.ref(root), "child_added", (uidSnap) => {
    const uid = uidSnap.key as string;
    listen(uidSnap.ref, "child_added", (reqSnap) => {
      const id = reqSnap.key as string;
      const value = reqSnap.val();
      if (!value || typeof value !== "object" || (value as { status?: unknown }).status) return;
      enqueue(`${root}:${uid}`, () => handle(uid, id, value));
    });
  });
}

async function main() {
  ctx.log("info", `FestNet worker → ${target}`);
  if (values.device) {
    await watchBand(values.device);
  } else {
    listen(db.ref(paths.deviceIndex()), "child_added", (snap) => {
      if (snap.key) void watchBand(snap.key);
    });
  }
  watchQueue("festnet/commands", (uid, id, v) => executeCommand(ctx, uid, id, v as Command));
  watchQueue("festnet/sosRequests", (uid, id, v) => handleAppSos(ctx, uid, id, v as SosRequest));
  watchQueue("festnet/claimRequests", (uid, id, v) => redeemClaim(ctx, uid, id, (v as ClaimRequest).code));

  // C2: escalation of unacknowledged alerts (same function as the escalateAlerts Cloud Function).
  const escalate = () =>
    escalateDue(ctx)
      .then((ids) => ids.length && ctx.log("info", `escalated ${ids.length} alert(s)`, { ids }))
      .catch((err) => ctx.log("error", "escalation run failed", { error: String(err) }));
  void escalate();
  setInterval(escalate, ESCALATION_INTERVAL_MS);

  ctx.log("info", `Push notifications: ${ctx.sender ? "FCM" : "off"} · escalation check every ${ESCALATION_INTERVAL_MS / 1000} s`);
  ctx.log("info", "Waiting for raw chunks and requests… (Ctrl+C to stop)");
}

// A single failing request or listener must not take the whole backend down.
process.on("unhandledRejection", (err) => ctx.log("error", "unhandled error (worker keeps running)", { error: String(err) }));

process.on("SIGINT", () => {
  for (const { query, event, cb } of listeners) query.off(event, cb);
  console.log("\nStopped.");
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
