/**
 * FestNet shared data contract — mirrors docs/database/schema.md.
 *
 * PURE MODULE: no Node / Firebase imports. Imported by:
 *   - Cloud Functions (this package)
 *   - Dashboard (alias `@shared`)
 *   - Backend/scripts (admin CLI + band simulator)
 */

export type Role = "participant" | "volunteer" | "medical" | "organiser";
export const STAFF_ROLES: readonly Role[] = ["organiser", "medical"];

export type Severity = "none" | "warning" | "danger" | "critical";
export const SEVERITY_ORDER: Record<Severity, number> = { none: 0, warning: 1, danger: 2, critical: 3 };

export type StressLevel = "unknown" | "low" | "medium" | "high";
export type MotionState = "unknown" | "active" | "still" | "fall";
export type AnomalyType = "bpm_spike" | "low_spo2" | "high_temp" | "stillness" | "fall" | "sos";
export type Transport = "wifi" | "espnow";

/** Epoch milliseconds (UTC). */
export type EpochMs = number;
/** Firebase server-timestamp placeholder, only used when writing. */
export type ServerTimestamp = { ".sv": "timestamp" };

export interface SensorStatus {
  oled: boolean;
  mlx90614: boolean;
  max30102: boolean;
  mpu6050: boolean;
  gps?: boolean;
}

// RTDB never stores null: a field written as null is simply absent when read back,
// so every nullable field below is also optional.

export interface GpsReading {
  fix: boolean;
  latitude?: number | null;
  longitude?: number | null;
  satellites: number;
  speedMps?: number | null; // C3
  headingDeg?: number | null; // C3
  altitudeM?: number | null;
  hdop?: number | null;
}

/**
 * devices/{deviceId}/latest — written by the BAND every 2 s (raw readings only).
 * Firmware: Firmware/festnet_band/festnet_band.ino -> uploadLatest()
 */
export interface DeviceLatest {
  deviceId: string;
  online: boolean;
  fwVersion?: string;
  ts?: EpochMs | null;
  serverTs?: EpochMs;
  uptimeMs?: number;
  /** millis() since boot — NOT a wall-clock time. */
  updatedAtMs?: number;
  sosActive: boolean;
  sosPressCount?: number;
  sensors: SensorStatus;
  pulseRaw: { red: number; ir: number };
  temperature: { objectC?: number | null; ambientC?: number | null };
  motion: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  gps: GpsReading;
  battery?: { pct?: number | null };
  net?: { transport: Transport; rssi?: number | null };
  raw?: {
    enabled: boolean;
    lastSeq: number;
    pendingChunks: number;
    droppedChunks: number;
    ppgOverflowTotal: number;
  };
}

/**
 * devices/{deviceId}/raw/{pushId} — written by the BAND every 2 s.
 * Full-rate signals; the input of the C1 health processor.
 */
export interface RawChunk {
  seq: number;
  /** Epoch ms of the first sample (missing until the band's NTP sync). */
  t0?: EpochMs | null;
  /** Band millis() of the first sample. */
  t0UptimeMs: number;
  durationMs: number;
  serverTs?: EpochMs;
  ppg?: { fs: number; n: number; overflow: number; red?: number[]; ir?: number[] };
  imu?: {
    fs: number;
    n: number;
    ax?: number[];
    ay?: number[];
    az?: number[];
    gx?: number[];
    gy?: number[];
    gz?: number[];
  };
  temperature?: { objectC?: number | null; ambientC?: number | null };
  sosActive?: boolean;
  sosPressCount?: number;
}

/**
 * devices/{deviceId}/health — written by the BACKEND (C1 health processor) per raw chunk.
 * This is what the dashboard and the mobile app display.
 */
