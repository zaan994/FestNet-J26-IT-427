/**
 * Safe parsing of devices/{id}/latest (firmware v0.3.x) for every reader.
 *
 * Rules:
 *  - Missing, wrong-typed, NaN/Infinity or out-of-range values become null — never 0.
 *  - Raw optical counts stay raw counts; nothing here derives BPM or SpO2.
 *  - MLX90614 objectC is reported as a SURFACE temperature.
 *  - "online: true" is not freshness: use the time the reading was received.
 *  - "sensor detected" (sensors.*) is not "measurement valid".
 */
import type { LatLng } from "./schema";

const MIN_VALID_EPOCH_MS = 1_700_000_000_000; // Nov 2023 — earlier = device clock not synced
const MAX_FUTURE_SKEW_MS = 24 * 3_600_000;

export interface ParsedLatest {
  deviceId: string | null;
  fwVersion: string | null;
  /** Device clock time (null if missing / not NTP-synced / implausible). */
  deviceTs: number | null;
  serverTs: number | null;
  uptimeMs: number | null;
  clockSynced: boolean;
  sosActive: boolean;
  sosPressCount: number | null;
  /** Sensor DETECTED at boot (true/false) or unknown (null). Detection ≠ valid measurement. */
  sensors: { ppg: boolean | null; imu: boolean | null; temperature: boolean | null; oled: boolean | null; gpsFix: boolean | null };
  /** Raw MAX30102 ADC counts. Not a heart rate, not SpO2. */
  pulseRaw: { red: number | null; ir: number | null };
  temperature: { surfaceC: number | null; ambientC: number | null };
  motion: { ax: number | null; ay: number | null; az: number | null; gx: number | null; gy: number | null; gz: number | null };
  gps: {
    fix: boolean;
    /** Only set when fix is true and the coordinates are plausible. */
    location: LatLng | null;
    satellites: number | null;
    hdop: number | null;
    speedMps: number | null;
    headingDeg: number | null;
    altitudeM: number | null;
  };
  /** Battery is not measured by the current hardware: null = unavailable. */
  batteryPct: number | null;
  net: { transport: string | null; rssi: number | null };
  raw: {
    enabled: boolean | null;
    lastSeq: number | null;
    pendingChunks: number | null;
    droppedChunks: number | null;
    ppgOverflowTotal: number | null;
    lastChunkPpgSamples: number | null;
    lastChunkImuSamples: number | null;
    lastChunkDurationMs: number | null;
    /** received / expected samples in the last chunk (0..1+), null if unknown. */
    ppgCompleteness: number | null;
    imuCompleteness: number | null;
  };
  /** Human-readable parse problems (for data-quality panels / logs). */
  issues: string[];
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Finite number within [min, max], otherwise null. */
export function num(value: unknown, min = -Infinity, max = Infinity): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Epoch ms that is plausible (after Nov 2023, not more than a day in the future). */
export function validEpoch(value: unknown, now = Date.now()): number | null {
  const n = num(value);
  return n !== null && n >= MIN_VALID_EPOCH_MS && n <= now + MAX_FUTURE_SKEW_MS ? n : null;
}

export function parseLatest(value: unknown, now = Date.now()): ParsedLatest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const issues: string[] = [];

  const deviceTs = validEpoch(v.ts, now);
  if (v.ts !== undefined && v.ts !== null && deviceTs === null) issues.push("Device timestamp is invalid.");
  if (deviceTs === null) issues.push("Device clock not synchronised (no NTP time).");

  const sensors = obj(v.sensors);
  const temperature = obj(v.temperature);
  const surfaceC = num(temperature.objectC, -20, 80);
  const ambientC = num(temperature.ambientC, -40, 85);
  if (temperature.objectC !== undefined && temperature.objectC !== null && surfaceC === null) {
    issues.push("Surface temperature outside the plausible range — ignored.");
  }

  const gps = obj(v.gps);
  const fix = gps.fix === true;
  const lat = num(gps.latitude, -90, 90);
  const lng = num(gps.longitude, -180, 180);
  const location = fix && lat !== null && lng !== null && !(lat === 0 && lng === 0) ? { latitude: lat, longitude: lng } : null;
  if (fix && !location) issues.push("GPS reports a fix but coordinates are missing or invalid.");

