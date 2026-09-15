/**
 * FestNet band simulator — writes the exact firmware payload (docs/database/schema.md)
 * for N virtual bands, so the dashboard / app / functions can be developed without hardware.
 *
 *   npm run simulate                                   3 healthy bands
 *   npm run simulate -- --bands 8 --scenario bpm-spike --onset 20
 *   npm run simulate -- --scenario crowd-walk --bands 10
 *
 * Scenarios (applied to band #1 unless noted, starting `--onset` seconds after launch):
 *   normal | bpm-spike | heatstroke | low-spo2 | fall | sos | crowd-walk (all bands)
 *
 * The simulator also emulates the on-device anomaly detector (C1) with simple threshold
 * rules so alerts flow into alerts/ exactly like a real band.
 */
import { parseArgs } from "node:util";

import { ServerValue } from "firebase-admin/database";

import {
  DEFAULT_THRESHOLDS as T,
  offsetMeters,
  paths,
  SEVERITY_ORDER,
  type AnomalyType,
  type DeviceLatest,
  type LatLng,
  type MotionState,
  type Severity,
  type StressLevel,
} from "../../functions/src/shared";
import { db, target } from "./firebase";

const SCENARIOS = ["normal", "bpm-spike", "heatstroke", "low-spo2", "fall", "sos", "crowd-walk"] as const;
type Scenario = (typeof SCENARIOS)[number];

const { values } = parseArgs({
  options: {
    bands: { type: "string", default: "3" },
    scenario: { type: "string", default: "normal" },
    onset: { type: "string", default: "20" },
    prefix: { type: "string", default: "SIM" },
    interval: { type: "string", default: "2000" },
    history: { type: "string", default: "10000" },
    center: { type: "string", default: "6.9147,79.9729" },
  },
});

const scenario = values.scenario as Scenario;
if (!SCENARIOS.includes(scenario)) {
  console.error(`--scenario must be one of: ${SCENARIOS.join(", ")}`);
  process.exit(1);
}
const bandCount = Math.max(1, Number(values.bands));
const onsetSec = Number(values.onset);
const intervalMs = Number(values.interval);
const historyMs = Number(values.history);
const [centerLat, centerLng] = values.center!.split(",").map(Number);
const center: LatLng = { latitude: centerLat, longitude: centerLng };

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const noise = (amp: number) => rand(-amp, amp);
const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Band {
  id: string;
  baseBpm: number;
  baseSpo2: number;
  baseSkinC: number;
  pos: LatLng;
  headingDeg: number;
  bpmWindow: { t: number; bpm: number }[];
  lowSpo2Since: number | null;
  stillSince: number | null;
  severity: Severity;
  anomalySince: number | null;
  sos: boolean;
  bootMs: number;
}

function createBand(index: number): Band {
  return {
    id: `${values.prefix}_${String(index + 1).padStart(3, "0")}`,
    baseBpm: rand(68, 88),
    baseSpo2: rand(97, 99),
    baseSkinC: rand(33.4, 34.4),
    pos: offsetMeters(center, rand(0, 60), rand(0, 360)),
    headingDeg: rand(0, 360),
    bpmWindow: [],
    lowSpo2Since: null,
    stillSince: null,
    severity: "none",
    anomalySince: null,
    sos: false,
    bootMs: Date.now(),
  };
}

/** Progress 0..1 of the scenario on this band. */
function ramp(elapsedSec: number, durationSec: number) {
  return clamp((elapsedSec - onsetSec) / durationSec, 0, 1);
}

