/**
 * FestNet band simulator — writes exactly what the real band writes (docs/database/schema.md):
 *   devices/{id}/latest  and  devices/{id}/raw/{push}   every 2 s
 * using synthetic PPG / IMU / temperature signals, so the whole pipeline
 * (raw -> C1 processor -> health -> dashboard / app) runs without hardware.
 *
 * The simulator does NOT compute health. Run the processor next to it:
 *   terminal 1:  npm run process          (or deploy the Cloud Function)
 *   terminal 2:  npm run simulate bands=5 scenario=bpm-spike
 *
 * Options: bands=3  scenario=normal  onset=20  prefix=SIM  center=6.9147,79.9729
 *
 * Scenarios (band #1 unless noted, starting `onset` seconds after launch):
 *   normal      everyone healthy
 *   bpm-spike   heart rate ramps 70 -> 115 bpm
 *   heatstroke  skin temperature rises (core > 38 °C) and heart rate climbs
 *   low-spo2    SpO2 drops to 90 %
 *   fall        free-fall + impact, then lying still (critical after 30 s)
 *   sos         SOS button pressed
 *   no-contact  band taken off the wrist
 *   crowd-walk  ALL bands walk east at ~1.8 m/s (for C3)
 */
import { SyntheticBand, DEFAULT_SYNTHETIC_PARAMS, type SyntheticParams } from "../../functions/src/health/synthetic";
import { offsetMeters, paths, type LatLng, type RawChunk } from "../../functions/src/shared";
import { parseCli } from "./args";
import { db, target } from "./firebase";

const SCENARIOS = ["normal", "bpm-spike", "heatstroke", "low-spo2", "fall", "sos", "no-contact", "crowd-walk"] as const;
type Scenario = (typeof SCENARIOS)[number];

const { values } = parseCli(["bands", "scenario", "onset", "prefix", "center"] as const, {
  bands: "3",
  scenario: "normal",
  onset: "20",
  prefix: "SIM",
  center: "6.9147,79.9729",
});

const scenario = values.scenario as Scenario;
if (!SCENARIOS.includes(scenario)) {
  console.error(`scenario must be one of: ${SCENARIOS.join(", ")}`);
  process.exit(1);
}
const bandCount = Math.max(1, Number(values.bands));
const onsetSec = Number(values.onset);
const [centerLat, centerLng] = values.center!.split(",").map(Number);
const center: LatLng = { latitude: centerLat, longitude: centerLng };
const CHUNK_MS = 2000;
const SERVER_TIMESTAMP = { ".sv": "timestamp" };

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

interface SimBand {
  id: string;
  synth: SyntheticBand;
  base: SyntheticParams;
  pos: LatLng;
  headingDeg: number;
  speedMps: number;
  sosPressCount: number;
  sosActive: boolean;
  fallTriggered: boolean;
  bootMs: number;
}

function createBand(index: number): SimBand {
  const bootMs = Date.now();
  return {
    id: `${values.prefix}_${String(index + 1).padStart(3, "0")}`,
    synth: new SyntheticBand(bootMs, index + 1, 0),
    base: {
      ...DEFAULT_SYNTHETIC_PARAMS,
      bpm: rand(66, 84),
      spo2: rand(97, 99),
      skinC: rand(33.6, 34.4),
      ambientC: rand(28.5, 30.5),
    },
    pos: offsetMeters(center, rand(0, 60), rand(0, 360)),
    headingDeg: rand(0, 360),
    speedMps: 0,
    sosPressCount: 0,
    sosActive: false,
    fallTriggered: false,
    bootMs,
  };
}

/** Scenario progress 0..1 over `durationSec` after the onset. */
const ramp = (elapsedSec: number, durationSec: number) => clamp01((elapsedSec - onsetSec) / durationSec);

