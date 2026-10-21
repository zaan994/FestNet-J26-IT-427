/** Pure view-model logic for one assigned band (no Firebase imports — unit-tested). */
import type { DeviceHealth, DeviceLive, Freshness, ParsedLatest, Thresholds } from "@/types";
import { freshness, gpsFreshness } from "@shared/telemetry";

/** RTDB drops empty arrays / objects; arrays may also come back as {0:…,1:…}. */
function list<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined) as T[];
  if (v && typeof v === "object") return Object.values(v) as T[];
  return [];
}

/**
 * Restores the empty lists / objects Firebase removed, so the UI can rely on the DeviceHealth shape.
 * Values are never invented: missing numbers stay missing ("Unavailable").
 */
export function normalizeHealth(raw: unknown): DeviceHealth | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Partial<DeviceHealth> & Record<string, unknown>;
  const hri = (h.hri ?? {}) as Partial<DeviceHealth["hri"]>;
  const signal = (h.signal ?? {}) as Partial<DeviceHealth["signal"]>;
  return {
    ...(h as DeviceHealth),
    worn: h.worn === true,
    heartRate: { beats: 0, method: "", ...(h.heartRate ?? {}), quality: h.heartRate?.quality ?? "unavailable" },
    spo2: { validated: false, note: "", ...(h.spo2 ?? {}), quality: h.spo2?.quality ?? "unavailable", displayEnabled: h.spo2?.displayEnabled === true },
    hrv: { ibiCount: 0, windowSec: 0, ...(h.hrv ?? {}), quality: h.hrv?.quality ?? "unavailable" },
    temperature: { ...(h.temperature ?? {}) },
    activity: { stillSec: 0, impactDetected: false, ...(h.activity ?? {}), level: h.activity?.level ?? "unknown" },
    signal: {
      ppgSamples: 0,
      ppgExpected: 0,
      imuSamples: 0,
      imuExpected: 0,
      ppgOverflow: 0,
      clockSynced: false,
      ...signal,
      flags: list(signal.flags),
    },
    latency: { ...(h.latency ?? {}) },
    hri: {
      ...(hri as DeviceHealth["hri"]),
      hriScore: typeof hri.hriScore === "number" ? hri.hriScore : null,
      status: hri.status ?? "insufficient_data",
      confidence: { level: hri.confidence?.level ?? "none", value: hri.confidence?.value ?? 0 },
      window: { fromMs: null, toMs: null, seconds: 0, ...(hri.window ?? {}) },
      availableInputs: list(hri.availableInputs),
      missingInputs: list(hri.missingInputs),
      contributingFactors: list(hri.contributingFactors),
      dataQuality: { flags: list(hri.dataQuality?.flags), notes: list(hri.dataQuality?.notes) },
      baselineAvailable: hri.baselineAvailable === true,
      algorithmVersion: hri.algorithmVersion ?? "unknown",
      configVersion: hri.configVersion ?? "unknown",
      experimental: true,
      validated: false,
    },
  };
}

export interface AssignmentRef {
  assignmentId: string;
  deviceId: string;
  participantId: string;
  status: "active" | "returned" | "cancelled";
  startedAt: number;
  endedAt?: number | null;
}

export interface EventDeviceRow {
  assignment: AssignmentRef;
  deviceId: string;
  participantId: string;
  latest: ParsedLatest | null;
  /** Derived health — only if it belongs to THIS assignment (never a previous wearer's data). */
  health: DeviceHealth | null;
  /** Time the newest telemetry was received (client receive time, else server time). */
  lastSeenAt: number | null;
  freshness: Freshness;
  gps: ReturnType<typeof gpsFreshness>;
  sosActive: boolean;
  error: string | null;
}

export function toDeviceRow(assignment: AssignmentRef, live: DeviceLive | undefined, now: number, t: Thresholds): EventDeviceRow {
  const latest = live?.latest ?? null;
  const rawHealth = live?.health ?? null;
  const health = rawHealth && rawHealth.assignmentId === assignment.assignmentId ? rawHealth : null;
  const lastSeenAt = live?.receivedAt ?? latest?.serverTs ?? null;
  return {
    assignment,
    deviceId: assignment.deviceId,
    participantId: assignment.participantId,
    latest,
    health,
    lastSeenAt,
    freshness: freshness(lastSeenAt, now, t.deviceOfflineAfterSec),
    gps: gpsFreshness(latest, lastSeenAt, now, t.gpsStaleAfterSec),
    // An SOS flag on an offline band is still shown: manual SOS is never hidden by data quality.
    sosActive: latest?.sosActive === true,
    error: live?.error ?? null,
  };
}
