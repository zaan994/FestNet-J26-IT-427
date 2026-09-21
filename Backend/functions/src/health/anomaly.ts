/**
 * C1 — multi-signal anomaly detection (TAF section 7).
 *
 * Rules (each requires the band to be worn):
 *   bpm_spike  BPM rose more than `bpmSpikeDelta` (30) above the minimum of the last 90 s
 *   low_spo2   SpO2 below `spo2Low` (94 %) for 10 s
 *   high_temp  estimated core temperature above `coreTempHighC` (38 °C) for 5 s
 *   stillness  no movement for `stillnessTimeoutSec` (30 s)
 *   fall       free-fall + impact, active until movement resumes (worn within the last 10 s)
 *
 * Severity (correlation of signals):
 *   1 active type = warning, 2 = danger, 3+ = critical
 *   a fall is at least danger; fall + stillness = critical; SpO2 below 90 % for 10 s = critical
 * Hysteresis: a type clears only after its condition has been gone for `anomalyClearHoldMs`.
 */
import { SEVERITY_ORDER, type AnomalyType, type Severity, type Thresholds } from "../shared";
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import type { ProcessorState } from "./state";

export interface AnomalyInputs {
  t: number;
  worn: boolean;
  recentlyWorn: boolean;
  bpm: number | null;
  spo2: number | null;
  coreTempC: number | null;
  stillSec: number;
  fallActive: boolean;
}

export interface AnomalyResult {
  types: AnomalyType[];
  severity: Severity;
}

const RULE_TYPES: AnomalyType[] = ["bpm_spike", "low_spo2", "high_temp", "stillness", "fall"];

/** Tracks how long a condition has held; returns the new "since" time (null = not holding). */
function sustain(holding: boolean, since: number | null, t: number): number | null {
  return holding ? (since ?? t) : null;
}

export function evaluateAnomalies(
  state: ProcessorState,
  inputs: AnomalyInputs,
  thresholds: Thresholds,
  cfg: HealthConfig = HEALTH_CONFIG,
): AnomalyResult {
  const { t, worn } = inputs;
  const raw = new Set<AnomalyType>();

  // BPM spike: compare with the lowest BPM in the 90-s window.
  if (worn && inputs.bpm !== null && state.bpmWindow.length >= 5) {
    const windowStart = t - thresholds.bpmSpikeWindowSec * 1000;
    const values = state.bpmWindow.filter((p) => p.t >= windowStart).map((p) => p.v);
    if (values.length && inputs.bpm - Math.min(...values) > thresholds.bpmSpikeDelta) raw.add("bpm_spike");
  }

  // SpO2, sustained.
  state.lowSpo2SinceT = sustain(worn && inputs.spo2 !== null && inputs.spo2 < thresholds.spo2Low, state.lowSpo2SinceT, t);
  state.critSpo2SinceT = sustain(
    worn && inputs.spo2 !== null && inputs.spo2 < thresholds.spo2Critical,
    state.critSpo2SinceT,
    t,
  );
  if (state.lowSpo2SinceT !== null && t - state.lowSpo2SinceT >= cfg.spo2SustainMs) raw.add("low_spo2");
  const criticalSpo2 = state.critSpo2SinceT !== null && t - state.critSpo2SinceT >= cfg.spo2SustainMs;

  // Core temperature, sustained.
  state.highTempSinceT = sustain(
    worn && inputs.coreTempC !== null && inputs.coreTempC > thresholds.coreTempHighC,
    state.highTempSinceT,
    t,
  );
  if (state.highTempSinceT !== null && t - state.highTempSinceT >= cfg.tempSustainMs) raw.add("high_temp");

  if (worn && inputs.stillSec >= thresholds.stillnessTimeoutSec) raw.add("stillness");
  if (inputs.fallActive && inputs.recentlyWorn) raw.add("fall");

  // Hysteresis.
  const active: AnomalyType[] = [];
  for (const type of RULE_TYPES) {
    if (raw.has(type)) state.lastTrueT[type] = t;
    const lastTrue = state.lastTrueT[type];
    const wasActive = state.activeTypes.includes(type);
    if (raw.has(type) || (wasActive && lastTrue !== undefined && t - lastTrue < cfg.anomalyClearHoldMs)) {
      active.push(type);
    }
  }
  state.activeTypes = active;

  // Severity from the combination of signals.
  let severity: Severity = active.length === 0 ? "none" : active.length === 1 ? "warning" : active.length === 2 ? "danger" : "critical";
  const atLeast = (s: Severity) => {
    if (SEVERITY_ORDER[s] > SEVERITY_ORDER[severity]) severity = s;
  };
  if (active.includes("fall")) atLeast("danger");
  if (active.includes("fall") && active.includes("stillness")) atLeast("critical");
  if (criticalSpo2) atLeast("critical");

  return { types: active, severity };
}