function simulate(band: Band, index: number, now: number, elapsedSec: number) {
  const target = index === 0 || scenario === "crowd-walk";
  let bpm = band.baseBpm + noise(2);
  let spo2 = band.baseSpo2 + noise(0.5);
  let skinC = band.baseSkinC + noise(0.15);
  let speed = rand(0, 0.6); // m/s wandering
  let motionState: MotionState = "active";
  let magG = 1 + noise(0.15);

  if (target) {
    switch (scenario) {
      case "bpm-spike":
        bpm += 45 * ramp(elapsedSec, 30);
        break;
      case "heatstroke":
        skinC += 1.8 * ramp(elapsedSec, 60);
        bpm += 30 * ramp(elapsedSec, 60);
        break;
      case "low-spo2":
        spo2 -= 7 * ramp(elapsedSec, 20);
        break;
      case "fall":
        if (elapsedSec >= onsetSec) {
          motionState = elapsedSec - onsetSec < 3 ? "fall" : "still";
          magG = elapsedSec - onsetSec < 2 ? 3.2 : 1 + noise(0.01);
          speed = 0;
        }
        break;
      case "sos":
        band.sos = elapsedSec >= onsetSec && elapsedSec < onsetSec + 6;
        break;
      case "crowd-walk":
        if (elapsedSec >= onsetSec) {
          band.headingDeg = 90 + noise(10); // everyone heads east
          speed = 1.8 + noise(0.2);
        }
        break;
    }
  }

  band.pos = offsetMeters(band.pos, (speed * intervalMs) / 1000, band.headingDeg);
  if (scenario !== "crowd-walk" && Math.random() < 0.1) band.headingDeg = rand(0, 360);

  // --- emulate C1 on-device anomaly detection ---
  band.bpmWindow.push({ t: now, bpm });
  band.bpmWindow = band.bpmWindow.filter((p) => now - p.t <= T.bpmSpikeWindowSec * 1000);
  const minBpm = Math.min(...band.bpmWindow.map((p) => p.bpm));
  const coreEstC = skinC + 3.5;

  band.lowSpo2Since = spo2 < T.spo2Low ? (band.lowSpo2Since ?? now) : null;
  band.stillSince = motionState === "still" || motionState === "fall" ? (band.stillSince ?? now) : null;
  const stillSec = band.stillSince ? Math.round((now - band.stillSince) / 1000) : 0;

  const types: AnomalyType[] = [];
  if (bpm - minBpm > T.bpmSpikeDelta) types.push("bpm_spike");
  if (band.lowSpo2Since && now - band.lowSpo2Since >= 10_000) types.push("low_spo2");
  if (coreEstC > T.coreTempHighC) types.push("high_temp");
  if (stillSec >= T.stillnessTimeoutSec) types.push("stillness");
  if (motionState === "fall") types.push("fall");

  let severity: Severity = "none";
  if (types.length === 1) severity = "warning";
  if (types.length === 2) severity = "danger";
  if (types.length >= 3 || spo2 < T.spo2Critical || (types.includes("fall") && stillSec > 0)) severity = "critical";
  if (types.length === 0) severity = "none";

  const rmssd = clamp(55 - (bpm - band.baseBpm) * 0.8 + noise(4), 8, 90);
  const stressScore = clamp(Math.round(100 - rmssd * 1.2 + (bpm - band.baseBpm) * 0.5), 0, 100);
  const stressLevel: StressLevel = stressScore < 40 ? "low" : stressScore < 70 ? "medium" : "high";

  return { bpm, spo2, skinC, coreEstC, motionState, magG, stillSec, speed, types, severity, rmssd, stressScore, stressLevel };
}

type Sim = ReturnType<typeof simulate>;

function buildLatest(band: Band, s: Sim, now: number) {
  // Full payload (all components) so dashboards can be built ahead of the firmware.
  const latest: Omit<DeviceLatest, "serverTs"> & { serverTs: object } = {
    deviceId: band.id,
    fwVersion: "sim-0.1.0",
    online: true,
    ts: now,
    serverTs: ServerValue.TIMESTAMP,
    uptimeMs: now - band.bootMs,
    sosActive: band.sos,
    sensors: { oled: true, mlx90614: true, max30102: true, mpu6050: true, gps: true },
    pulseRaw: { red: Math.round(rand(90000, 100000)), ir: Math.round(rand(100000, 115000)) },
    vitals: {
      contact: true,
      bpm: round(s.bpm),
      spo2: round(clamp(s.spo2, 70, 100)),
      hrv: { rmssdMs: round(s.rmssd, 1), sdnnMs: round(s.rmssd * 1.3, 1) },
      stress: { score: s.stressScore, level: s.stressLevel },
    },
    temperature: { objectC: round(s.skinC, 2), ambientC: round(29 + noise(0.3), 2), coreEstC: round(s.coreEstC, 2) },
    motion: {
      ax: round(noise(0.5), 3), ay: round(noise(0.5), 3), az: round(9.8 * s.magG, 3),
      gx: round(noise(5), 2), gy: round(noise(5), 2), gz: round(noise(5), 2),
      magG: round(s.magG, 3), state: s.motionState, stillSec: s.stillSec,
    },
    gps: {
      fix: true,
      latitude: round(band.pos.latitude, 6),
      longitude: round(band.pos.longitude, 6),
      satellites: 8,
      speedMps: round(s.speed, 2),
      headingDeg: round(band.headingDeg, 1),
    },
    anomaly: {
      active: s.severity !== "none",
      severity: s.severity,
      types: s.types,
      since: s.severity !== "none" ? band.anomalySince : null,
      latencyUs: s.severity !== "none" ? Math.round(rand(800, 4000)) : null,
    },
    battery: { pct: null },
    net: { transport: "wifi", rssi: Math.round(rand(-75, -50)) },
  };
  return latest;
}

