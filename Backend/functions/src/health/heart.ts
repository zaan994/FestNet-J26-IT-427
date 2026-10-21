/**
 * C1 — beat intervals, BPM and HRV with explicit guards.
 * HRV is only computed from ACCEPTED, CONSECUTIVE beat intervals over an adequately sized
 * window — never from a single sample or unfiltered intervals.
 */
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import { mean, median, std } from "./signal";
import type { IbiRecord, ProcessorState } from "./state";

/** Decay applied to the rolling beat acceptance counters per chunk. */
const ACCEPTANCE_DECAY = 0.9;

/** Turns beat times into inter-beat intervals with artefact rejection. Returns this chunk's counts. */
export function registerBeats(
  state: ProcessorState,
  beats: readonly number[],
  cfg: HealthConfig = HEALTH_CONFIG,
): { accepted: number; rejected: number } {
  let accepted = 0;
  let rejected = 0;
  for (const beat of beats) {
    if (state.lastBeatT !== null) {
      const ibi = beat - state.lastBeatT;
      const inRange = ibi >= cfg.ibiMinMs && ibi <= cfg.ibiMaxMs;
      const recent = state.ibis.slice(-cfg.ibiMedianCount).map((r) => r.ibi);
      const ref = median(recent);
      const consistent = recent.length < 3 || Math.abs(ibi - ref) <= cfg.ibiMaxDeviation * ref;
      const ok = inRange && consistent;

      if (ok) {
        state.ibis.push({ t: beat, ibi, follows: state.lastIbiAccepted });
        state.rejectStreak = 0;
        accepted++;
      } else {
        rejected++;
        if (++state.rejectStreak >= cfg.ibiRelockAfter) {
          state.ibis = []; // rhythm changed or locked onto noise: start again
          state.rejectStreak = 0;
        }
      }
      state.lastIbiAccepted = ok;
    }
    state.lastBeatT = beat;
  }

  const newest = state.ibis.length ? state.ibis[state.ibis.length - 1].t : 0;
  state.ibis = state.ibis.filter((r) => newest - r.t <= cfg.hrvWindowMs);
  state.beatAccepted = state.beatAccepted * ACCEPTANCE_DECAY + accepted;
  state.beatTotal = state.beatTotal * ACCEPTANCE_DECAY + accepted + rejected;
  return { accepted, rejected };
}

/** Rolling fraction of accepted intervals, null before enough beats were seen. */
export function beatAcceptance(state: ProcessorState): number | null {
  return state.beatTotal >= 3 ? state.beatAccepted / state.beatTotal : null;
}

export function lastIbiMs(state: ProcessorState): number | null {
  return state.ibis.length ? state.ibis[state.ibis.length - 1].ibi : null;
}

/** BPM from the median of the latest accepted intervals, or null if stale / too few beats. */
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
  pairs: number;
  spanMs: number;
}

/**
 * Time-domain HRV over the last `hrvWindowMs`.
 * Guards: ≥ hrvMinIbis accepted intervals, ≥ hrvMinPairs consecutive accepted pairs,
 * and the intervals must span ≥ hrvMinSpanMs. Otherwise both values are null.
 */
export function computeHrv(ibis: readonly IbiRecord[], nowT: number, cfg: HealthConfig = HEALTH_CONFIG): HrvResult {
  const window = ibis.filter((r) => nowT - r.t <= cfg.hrvWindowMs);
  const spanMs = window.length >= 2 ? window[window.length - 1].t - window[0].t : 0;

  const squaredDiffs: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i].follows) squaredDiffs.push((window[i].ibi - window[i - 1].ibi) ** 2);
  }

  const enough = window.length >= cfg.hrvMinIbis && squaredDiffs.length >= cfg.hrvMinPairs && spanMs >= cfg.hrvMinSpanMs;
  if (!enough) return { rmssdMs: null, sdnnMs: null, count: window.length, pairs: squaredDiffs.length, spanMs };

  const sdnn = std(window.map((r) => r.ibi));
  return {
    rmssdMs: Math.sqrt(mean(squaredDiffs)),
    sdnnMs: Number.isFinite(sdnn) ? sdnn : null,
    count: window.length,
    pairs: squaredDiffs.length,
    spanMs,
  };
}
