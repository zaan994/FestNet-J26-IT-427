/**
 * C2 latency measurement against the LIVE pipeline (the worker or the deployed Cloud Functions must
 * be running). Nothing is simulated: each run writes a real SOS request, waits for the backend to
 * create and dispatch the alert, and reads the server-measured timestamps back.
 *
 *   npm run latency                         30 runs, label "worker"
 *   npm run latency runs=10 label=deployed  10 runs against the deployed functions
 *
 * Metric: latencyFromReceiptMs = dispatchedAt − receivedAt (same server clock): from the moment the
 * backend received the trigger until the push send call returned ("accepted by FCM", not delivery).
 * Round-trip is also reported (script write → alert dispatched, script clock).
 * Each test alert goes to the _unassigned bucket, is marked as a latency test and closed afterwards.
 * Results are appended to docs/TEST-RESULTS.md.
 */
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { paths, type Emergency, type SosRequest } from "../../functions/src/shared";
import { parseCli } from "./args";
import { db, target } from "./firebase";

const { values } = parseCli(["runs", "label", "uid", "timeout"] as const);
const RUNS = Math.max(1, Number(values.runs ?? 30));
const LABEL = values.label ?? "worker";
const UID = values.uid ?? "latency-test-client";
const TIMEOUT_MS = Number(values.timeout ?? 20_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs: number): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(100);
  }
  return null;
}

function stats(xs: number[]) {
  if (!xs.length) return { avg: null, p95: null, max: null };
  const s = [...xs].sort((a, b) => a - b);
  const p95 = s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
  return { avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length), p95, max: s[s.length - 1] };
}

async function closeTestAlert(eventId: string, alertId: string) {
  await db.ref().update({
    [`${paths.emergency(eventId, alertId)}/status`]: "resolved",
    [`${paths.emergency(eventId, alertId)}/resolution`]: { note: "Latency test run (automatic close)", by: "latency-test", at: Date.now() },
    [paths.openAlert(alertId)]: null,
    [`${paths.sosRequests(UID)}/_active`]: null,
  });
}

async function main() {
  console.log(`[latency] target=${target} label=${LABEL} runs=${RUNS} — make sure the worker / functions are running.`);
  const receipt: number[] = [];
  const roundTrip: number[] = [];
  let failures = 0;
  let accepted = 0;
  let attempted = 0;

  for (let i = 1; i <= RUNS; i++) {
    await db.ref(`${paths.sosRequests(UID)}/_active`).remove(); // each run must be a new SOS, not a repeat press
    const node = db.ref(paths.sosRequests(UID)).push();
    const sentAt = Date.now();
    await node.set({ clientCreatedAt: sentAt, createdAt: { ".sv": "timestamp" } });

    const req = await waitFor(async () => {
      const v = (await node.get()).val() as SosRequest | null;
      return v?.alertId && v.eventId ? v : null;
    }, TIMEOUT_MS);
    if (!req) {
      failures++;
      console.log(`  run ${i}: no alert within ${TIMEOUT_MS} ms`);
      continue;
    }
    const alert = await waitFor(async () => {
      const a = (await db.ref(paths.emergency(req.eventId!, req.alertId!)).get()).val() as Emergency | null;
      return a?.dispatchedAt ? a : null;
    }, TIMEOUT_MS);
    const doneAt = Date.now();
    if (!alert || alert.latencyFromReceiptMs == null) {
      failures++;
      console.log(`  run ${i}: alert ${req.alertId} not dispatched within ${TIMEOUT_MS} ms`);
    } else {
      receipt.push(alert.latencyFromReceiptMs);
      roundTrip.push(doneAt - sentAt);
      for (const c of Object.values(alert.notified ?? {})) {
        attempted += c?.attempted ?? 0;
        accepted += c?.accepted ?? 0;
      }
      console.log(`  run ${i}: receipt→dispatch ${alert.latencyFromReceiptMs} ms · round trip ${doneAt - sentAt} ms`);
    }
    await closeTestAlert(req.eventId!, req.alertId!);
    await sleep(300);
  }

  const r = stats(receipt);
  const t = stats(roundTrip);
  const file = resolve(__dirname, "../../../docs/TEST-RESULTS.md");
  if (!existsSync(file)) writeFileSync(file, "# FestNet — measured test results\n\nOnly measured values are recorded here (written by scripts).\n");
  appendFileSync(
    file,
    [
      "",
      `## C2 latency — ${new Date().toISOString()} — ${LABEL} (${target})`,
      "",
      `Runs: ${RUNS} · successful: ${receipt.length} · failures: ${failures} · push attempts: ${attempted} · accepted by FCM: ${accepted}`,
      "",
      "| Metric | avg (ms) | p95 (ms) | max (ms) |",
      "|---|---|---|---|",
      `| Server receipt → dispatch returned | ${r.avg ?? "—"} | ${r.p95 ?? "—"} | ${r.max ?? "—"} |`,
      `| Script write → alert dispatched (round trip) | ${t.avg ?? "—"} | ${t.p95 ?? "—"} | ${t.max ?? "—"} |`,
      "",
      "Target: server receipt → push accepted by FCM < 3000 ms. \"Accepted\" is not proof of device delivery.",
      attempted === 0 ? "\nNote: no push was attempted (no registered tokens for the recipients) — the figure covers alert creation and routing only." : "",
      "",
    ].join("\n"),
  );
  console.log(`[latency] receipt→dispatch avg ${r.avg} / p95 ${r.p95} / max ${r.max} ms · failures ${failures} · written to docs/TEST-RESULTS.md`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