async function pushAlert(band: Band, s: Sim, source: "anomaly" | "sos", types: AnomalyType[], severity: Severity, now: number) {
  await db.ref(paths.alerts()).push({
    deviceId: band.id,
    source,
    types,
    severity,
    status: "open",
    createdAt: now,
    serverCreatedAt: ServerValue.TIMESTAMP,
    vitals: { bpm: round(s.bpm), spo2: round(s.spo2), coreEstC: round(s.coreEstC, 2), stressScore: s.stressScore },
    location: { latitude: round(band.pos.latitude, 6), longitude: round(band.pos.longitude, 6) },
  });
  console.log(`  ALERT ${band.id} ${source} ${severity} [${types.join(", ")}]`);
}

async function main() {
  console.log(`[simulator] target=${target} bands=${bandCount} scenario=${scenario} onset=${onsetSec}s`);
  const bands = Array.from({ length: bandCount }, (_, i) => createBand(i));
  const startedAt = Date.now();
  let lastHistory = 0;

  await Promise.all(
    bands.flatMap((b) => [
      db.ref(paths.deviceIndexEntry(b.id)).update({ label: `Simulated ${b.id}`, addedAt: b.bootMs }),
      db.ref(paths.deviceMeta(b.id)).update({ fwVersion: "sim-0.1.0", label: `Simulated ${b.id}`, eventId: "demo-event", lastBootTs: b.bootMs }),
    ]),
  );

  const tick = async () => {
    const now = Date.now();
    const elapsedSec = (now - startedAt) / 1000;
    const writeHistory = now - lastHistory >= historyMs;
    if (writeHistory) lastHistory = now;

    await Promise.all(
      bands.map(async (band, i) => {
        const wasSos = band.sos;
        const s = simulate(band, i, now, elapsedSec);

        if (SEVERITY_ORDER[s.severity] > SEVERITY_ORDER[band.severity]) {
          if (band.severity === "none") band.anomalySince = now;
          await pushAlert(band, s, "anomaly", s.types, s.severity, now);
        }
        if (s.severity === "none") band.anomalySince = null;
        band.severity = s.severity;
        if (band.sos && !wasSos) await pushAlert(band, s, "sos", ["sos"], "critical", now);

        const updates: Promise<unknown>[] = [db.ref(paths.deviceLatest(band.id)).set(buildLatest(band, s, now))];
        if (writeHistory) {
          updates.push(
            db.ref(paths.deviceHistory(band.id)).push({
              ts: now,
              serverTs: ServerValue.TIMESTAMP,
              bpm: round(s.bpm),
              spo2: round(s.spo2),
              rmssdMs: round(s.rmssd, 1),
              stressScore: s.stressScore,
              objectC: round(s.skinC, 2),
              coreEstC: round(s.coreEstC, 2),
              motionState: s.motionState,
              severity: s.severity,
            }),
          );
        }
        await Promise.all(updates);
      }),
    );
    process.stdout.write(`\r  t=${Math.round(elapsedSec)}s  ${bands.map((b) => `${b.id}:${b.severity}`).join("  ")}   `);
  };

  const timer = setInterval(() => tick().catch((err) => console.error("\n", err)), intervalMs);

  const shutdown = async () => {
    clearInterval(timer);
    console.log("\n[simulator] stopping — marking bands offline");
    await Promise.all(bands.map((b) => db.ref(`${paths.deviceLatest(b.id)}/online`).set(false)));
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