  const motion = obj(v.motion);
  const pulse = obj(v.pulseRaw);
  const net = obj(v.net);
  const raw = obj(v.raw);
  const battery = obj(v.battery);

  const lastChunkDurationMs = num(raw.lastChunkDurationMs, 0, 60_000);
  const lastChunkPpgSamples = num(raw.lastChunkPpgSamples, 0, 10_000);
  const lastChunkImuSamples = num(raw.lastChunkImuSamples, 0, 10_000);
  const completeness = (samples: number | null, fs: number) =>
    samples !== null && lastChunkDurationMs !== null && lastChunkDurationMs > 0
      ? samples / ((lastChunkDurationMs / 1000) * fs)
      : null;

  return {
    deviceId: str(v.deviceId),
    fwVersion: str(v.fwVersion),
    deviceTs,
    serverTs: validEpoch(v.serverTs, now),
    uptimeMs: num(v.uptimeMs, 0),
    clockSynced: deviceTs !== null,
    sosActive: v.sosActive === true,
    sosPressCount: num(v.sosPressCount, 0),
    sensors: {
      ppg: bool(sensors.max30102),
      imu: bool(sensors.mpu6050),
      temperature: bool(sensors.mlx90614),
      oled: bool(sensors.oled),
      gpsFix: bool(sensors.gps),
    },
    pulseRaw: { red: num(pulse.red, 0, 262_143), ir: num(pulse.ir, 0, 262_143) },
    temperature: { surfaceC, ambientC },
    motion: {
      ax: num(motion.ax),
      ay: num(motion.ay),
      az: num(motion.az),
      gx: num(motion.gx),
      gy: num(motion.gy),
      gz: num(motion.gz),
    },
    gps: {
      fix,
      location,
      satellites: num(gps.satellites, 0, 64),
      hdop: num(gps.hdop, 0),
      speedMps: fix ? num(gps.speedMps, 0, 100) : null,
      headingDeg: fix ? num(gps.headingDeg, 0, 360) : null,
      altitudeM: fix ? num(gps.altitudeM, -500, 9000) : null,
    },
    batteryPct: num(battery.pct, 0, 100),
    net: { transport: str(net.transport), rssi: num(net.rssi, -127, 0) },
    raw: {
      enabled: bool(raw.enabled),
      lastSeq: num(raw.lastSeq, 0),
      pendingChunks: num(raw.pendingChunks, 0),
      droppedChunks: num(raw.droppedChunks, 0),
      ppgOverflowTotal: num(raw.ppgOverflowTotal, 0),
      lastChunkPpgSamples,
      lastChunkImuSamples,
      lastChunkDurationMs,
      ppgCompleteness: completeness(lastChunkPpgSamples, 100),
      imuCompleteness: completeness(lastChunkImuSamples, 50),
    },
    issues,
  };
}

export type Freshness = "live" | "stale" | "offline" | "unknown";

/**
 * Freshness from the time a reading was RECEIVED (client receive time or server time),
 * never from the `online` flag.
 *   live    — age < staleAfterSec
 *   stale   — age < offlineFactor × staleAfterSec
 *   offline — older
 *   unknown — no timestamp
 */
export function freshness(receivedAt: number | null | undefined, now: number, staleAfterSec: number, offlineFactor = 8): Freshness {
  if (receivedAt === null || receivedAt === undefined || !Number.isFinite(receivedAt)) return "unknown";
  const ageSec = (now - receivedAt) / 1000;
  if (ageSec < staleAfterSec) return "live";
  if (ageSec < staleAfterSec * offlineFactor) return "stale";
  return "offline";
}

/** GPS location is usable only with a fix AND a recent reading. */
export function gpsFreshness(
  parsed: ParsedLatest | null,
  receivedAt: number | null | undefined,
  now: number,
  gpsStaleAfterSec: number,
): "fresh" | "stale" | "no_fix" | "unknown" {
  if (!parsed) return "unknown";
  if (!parsed.gps.location) return "no_fix";
  if (receivedAt === null || receivedAt === undefined) return "unknown";
  return (now - receivedAt) / 1000 < gpsStaleAfterSec ? "fresh" : "stale";
}
