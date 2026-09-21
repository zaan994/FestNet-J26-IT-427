/**
 * C1 health processor — LOCAL runner.
 *
 * Runs exactly the same processing as the `processRawChunk` Cloud Function
 * (Backend/functions/src/health), but on your machine. Use it when the Firebase project is
 * not on the Blaze plan, or while developing the algorithms.
 *
 *   npm run process                          every band in deviceIndex/ (new bands are picked up)
 *   npm run process device=FESTNET_001       one band only
 *
 * Do NOT run this while the Cloud Function is deployed — both would process every chunk.
 * Stop with Ctrl+C.
 */
import type { DataSnapshot, Query } from "firebase-admin/database";

import { processRawChunk, pruneRaw } from "../../functions/src/health";
import { paths, type RawChunk } from "../../functions/src/shared";
import { parseCli } from "./args";
import { db, target } from "./firebase";

const { values } = parseCli(["device"] as const);

const queues = new Map<string, Promise<void>>();
const listeners: { query: Query; callback: (snap: DataSnapshot) => void }[] = [];

function fmt(value: number | null | undefined, unit = "") {
  return value === null || value === undefined ? "—" : `${value}${unit}`;
}

/** Processes chunks of one band strictly in arrival order. */
function enqueue(deviceId: string, chunk: RawChunk) {
  const previous = queues.get(deviceId) ?? Promise.resolve();
  const next = previous
    .then(async () => {
      const result = await processRawChunk(db, deviceId, chunk);
      if (result.skipped) {
        console.log(`${deviceId} seq=${chunk.seq} skipped (${result.skipped})`);
        return;
      }
      const h = result.health!;
      console.log(
        `${deviceId} seq=${h.seq} worn=${h.worn ? "y" : "n"} bpm=${fmt(h.vitals.bpm)} spo2=${fmt(h.vitals.spo2, "%")} ` +
          `rmssd=${fmt(h.vitals.hrv.rmssdMs, "ms")} stress=${fmt(h.vitals.stress.score)} core=${fmt(h.temperature.coreEstC, "C")} ` +
          `motion=${h.motion.state} severity=${h.anomaly.severity}${h.anomaly.types?.length ? ` [${h.anomaly.types.join(",")}]` : ""} ` +
          `latency=${fmt(h.latency.processingMs, "ms")}`,
      );
      if (result.alert) console.log(`  >>> ALERT ${result.alert.severity}: ${result.alert.types.join(", ")}`);
    })
    .catch((err) => console.error(`${deviceId} seq=${chunk.seq} failed:`, err));
  queues.set(deviceId, next);
}

async function watchDevice(deviceId: string) {
  if (queues.has(deviceId)) return;
  queues.set(deviceId, Promise.resolve());

  const removed = await pruneRaw(db, deviceId);
  if (removed) console.log(`${deviceId}: removed ${removed} old raw chunks`);

  // Push keys are time-ordered: only process chunks that arrive from now on.
  const startKey = db.ref().push().key as string;
  const query = db.ref(paths.deviceRaw(deviceId)).orderByKey().startAt(startKey);
  const callback = (snap: DataSnapshot) => {
    const chunk = snap.val() as RawChunk | null;
    if (chunk && typeof chunk.seq === "number") enqueue(deviceId, chunk);
  };
  query.on("child_added", callback);
  listeners.push({ query, callback });
  console.log(`Watching ${deviceId}`);
}

async function main() {
  console.log(`[health-processor] target: ${target}`);
  if (values.device) {
    await watchDevice(values.device);
  } else {
    db.ref(paths.deviceIndex()).on("child_added", (snap) => {
      if (snap.key) void watchDevice(snap.key);
    });
  }
  console.log("Waiting for raw chunks… (Ctrl+C to stop)");
}

process.on("SIGINT", () => {
  for (const { query, callback } of listeners) query.off("child_added", callback);
  db.ref(paths.deviceIndex()).off();
  console.log("\nStopped.");
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
