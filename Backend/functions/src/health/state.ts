/**
 * Per-band processor state, persisted between raw chunks at festnet/processing/{deviceId}.
 * Times are band uptime ms (millis()) unless the name says Epoch.
 * The state is reset whenever the band's active assignment changes, so nothing (beats,
 * baselines, alert timers) leaks from one attendee to the next.
 */
import type { AssignmentStats, ConfidenceLevel, DataQualityFlag, HriStatus } from "../shared/schema";

export interface IbiRecord {
  t: number;
  ibi: number;
  /** The previous interval was also accepted — a valid pair for RMSSD. */
  follows: boolean;
}

export interface TimedValue {
  t: number;
  v: number;
}

export interface ProcessorState {
  version: 2;
  /** Assignment this state belongs to (null = unassigned band). */
  assignmentId: string | null;
  processed: number;
  lastSeq: number | null;
  lastT0UptimeMs: number | null;
  lastDroppedChunks: number | null;

  // PPG / beats
  ppgTailRed: number[];
  ppgTailIr: number[];
  prevContact: boolean;
  lastBeatT: number | null;
  lastIbiAccepted: boolean;
  rejectStreak: number;
  ibis: IbiRecord[];
  /** Rolling (decayed) accepted / total beat-interval counts → beat acceptance ratio. */
  beatAccepted: number;
  beatTotal: number;
  /** Valid-quality BPM values for the rise rule. */
  bpmWindow: TimedValue[];
  spo2: number | null;
  spo2BelowSinceT: number | null;

  // temperature
  surfaceC: number | null;

  // motion
  freefallRunMs: number;
  freefallEndT: number | null;
  impactAtT: number | null;
  stillSinceT: number | null;

  // personal baseline (quality-controlled, low-activity windows only)
  baselineQualifiedSec: number;
  baselineBpmSum: number;
  baselineBpmN: number;
  baselineRmssdSum: number;
  baselineRmssdN: number;
  baselineSurfaceSum: number;
  baselineSurfaceN: number;
  baselineReady: boolean;

  // HRI alerting
  hriHighStreak: number;
  lastHriAlertEpoch: number | null;

  // outputs
  lastHistoryT: number | null;
  stats: Omit<AssignmentStats, "assignmentId" | "eventId">;
}

const emptyStatusCounts = (): Record<HriStatus, number> => ({ insufficient_data: 0, low: 0, elevated: 0, high: 0 });
const emptyConfidenceCounts = (): Record<ConfidenceLevel, number> => ({ none: 0, low: 0, medium: 0, high: 0 });

export function initialState(assignmentId: string | null = null): ProcessorState {
  return {
    version: 2,
    assignmentId,
    processed: 0,
    lastSeq: null,
    lastT0UptimeMs: null,
    lastDroppedChunks: null,
    ppgTailRed: [],
    ppgTailIr: [],
    prevContact: false,
    lastBeatT: null,
    lastIbiAccepted: false,
    rejectStreak: 0,
    ibis: [],
    beatAccepted: 0,
    beatTotal: 0,
    bpmWindow: [],
    spo2: null,
    spo2BelowSinceT: null,
    surfaceC: null,
    freefallRunMs: 0,
    freefallEndT: null,
    impactAtT: null,
    stillSinceT: null,
    baselineQualifiedSec: 0,
    baselineBpmSum: 0,
    baselineBpmN: 0,
    baselineRmssdSum: 0,
    baselineRmssdN: 0,
    baselineSurfaceSum: 0,
    baselineSurfaceN: 0,
    baselineReady: false,
    hriHighStreak: 0,
    lastHriAlertEpoch: null,
    lastHistoryT: null,
    stats: {
      chunks: 0,
      wornChunks: 0,
      validHrChunks: 0,
      hriScoredChunks: 0,
      hriStatusCounts: emptyStatusCounts(),
      confidenceCounts: emptyConfidenceCounts(),
      flagCounts: {} as Partial<Record<DataQualityFlag, number>>,
      hriAlerts: 0,
      firstAt: null,
      lastAt: null,
    },
  };
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined) as T[];
  if (value && typeof value === "object") return Object.values(value) as T[];
  return [];
}

/**
 * Restores a state read back from RTDB. RTDB drops nulls/empty arrays and may return arrays
 * as objects, so every field is re-filled from the defaults. Unknown versions start fresh.
 */
export function normalizeState(raw: unknown): ProcessorState {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Record<keyof ProcessorState, unknown>>;
  if (r.version !== 2) return base;

  const merged = { ...base, ...(r as Partial<ProcessorState>) } as ProcessorState;
  merged.assignmentId = typeof r.assignmentId === "string" ? r.assignmentId : null;
  merged.ppgTailRed = asArray<number>(r.ppgTailRed);
  merged.ppgTailIr = asArray<number>(r.ppgTailIr);
  merged.ibis = asArray<IbiRecord>(r.ibis);
  merged.bpmWindow = asArray<TimedValue>(r.bpmWindow);
  const stats = (r.stats ?? {}) as Partial<ProcessorState["stats"]>;
  merged.stats = {
    ...base.stats,
    ...stats,
    hriStatusCounts: { ...emptyStatusCounts(), ...(stats.hriStatusCounts ?? {}) },
    confidenceCounts: { ...emptyConfidenceCounts(), ...(stats.confidenceCounts ?? {}) },
    flagCounts: { ...(stats.flagCounts ?? {}) },
  };
  for (const key of Object.keys(base) as (keyof ProcessorState)[]) {
    if (merged[key] === undefined) (merged as unknown as Record<string, unknown>)[key] = base[key];
  }
  return merged;
}
