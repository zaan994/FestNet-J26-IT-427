/**
 * C1 — beat intervals, BPM, HRV (RMSSD / SDNN) and the stress score.
 * All functions mutate / read the persisted ProcessorState.
 */
import type { StressLevel } from "../shared";
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import { clamp, mean, median, smooth, std } from "./signal";
import type { IbiRecord, ProcessorState } from "./state";

/** Turns beat times into inter-beat intervals with artefact rejection. */
export function registerBeats(state: ProcessorState, beats: readonly number[], cfg: HealthConfig = HEALTH_CONFIG) {
  for (const beat of beats) {
    if (state.lastBeatT !== null) {
      const ibi = beat - state.lastBeatT;
      const inRange = ibi >= cfg.ibiMinMs && ibi <= cfg.ibiMaxMs;
      const recent = state.ibis.slice(-cfg.ibiMedianCount).map((r) => r.ibi);
      const ref = median(recent);
      const consistent = recent.length < 3 || Math.abs(ibi - ref) <= cfg.ibiMaxDeviation * ref;
      const accepted = inRange && consistent;

      if (accepted) {
        state.ibis.push({ t: beat, ibi, follows: state.lastIbiAccepted });
        state.rejectStreak = 0;
      } else if (++state.rejectStreak >= cfg.ibiRelockAfter) {
        // The rhythm changed (or we locked onto noise): start the history again.
        state.ibis = [];
        state.rejectStreak = 0;
      }
      state.lastIbiAccepted = accepted;
    }
    state.lastBeatT = beat;
  }

  const newest = state.ibis.length ? state.ibis[state.ibis.length - 1].t : 0;
  state.ibis = state.ibis.filter((r) => newest - r.t <= cfg.hrvWindowMs);
}

export function lastIbiMs(state: ProcessorState): number | null {
  return state.ibis.length ? state.ibis[state.ibis.length - 1].ibi : null;
}

/** BPM from the median of the latest accepted intervals, or null if stale / not enough beats. */
export function currentBpm(state: ProcessorState, nowT: number, cfg: HealthConfig = HEALTH_CONFIG): number | null {
  if (state.lastBeatT === null || nowT - state.lastBeatT > cfg.bpmStaleMs) return null;
  if (state.ibis.length < cfg.bpmMinIbis) return null;
  const m = median(state.ibis.slice(-cfg.bpmMedianCount).map((r) => r.ibi));
  return Number.isFinite(m) && m > 0 ? 60_000 / m : null;
}

export interface HrvResult {
  rmssdMs: number | null;
  sdnnMs: number | null;
  count: number;
}

/** Time-domain HRV over the last `hrvWindowMs`. RMSSD only uses consecutive accepted pairs. */
export function computeHrv(ibis: readonly IbiRecord[], nowT: number, cfg: HealthConfig = HEALTH_CONFIG): HrvResult {
  const window = ibis.filter((r) => nowT - r.t <= cfg.hrvWindowMs);
  if (window.length < cfg.hrvMinIbis) return { rmssdMs: null, sdnnMs: null, count: window.length };

  const squaredDiffs: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i].follows) squaredDiffs.push((window[i].ibi - window[i - 1].ibi) ** 2);
  }
  const rmssd = squaredDiffs.length >= 2 ? Math.sqrt(mean(squaredDiffs)) : null;
  const sdnn = std(window.map((r) => r.ibi));
  return { rmssdMs: rmssd, sdnnMs: Number.isFinite(sdnn) ? sdnn : null, count: window.length };
}

export interface StressResult {
  score: number | null;
  level: StressLevel;
  baselineReady: boolean;
}

/**
 * Stress score 0–100 (heuristic, for relative trends):
 *   70 % HRV component — RMSSD below the personal baseline raises stress (50 = at baseline)
 *   30 % heart-rate component — BPM above the baseline (+40 bpm = maximum)
 * The baseline is the mean of the first 2 minutes of valid wear; until then a population
 * reference (RMSSD 42 ms, 75 bpm) is used.
 */
export function updateStress(
  state: ProcessorState,
  rmssd: number | null,
  bpm: number | null,
  nowT: number,
  cfg: HealthConfig = HEALTH_CONFIG,
): StressResult {
  const baselineReady = state.baselineRmssd !== null;
  if (rmssd === null || bpm === null) {
    return { score: state.stressScore, level: levelFor(state.stressScore), baselineReady };
  }

  if (!baselineReady) {
    if (state.baselineStartT === null) state.baselineStartT = nowT;
    state.baselineRmssdSum += rmssd;
    state.baselineBpmSum += bpm;
    state.baselineCount++;
    if (nowT - state.baselineStartT >= cfg.stressBaselineMs && state.baselineCount >= cfg.stressBaselineMinSamples) {
      state.baselineRmssd = state.baselineRmssdSum / state.baselineCount;
      state.baselineBpm = state.baselineBpmSum / state.baselineCount;
    }
  }

  const refRmssd = state.baselineRmssd ?? cfg.stressRefRmssdMs;
  const refBpm = state.baselineBpm ?? cfg.stressRefBpm;
  const hrvPart = ((clamp(1 - rmssd / refRmssd, -1, 1) + 1) / 2) * 100;
  const bpmPart = clamp((bpm - refBpm) / 40, 0, 1) * 100;
  const raw = 0.7 * hrvPart + 0.3 * bpmPart;

  state.stressScore = clamp(smooth(state.stressScore, raw, cfg.stressSmoothing), 0, 100);
  return { score: state.stressScore, level: levelFor(state.stressScore), baselineReady: state.baselineRmssd !== null };
}

function levelFor(score: number | null): StressLevel {
  if (score === null) return "unknown";
  if (score < 40) return "low";
  if (score < 65) return "medium";
  return "high";
}