export interface DeviceHealth {
  deviceId: string;
  seq: number;
  /** Epoch ms at the end of the analysed chunk. */
  ts: EpochMs;
  /** Server time the health record was written. */
  updatedAt?: EpochMs;
  /** PPG sensor touches skin (band is worn). */
  worn: boolean;
  signal: {
    /** Pulse amplitude relative to the DC level, % — higher = cleaner signal. */
    perfusionIndex?: number | null;
    beatsInChunk: number;
    ppgSamples: number;
    ppgOverflow: number;
  };
  vitals: {
    bpm?: number | null;
    spo2?: number | null;
    hrv: { rmssdMs?: number | null; sdnnMs?: number | null; ibiCount: number };
    stress: { score?: number | null; level: StressLevel; baselineReady: boolean };
  };
  temperature: { skinC?: number | null; ambientC?: number | null; coreEstC?: number | null };
  motion: { magG?: number | null; state: MotionState; stillSec: number };
  anomaly: {
    active: boolean;
    severity: Severity;
    types?: AnomalyType[];
    since?: EpochMs | null;
  };
  latency: {
    /** Server receive time of the raw chunk -> health computed (ms). */
    processingMs?: number | null;
    /** End of the chunk on the band -> health computed (ms); needs NTP on the band. */
    endToEndMs?: number | null;
  };
}

/** devices/{deviceId}/history/{pushId} — written by the BACKEND every 10 s. */
export interface HistoryPoint {
  ts: EpochMs;
  serverTs?: EpochMs;
  bpm?: number | null;
  spo2?: number | null;
  rmssdMs?: number | null;
  stressScore?: number | null;
  skinC?: number | null;
  coreEstC?: number | null;
  motionState: MotionState;
  severity: Severity;
  worn: boolean;
}

/** deviceIndex/{deviceId} */
export interface DeviceIndexEntry {
  label: string;
  addedAt: EpochMs;
}

/** devices/{deviceId}/meta */
export interface DeviceMeta {
  fwVersion?: string;
  lastBootTs?: EpochMs | null;
  ownerUid?: string | null;
  eventId?: string | null;
  label?: string;
}

/** users/{uid} */
export interface UserProfile {
  name: string;
  email: string;
  role: Role;
  deviceId?: string | null;
  fcmToken?: string | null;
  createdAt: EpochMs;
}

export type AlertSource = "anomaly" | "sos" | "manual";
export type AlertStatus = "open" | "acknowledged" | "escalated" | "resolved";

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** alerts/{alertId} — anomaly alerts are created by the C1 health processor; lifecycle owned by C2. */
export interface Alert {
  deviceId: string;
  source: AlertSource;
  types?: AnomalyType[];
  severity: Severity;
  status: AlertStatus;
  createdAt?: EpochMs | null;
  serverCreatedAt: EpochMs;
  vitals: {
    bpm?: number | null;
    spo2?: number | null;
    coreEstC?: number | null;
    stressScore?: number | null;
  };
  location?: LatLng | null;
  ack?: { by: string; at: EpochMs } | null;
  escalation?: { level: number; at: EpochMs } | null;
  dispatch?: Record<string, unknown> | null;
}

/** config/thresholds */
export interface Thresholds {
  bpmSpikeDelta: number;
  bpmSpikeWindowSec: number;
  spo2Low: number;
  spo2Critical: number;
  coreTempHighC: number;
  stillnessTimeoutSec: number;
  alertEscalationSec: number;
  volunteerRadiusM: number;
  surgeSpeedMps: number;
  surgeZoneRadiusM: number;
  surgeMinBands: number;
  deviceOfflineAfterSec: number;
  /** C1: wrist skin temperature + this offset = estimated core temperature. Calibrate per enclosure. */
  skinToCoreOffsetC: number;
}

export type ZoneType = "stage" | "exit" | "first_aid" | "toilet" | "water" | "other";

export interface Zone {
  name: string;
  type: ZoneType;
  polygon: LatLng[];
}

/** events/{eventId} — C3 */
export interface FestEvent {
  name: string;
  startTs: EpochMs;
  endTs: EpochMs;
  center: LatLng;
  zones?: Record<string, Zone>;
}

export type HeatStressTier = "low" | "moderate" | "high" | "critical";