function paramsFor(band: SimBand, index: number, elapsedSec: number): SyntheticParams {
  const p: SyntheticParams = { ...band.base };
  band.speedMps = rand(0, 0.6);
  band.sosActive = false;
  if (Math.random() < 0.1) band.headingDeg = rand(0, 360);

  if (scenario === "crowd-walk" && elapsedSec >= onsetSec) {
    band.headingDeg = 90 + rand(-10, 10);
    band.speedMps = 1.8 + rand(-0.2, 0.2);
  }
  if (index !== 0 || elapsedSec < onsetSec) return p;

  switch (scenario) {
    case "bpm-spike":
      p.bpm = band.base.bpm + 45 * ramp(elapsedSec, 20);
      break;
    case "heatstroke":
      p.skinC = band.base.skinC + 1.8 * ramp(elapsedSec, 60);
      p.bpm = band.base.bpm + 30 * ramp(elapsedSec, 60);
      break;
    case "low-spo2":
      p.spo2 = band.base.spo2 - 8 * ramp(elapsedSec, 20);
      break;
    case "fall":
      if (!band.fallTriggered) {
        band.synth.triggerFall();
        band.fallTriggered = true;
      }
      p.motion = "still";
      band.speedMps = 0;
      break;
    case "sos":
      if (band.sosPressCount === 0) band.sosPressCount = 1;
      band.sosActive = elapsedSec - onsetSec < 6;
      break;
    case "no-contact":
      p.contact = false;
      break;
  }
  return p;
}

function buildLatest(band: SimBand, chunk: RawChunk, now: number) {
  const imu = chunk.imu!;
  const ppg = chunk.ppg!;
  const last = (xs: number[] | undefined) => (xs && xs.length ? xs[xs.length - 1] : 0);
  return {
    deviceId: band.id,
    fwVersion: "sim-0.3.0",
    online: true,
    ts: now,
    serverTs: SERVER_TIMESTAMP,
    uptimeMs: now - band.bootMs,
    updatedAtMs: now - band.bootMs,
    sosActive: band.sosActive,
    sosPressCount: band.sosPressCount,
    sensors: { oled: true, mlx90614: true, max30102: true, mpu6050: true, gps: true },
    pulseRaw: { red: last(ppg.red), ir: last(ppg.ir) },
    temperature: chunk.temperature,
    motion: {
      ax: last(imu.ax), ay: last(imu.ay), az: last(imu.az),
      gx: last(imu.gx), gy: last(imu.gy), gz: last(imu.gz),
    },
    gps: {
      fix: true,
      latitude: round(band.pos.latitude, 6),
      longitude: round(band.pos.longitude, 6),
      satellites: 8,
      speedMps: round(band.speedMps, 2),
      headingDeg: round(band.headingDeg, 1),
      altitudeM: 12,
      hdop: 1.1,
    },
    net: { transport: "wifi", rssi: Math.round(rand(-75, -50)) },
    raw: { enabled: true, lastSeq: chunk.seq, pendingChunks: 0, droppedChunks: 0, ppgOverflowTotal: 0 },
  };
}

async function main() {
  console.log(`[simulator] target=${target} bands=${bandCount} scenario=${scenario} onset=${onsetSec}s`);
  console.log("Health values appear only while the C1 processor runs (npm run process, or the Cloud Function).");
  const bands = Array.from({ length: bandCount }, (_, i) => createBand(i));
  const startedAt = Date.now();
  let chunksSent = 0;

  await Promise.all(
    bands.flatMap((b) => [
      db.ref(paths.deviceIndexEntry(b.id)).update({ label: `Simulated ${b.id}`, addedAt: b.bootMs }),
      db.ref(paths.deviceMeta(b.id)).update({
        fwVersion: "sim-0.3.0", label: `Simulated ${b.id}`, eventId: "demo-event", lastBootTs: b.bootMs,
        rawPpgFs: 100, rawImuFs: 50, rawChunkMs: CHUNK_MS,
      }),
    ]),
  );

  const tick = async () => {
    const now = Date.now();
    const elapsedSec = (now - startedAt) / 1000;
    await Promise.all(
      bands.map(async (band, i) => {
        const params = paramsFor(band, i, elapsedSec);
        band.pos = offsetMeters(band.pos, (band.speedMps * CHUNK_MS) / 1000, band.headingDeg);
        const chunk = band.synth.nextChunk(params, CHUNK_MS);
        chunk.sosActive = band.sosActive;
        chunk.sosPressCount = band.sosPressCount;
        await Promise.all([
          db.ref(paths.deviceLatest(band.id)).set(buildLatest(band, chunk, now)),
          db.ref(paths.deviceRaw(band.id)).push({ ...chunk, serverTs: SERVER_TIMESTAMP }),
        ]);
      }),
    );
    chunksSent++;
    process.stdout.write(`\r  t=${Math.round(elapsedSec)}s  chunks sent per band: ${chunksSent}   `);
  };

  const timer = setInterval(() => tick().catch((err) => console.error("\n", err)), CHUNK_MS);

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
