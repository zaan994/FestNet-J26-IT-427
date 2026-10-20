/**
 * FestNet shared data contract — mirrors docs/database/schema.md.
 *
 * PURE MODULE: no Node / Firebase imports. Imported by:
 *   - Cloud Functions (this package)
 *   - Dashboard (alias `@shared`)
 *   - Backend/scripts (admin CLI, local worker, simulator)
 *
 * RTDB never stores null: a field written as null is absent when read back, so every
 * nullable field is also optional. Readers must treat every field as possibly missing.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Epoch milliseconds (UTC). */
export type EpochMs = number;
/** Firebase server-timestamp placeholder, only used when writing. */
export type ServerTimestamp = { ".sv": "timestamp" };

export type Severity = "none" | "warning" | "danger" | "critical";
export const SEVERITY_ORDER: Record<Severity, number> = { none: 0, warning: 1, danger: 2, critical: 3 };

export type Transport = "wifi" | "espnow";

export interface LatLng {
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Global roles, stored at roles/{uid}/{role} = true (server/admin-script only). */
export type GlobalRole = "deviceAdmin" | "researchAdmin";
/** Per-event roles, stored at eventStaff/{eventId}/{uid} = role (server only). */
export type EventRole = "eventOperator" | "medicalResponder";
/** Any signed-in user without a staff role is an attendee. */
export type AppRole = GlobalRole | EventRole | "attendee";

export const GLOBAL_ROLES: readonly GlobalRole[] = ["deviceAdmin", "researchAdmin"];
export const EVENT_ROLES: readonly EventRole[] = ["eventOperator", "medicalResponder"];

/** Legacy single role from the foundation build (users/{uid}/role). See docs migration notes. */
export type LegacyRole = "participant" | "volunteer" | "medical" | "organiser";

// ---------------------------------------------------------------------------
// Firmware contract (written by the band — Firmware v0.3.x)
// ---------------------------------------------------------------------------

export interface SensorStatus {
  oled?: boolean;
  mlx90614?: boolean;
  max30102?: boolean;
  mpu6050?: boolean;
  /** v0.3.1+: current GPS fix (older firmware: any NMEA seen). */
  gps?: boolean;
}

export interface GpsReading {
  fix: boolean;
  latitude?: number | null;
  longitude?: number | null;
  satellites?: number;
  speedMps?: number | null;
  headingDeg?: number | null;
  altitudeM?: number | null;
  hdop?: number | null;
}

export interface RawUploadStats {
  enabled?: boolean;
  lastSeq?: number;
  pendingChunks?: number;
  droppedChunks?: number;
  ppgOverflowTotal?: number;
  /** v0.3.1+ */
  lastChunkPpgSamples?: number;
  lastChunkImuSamples?: number;
  lastChunkDurationMs?: number;
}

/** devices/{deviceId}/latest — raw telemetry, written by the band every ~2 s. */
export interface DeviceLatest {
  deviceId: string;
  fwVersion?: string;
  /** Always true when written — NOT proof that the band is live (see freshness). */
  online?: boolean;
  /** Device clock (NTP) epoch ms; missing until the band has synced time. */
  ts?: EpochMs | null;
  /** Firebase server receipt time. */
  serverTs?: EpochMs;
  uptimeMs?: number;
  updatedAtMs?: number;
  sosActive?: boolean;
  sosPressCount?: number;
  sensors?: SensorStatus;
  /** Raw optical ADC counts — NEVER a heart rate or SpO2. */
  pulseRaw?: { red?: number; ir?: number };
  /** MLX90614 object (surface) and ambient temperature — NOT core body temperature. */
  temperature?: { objectC?: number | null; ambientC?: number | null };
  motion?: { ax?: number | null; ay?: number | null; az?: number | null; gx?: number | null; gy?: number | null; gz?: number | null };
  gps?: GpsReading;
  battery?: { pct?: number | null };
  net?: { transport?: Transport; rssi?: number | null };
  raw?: RawUploadStats;
}

/** devices/{deviceId}/raw/{pushId} — ~2 s full-rate chunk written by the band. */
export interface RawChunk {
  seq: number;
  t0?: EpochMs | null;
  t0UptimeMs: number;
  durationMs: number;
  serverTs?: EpochMs;
  ppg?: { fs: number; n: number; overflow: number; red?: number[]; ir?: number[] };
  imu?: {
    fs: number;
    n: number;
    ax?: (number | null)[];
    ay?: (number | null)[];
    az?: (number | null)[];
    gx?: (number | null)[];
    gy?: (number | null)[];
    gz?: (number | null)[];
  };
  temperature?: { objectC?: number | null; ambientC?: number | null };
  sosActive?: boolean;
  sosPressCount?: number;
}

/** devices/{deviceId}/meta — written by the band at boot (merged). */
export interface DeviceMeta {
  fwVersion?: string;
  lastBootTs?: EpochMs | null;
  lastBootServerTs?: EpochMs;
  rawPpgFs?: number;
  rawImuFs?: number;
  rawChunkMs?: number;
  label?: string;
}

// ---------------------------------------------------------------------------
// Derived health (written by the backend C1 processor) — devices/{deviceId}/health
// ---------------------------------------------------------------------------

/** Quality grade of a derived metric. `unavailable` means: do not show a number. */
export type MetricQuality = "valid" | "low_quality" | "unavailable";

export type ActivityLevel = "unknown" | "rest" | "light" | "moderate" | "vigorous";

export type DataQualityFlag =
  | "not_worn"
  | "sensor_missing_ppg"
  | "sensor_missing_imu"
  | "sensor_missing_temperature"
  | "ppg_samples_low"
  | "imu_samples_low"
  | "ppg_fifo_overflow"
  | "chunk_gap"
  | "dropped_chunks_increased"
  | "low_perfusion"
  | "beat_detection_unstable"
  | "motion_artifact_risk"
  | "clock_not_synced"
  | "delayed_chunk"
  | "ppg_saturation";

export type HriInput = "heart_rate" | "hrv" | "spo2" | "surface_temperature" | "ambient_temperature" | "activity" | "personal_baseline";

export type HriStatus = "insufficient_data" | "low" | "elevated" | "high";
export type ConfidenceLevel = "none" | "low" | "medium" | "high";

export interface HriFactor {
  ruleId: string;
  label: string;
  points: number;
  value?: number | null;
  threshold?: number | null;
  unit?: string;
  detail: string;
}

/** Structured, explainable HRI output (experimental, unvalidated). */
export interface HriResult {
  /** 0–100 or null when there is not enough valid data. Null never means "low risk". */
  hriScore: number | null;
  status: HriStatus;
  confidence: { level: ConfidenceLevel; value: number };
  calculatedAt: EpochMs;
  window: { fromMs: EpochMs | null; toMs: EpochMs | null; seconds: number };
  availableInputs: HriInput[];
  missingInputs: HriInput[];
  contributingFactors: HriFactor[];
  dataQuality: { flags: DataQualityFlag[]; notes: string[] };
  baselineAvailable: boolean;
  algorithmVersion: string;
  configVersion: string;
  experimental: true;
  validated: false;
}

export interface DeviceHealth {
  deviceId: string;
  /** Active assignment context at processing time (null = unassigned device). */
  assignmentId?: string | null;
  eventId?: string | null;
  participantId?: string | null;
  seq: number;
  /** Device measurement time (end of chunk, device clock). Missing if the band has no NTP time. */
  measuredAt?: EpochMs | null;
  /** Server receipt time of the raw chunk. */
  receivedAt?: EpochMs | null;
  /** Backend computation time. */
  computedAt: EpochMs;
  /** Server time the record was written. */
  updatedAt?: EpochMs;
  worn: boolean;
  heartRate: { bpm?: number | null; quality: MetricQuality; beats: number; method: string };
  spo2: { value?: number | null; quality: MetricQuality; validated: false; displayEnabled: boolean; note: string };
  hrv: { rmssdMs?: number | null; sdnnMs?: number | null; ibiCount: number; windowSec: number; quality: MetricQuality };
  temperature: {
    /** MLX90614 object temperature = skin/band SURFACE temperature, not core temperature. */
    surfaceC?: number | null;
    ambientC?: number | null;
    surfaceBaselineC?: number | null;
  };
  activity: { level: ActivityLevel; magG?: number | null; stillSec: number; impactDetected: boolean };
  signal: {
    perfusionIndex?: number | null;
    ppgSamples: number;
    ppgExpected: number;
    imuSamples: number;
    imuExpected: number;
    ppgOverflow: number;
    flags: DataQualityFlag[];
    clockSynced: boolean;
  };
  hri: HriResult;
  latency: { processingMs?: number | null; endToEndMs?: number | null };
}

/** healthHistory/{assignmentId}/{pushId} — compact snapshot every 10 s while assigned. */
export interface HistoryPoint {
  ts: EpochMs;
  serverTs?: EpochMs;
  deviceId: string;
  eventId: string;
  worn: boolean;
  bpm?: number | null;
  bpmQuality: MetricQuality;
  rmssdMs?: number | null;
  surfaceC?: number | null;
  ambientC?: number | null;
  activity: ActivityLevel;
  hriScore?: number | null;
  hriStatus: HriStatus;
  confidence: ConfidenceLevel;
  flagCount: number;
}

/** assignmentStats/{assignmentId} — running counters for analytics (bounded reads). */
export interface AssignmentStats {
  assignmentId: string;
  eventId: string;
  chunks: number;
  wornChunks: number;
  validHrChunks: number;
  hriScoredChunks: number;
  hriStatusCounts: Record<HriStatus, number>;
  confidenceCounts: Record<ConfidenceLevel, number>;
  flagCounts: Partial<Record<DataQualityFlag, number>>;
  hriAlerts: number;
  firstAt?: EpochMs | null;
  lastAt?: EpochMs | null;
}

// ---------------------------------------------------------------------------
// Events, inventory, participants, assignments
// ---------------------------------------------------------------------------

export type EventStatus = "planned" | "active" | "closed";

export interface Zone {
  name: string;
  type: "gate" | "stage" | "medical" | "help_point" | "water" | "other";
}

/** events/{eventId} — staff-visible event record. */
export interface FestEvent {
  eventId: string;
  name: string;
  status: EventStatus;
  venue?: string;
  startTs?: EpochMs | null;
  endTs?: EpochMs | null;
  /** DEMO ONLY events are separated from production data everywhere in the UI. */
  demo: boolean;
  zones?: Record<string, Zone>;
  createdAt: EpochMs;
  createdBy: string;
}

/** eventsPublic/{eventId} — attendee-visible information (no health data). */
export interface EventPublicInfo {
  name: string;
  status: EventStatus;
  demo: boolean;
  helpPoints?: Record<string, { name: string; description?: string; zone?: string }>;
  safetyInfo?: string[];
  contact?: string;
  privacyContact?: string;
  dataRetention?: string;
}

export type DeviceInventoryStatus = "available" | "assigned" | "maintenance" | "retired";

/** deviceIndex/{deviceId} — device inventory record (kept at the foundation path). */
export interface DeviceRecord {
  label?: string;
  addedAt?: EpochMs;
  inventoryStatus?: DeviceInventoryStatus;
  currentAssignmentId?: string | null;
  currentEventId?: string | null;
  currentParticipantId?: string | null;
  zone?: string | null;
  notes?: string | null;
  demo?: boolean;
  updatedAt?: EpochMs;
}

/** participants/{eventId}/{participantId} — pseudonymous attendee record. No names / phones. */
export interface Participant {
  participantId: string;
  eventId: string;
  createdAt: EpochMs;
  createdBy: string;
  demo: boolean;
  researchConsent: boolean;
  consentRecordedAt?: EpochMs | null;
  /** Firebase uid of the attendee app linked through a claim token (optional). */
  attendeeUid?: string | null;
  /** Server-maintained: the participant's active assignment (prevents double assignment). */
  activeAssignmentId?: string | null;
}

export type AssignmentStatus = "active" | "returned" | "cancelled";

/** assignments/{assignmentId} — one wearable ↔ participant session. */
export interface Assignment {
  assignmentId: string;
  deviceId: string;
  participantId: string;
  eventId: string;
  status: AssignmentStatus;
  startedAt: EpochMs;
  startedBy: string;
  endedAt?: EpochMs | null;
  endedBy?: string | null;
  returnCondition?: "ok" | "maintenance" | null;
  note?: string | null;
  zone?: string | null;
  demo: boolean;
  /** Hash of the current one-time attendee claim code (never the code itself). */
  claimCodeHash?: string | null;
}

/** claimCodes/{sha256} — backend only. */
export interface ClaimCodeRecord {
  assignmentId: string;
  eventId: string;
  expiresAt: EpochMs;
  createdBy: string;
  usedAt?: EpochMs | null;
  usedBy?: string | null;
  revoked?: boolean;
}

/** attendeeLinks/{uid} — server-written after a valid claim token is redeemed. */
export interface AttendeeLink {
  participantId: string;
  eventId: string;
  deviceId: string;
  assignmentId: string;
  linkedAt: EpochMs;
}

// ---------------------------------------------------------------------------
// Emergencies (SOS + automated HRI alerts)
// ---------------------------------------------------------------------------

export type EmergencyType = "sos" | "hri";
export type EmergencySource = "device_button" | "attendee_app" | "hri_engine";
export type EmergencyStatus = "open" | "acknowledged" | "in_progress" | "resolved";
export type EmergencyPriority = "P1" | "P2" | "P3";

/** emergencies/{eventId}/{alertId} */
export interface Emergency {
  alertId: string;
  idempotencyKey: string;
  type: EmergencyType;
  source: EmergencySource;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  eventId: string;
  deviceId?: string | null;
  assignmentId?: string | null;
  participantId?: string | null;
  reasons: string[];
  createdAt: EpochMs;
  /** Device measurement / press time, if known. */
  measuredAt?: EpochMs | null;
  location?: { latitude: number; longitude: number; fixAt: EpochMs; source: "band_gps" } | null;
  hri?: { score: number | null; status: HriStatus; confidence: ConfidenceLevel } | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: EpochMs | null;
  responder?: { uid: string; name: string; assignedAt: EpochMs } | null;
  resolution?: { note: string; by: string; at: EpochMs } | null;
  review?: { label: "true_positive" | "false_positive" | "uncertain"; note?: string; by: string; at: EpochMs } | null;
  /** Automated alerts always require human review. */
  requiresHumanReview: boolean;
  /** For app SOS: the request to mirror status back to (attendee can't read emergencies). */
  origin?: { uid: string; requestId: string } | null;
  /** Number of further presses folded into this open SOS. */
  repeatCount?: number;
  demo: boolean;
  updatedAt: EpochMs;
}

/** Event id used for SOS from devices / accounts without an active assignment. */
export const UNASSIGNED_EVENT = "_unassigned";

/** emergencyAudit/{eventId}/{alertId}/{pushId} */
export interface EmergencyAuditEntry {
  action:
    | "created"
    | "acknowledged"
    | "responder_assigned"
    | "in_progress"
    | "resolved"
    | "reopened"
    | "reviewed"
    | "duplicate_suppressed"
    | "repeat_press";
  by: string;
  at: EpochMs;
  fromStatus?: EmergencyStatus | null;
  toStatus?: EmergencyStatus | null;
  note?: string | null;
}

/** sosRequests/{uid}/{requestId} — SOS raised from the attendee app. */
export interface SosRequest {
  clientCreatedAt: EpochMs;
  createdAt?: EpochMs;
  /** Set by the backend. */
  status?: "received" | "rejected";
  alertId?: string | null;
  eventId?: string | null;
  alertStatus?: EmergencyStatus | null;
  error?: string | null;
  processedAt?: EpochMs | null;
}

/** claimRequests/{uid}/{requestId} — attendee redeems a one-time claim code. */
export interface ClaimRequest {
  code: string;
  createdAt?: EpochMs;
  status?: "linked" | "rejected";
  error?: string | null;
  processedAt?: EpochMs | null;
}

// ---------------------------------------------------------------------------
// Commands (privileged staff actions executed by the trusted backend)
// ---------------------------------------------------------------------------

export type CommandType =
  | "createEvent"
  | "updateEvent"
  | "setEventStaff"
  | "registerDevice"
  | "updateDevice"
  | "createParticipant"
  | "assignDevice"
  | "returnDevice"
  | "cancelAssignment"
  | "issueClaimCode"
  | "acknowledgeAlert"
  | "assignResponder"
  | "markAlertInProgress"
  | "resolveAlert"
  | "reopenAlert"
  | "reviewAlert"
  | "exportResearch"
  | "setGlobalRole";

/** commands/{uid}/{commandId} */
export interface Command<P = Record<string, unknown>> {
  type: CommandType;
  payload: P;
  createdAt?: EpochMs;
  /** Set by the backend. */
  status?: "ok" | "error";
  result?: Record<string, unknown> | null;
  error?: string | null;
  processedAt?: EpochMs | null;
}

/** auditLog/{scope}/{pushId} — scope = eventId or "global". */
export interface AuditEntry {
  action: string;
  by: string;
  at: EpochMs;
  target?: string | null;
  details?: Record<string, string | number | boolean | null> | null;
}

/** users/{uid} — staff profile (no health data). */
export interface UserProfile {
  displayName?: string;
  email?: string;
  createdAt?: EpochMs;
  /** Legacy foundation role, migrated to roles / eventStaff. */
  role?: LegacyRole;
}

/** config/thresholds — legacy/global thresholds still used by the apps. */
export interface Thresholds {
  deviceOfflineAfterSec: number;
  gpsStaleAfterSec: number;
}

export type ExportStatus = "ready" | "error";

/** researchExports/{exportId} — de-identified, consented records only. */
export interface ResearchExport {
  exportId: string;
  eventId: string;
  createdAt: EpochMs;
  createdBy: string;
  status: ExportStatus;
  participantCount: number;
  recordCount: number;
  /** Rows: pseudonymous participant id, relative time, derived metrics only. No GPS, no device ID. */
  rows?: Record<string, ResearchRow>;
}

export interface ResearchRow {
  participant: string;
  tRelSec: number;
  bpm?: number | null;
  bpmQuality: MetricQuality;
  rmssdMs?: number | null;
  surfaceC?: number | null;
  ambientC?: number | null;
  activity: ActivityLevel;
  hriScore?: number | null;
  hriStatus: HriStatus;
  confidence: ConfidenceLevel;
}
