/**
 * Per-band processor state, persisted between raw chunks at festnet/processing/{deviceId}.
 * All times are band uptime milliseconds (millis()) unless the name says Epoch.
 */
import type { AnomalyType, Severity } from "../shared";

export interface IbiRecord {
  /** Time of the beat that closed the interval. */
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
  version: 1;
  /** Chunks processed since this state was created. */
  processed: number;
  lastSeq: number | null;
  lastT0UptimeMs: number | null;

  // PPG
  ppgTailRed: number[];
  ppgTailIr: number[];
  prevContact: boolean;
  lastBeatT: number | null;
  lastIbiAccepted: boolean;
  rejectStreak: number;
  ibis: IbiRecord[];
  bpmWindow: TimedValue[];
  spo2: number | null;

  // HRV / stress
  stressScore: number | null;
  baselineStartT: number | null;
  baselineRmssdSum: number;
  baselineBpmSum: number;
  baselineCount: number;
  baselineRmssd: number | null;
  baselineBpm: number | null;

  // temperature
  skinC: number | null;

  // motion
  freefallRunMs: number;
  freefallEndT: number | null;
  fallActive: boolean;
  fallAtT: number | null;
  stillSinceT: number | null;

  // anomaly
  wornLastT: number | null;
  lowSpo2SinceT: number | null;
  critSpo2SinceT: number | null;
  highTempSinceT: number | null;
  lastTrueT: Partial<Record<AnomalyType, number>>;
  activeTypes: AnomalyType[];
  severity: Severity;
  anomalySinceEpoch: number | null;

  // outputs
  lastHistoryT: number | null;
}

export function initialState(): ProcessorState {
  return {
    version: 1,
    processed: 0,
    lastSeq: null,
    lastT0UptimeMs: null,
    ppgTailRed: [],
    ppgTailIr: [],
    prevContact: false,
    lastBeatT: null,
    lastIbiAccepted: false,
    rejectStreak: 0,
    ibis: [],
    bpmWindow: [],
    spo2: null,
    stressScore: null,
    baselineStartT: null,
    baselineRmssdSum: 0,
    baselineBpmSum: 0,
    baselineCount: 0,
    baselineRmssd: null,
    baselineBpm: null,
    skinC: null,
    freefallRunMs: 0,
    freefallEndT: null,
    fallActive: false,
    fallAtT: null,
    stillSinceT: null,
    wornLastT: null,
    lowSpo2SinceT: null,
    critSpo2SinceT: null,
    highTempSinceT: null,
    lastTrueT: {},
    activeTypes: [],
    severity: "none",
    anomalySinceEpoch: null,
    lastHistoryT: null,
  };
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined) as T[];
  if (value && typeof value === "object") return Object.values(value) as T[];
  return [];
}

/**
 * Restores a state read back from RTDB. RTDB drops nulls and empty arrays and may
 * return arrays as objects, so every field is re-filled from the defaults.
 */
export function normalizeState(raw: unknown): ProcessorState {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Record<keyof ProcessorState, unknown>>;
  if (r.version !== 1) return base;

  const merged = { ...base, ...(r as Partial<ProcessorState>) } as ProcessorState;
  merged.ppgTailRed = asArray<number>(r.ppgTailRed);
  merged.ppgTailIr = asArray<number>(r.ppgTailIr);
  merged.ibis = asArray<IbiRecord>(r.ibis);
  merged.bpmWindow = asArray<TimedValue>(r.bpmWindow);
  merged.activeTypes = asArray<AnomalyType>(r.activeTypes);
  merged.lastTrueT = (r.lastTrueT as ProcessorState["lastTrueT"]) ?? {};
  for (const key of Object.keys(base) as (keyof ProcessorState)[]) {
    if (merged[key] === undefined) (merged as unknown as Record<string, unknown>)[key] = base[key];
  }
  return merged;
}
