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

export interface Vitals {
  contact: boolean;
  bpm: number | null;
  spo2: number | null;
  hrv: { rmssdMs: number | null; sdnnMs: number | null };
  stress: { score: number | null; level: StressLevel };
}

export interface TemperatureReading {
  objectC: number | null;
  ambientC: number | null;
  coreEstC?: number | null; // C1
}

export interface MotionReading {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  magG?: number | null; // C1
  state?: MotionState; // C1
  stillSec?: number; // C1
}

export interface GpsReading {
  fix: boolean;
  latitude: number | null;
  longitude: number | null;
  satellites: number;
  speedMps?: number | null; // C3
  headingDeg?: number | null; // C3
}

export interface AnomalyStatus {
  active: boolean;
  severity: Severity;
  /** RTDB drops empty arrays, so this may be missing when there are no anomalies. */
  types?: AnomalyType[];
  since: EpochMs | null;
  latencyUs: number | null;
}

/**
 * devices/{deviceId}/latest
 * Required fields are already written by the current Arduino sketch; optional ones
 * are added as each component lands (see the Status column in docs/database/schema.md).
 */
export interface DeviceLatest {
  deviceId: string;
  online: boolean;
  sosActive: boolean;
  sensors: SensorStatus;
  pulseRaw: { red: number; ir: number };
  temperature: TemperatureReading;
  motion: MotionReading;
  gps: GpsReading;
  /** millis() since boot — NOT a wall-clock time. */
  updatedAtMs?: number;

  fwVersion?: string;
  ts?: EpochMs | null;
  serverTs?: EpochMs;
  uptimeMs?: number;
  vitals?: Vitals; // C1
  anomaly?: AnomalyStatus; // C1
  battery?: { pct: number | null };
  net?: { transport: Transport; rssi: number | null };
}

/** devices/{deviceId}/history/{pushId} */
export interface HistoryPoint {
  ts: EpochMs | null;
  serverTs: EpochMs;
  bpm: number | null;
  spo2: number | null;
  rmssdMs: number | null;
  stressScore: number | null;
  objectC: number | null;
  coreEstC: number | null;
  motionState: MotionState;
  severity: Severity;
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

/** alerts/{alertId} — created by the band, lifecycle owned by C2. */
export interface Alert {
  deviceId: string;
  source: AlertSource;
  types?: AnomalyType[];
  severity: Severity;
  status: AlertStatus;
  createdAt: EpochMs | null;
  serverCreatedAt: EpochMs;
  vitals: {
    bpm: number | null;
    spo2: number | null;
    coreEstC: number | null;
    stressScore: number | null;
  };
  location: LatLng | null;
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
