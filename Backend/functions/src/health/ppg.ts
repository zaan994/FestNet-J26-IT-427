/**
 * C1 — PPG analysis of one raw chunk (plus the tail of the previous one).
 *
 *   skin contact (median IR)
 *   -> detrend: subtract a 0.75 s moving average (removes DC + breathing / motion drift)
 *   -> invert (blood volume rises at systole => IR counts DIP) so heart beats become peaks
 *   -> 50 ms smoothing
 *   -> adaptive threshold (50 % of the 95th percentile) + local maxima + refractory period
 *   -> beat times (band uptime ms)
 *
 * SpO2: ratio of ratios R = (AC_red / DC_red) / (AC_ir / DC_ir) over the 4-s window,
 * mapped with the widely used empirical MAX3010x curve. Uncalibrated — validate
 * against a reference pulse oximeter before quoting absolute accuracy.
 */
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import { mean, median, movingAverage, percentile, std } from "./signal";

export interface PpgInput {
  /** Previous chunk tail (for filter continuity), oldest first. */
  tailRed: readonly number[];
  tailIr: readonly number[];
  /** Current chunk samples. */
  red: readonly number[];
  ir: readonly number[];
  fs: number;
  /** Band uptime of the first current-chunk sample. */
  t0UptimeMs: number;
  lastBeatT: number | null;
  /** Most recent accepted interval, used to scale the refractory period. */
  lastIbiMs: number | null;
}

export interface PpgAnalysis {
  contact: boolean;
  /** New beats in this chunk (band uptime ms), ascending. */
  beats: number[];
  perfusionIndex: number | null;
  /** SpO2 from this window before smoothing, or null if the signal is unusable. UNCALIBRATED. */
  spo2Raw: number | null;
  /** More than 5 % of samples at ADC full scale (pressure / ambient light) — beats unreliable. */
  saturated: boolean;
}

const NO_CONTACT: PpgAnalysis = { contact: false, beats: [], perfusionIndex: null, spo2Raw: null, saturated: false };

export function analyzePpg(input: PpgInput, cfg: HealthConfig = HEALTH_CONFIG): PpgAnalysis {
  const { red, ir, fs } = input;
  if (ir.length < fs / 2 || red.length !== ir.length) return NO_CONTACT;
  if (median(ir) < cfg.ppgContactIrMin) return NO_CONTACT;
  const saturatedSamples = ir.filter((x) => x >= cfg.ppgSaturationLevel).length + red.filter((x) => x >= cfg.ppgSaturationLevel).length;
  const saturated = saturatedSamples > 0.05 * (ir.length + red.length);
  if (saturated) return { contact: true, beats: [], perfusionIndex: null, spo2Raw: null, saturated: true };

  // Only use the tail if it is also on skin; otherwise the contact step would look like a beat.
  const useTail = input.tailIr.length > 0 && median(input.tailIr) >= cfg.ppgContactIrMin;
  const allIr = useTail ? [...input.tailIr, ...ir] : [...ir];
  const allRed = useTail ? [...input.tailRed, ...red] : [...red];
  const offset = allIr.length - ir.length;
  const dt = 1000 / fs;
  const timeAt = (i: number) => input.t0UptimeMs + (i - offset) * dt;

  const detrendWindow = Math.max(3, Math.round(cfg.ppgDetrendWindowSec * fs));
  const irBase = movingAverage(allIr, detrendWindow);
  const redBase = movingAverage(allRed, detrendWindow);
  const irAc = allIr.map((x, i) => irBase[i] - x); // inverted: systole -> positive
  const redAc = allRed.map((x, i) => redBase[i] - x);
  const pulse = movingAverage(irAc, cfg.ppgSmoothSamples);

  // --- signal quality ---
  const currentAc = irAc.slice(offset);
  const irDc = mean(allIr);
  const perfusionIndex = irDc > 0 ? ((percentile(currentAc, 95) - percentile(currentAc, 5)) / irDc) * 100 : null;

  // --- beat detection ---
  const threshold = cfg.ppgPeakThresholdRatio * percentile(pulse, 95);
  const refractory = Math.max(cfg.ibiMinMs, input.lastIbiMs ? 0.5 * input.lastIbiMs : 0);
  const peaks: { t: number; v: number }[] = [];
  if (threshold > 0) {
    for (let i = 1; i < pulse.length - 1; i++) {
      if (pulse[i] <= threshold || pulse[i] <= pulse[i - 1] || pulse[i] < pulse[i + 1]) continue;
      const candidate = { t: timeAt(i), v: pulse[i] };
      const last = peaks[peaks.length - 1];
      if (last && candidate.t - last.t < refractory) {
        if (candidate.v > last.v) peaks[peaks.length - 1] = candidate; // keep the stronger peak
      } else {
        peaks.push(candidate);
      }
    }
  }

  // Accept beats in [chunk start, chunk end) shifted back by the accept delay, so a peak
  // at the very end of this chunk is decided next time with both neighbours available.
  const windowStart = input.t0UptimeMs - cfg.ppgAcceptDelayMs;
  const windowEnd = input.t0UptimeMs + ir.length * dt - cfg.ppgAcceptDelayMs;
  const beats = peaks
    .map((p) => p.t)
    .filter((t) => t >= windowStart && t < windowEnd)
    .filter((t) => input.lastBeatT === null || t - input.lastBeatT >= refractory);

  // --- SpO2 ---
  let spo2Raw: number | null = null;
  const redDc = mean(allRed);
  const acIrRms = std(irAc);
  const acRedRms = std(redAc);
  if (redDc > 0 && irDc > 0 && acIrRms > 0) {
    const ratio = acRedRms / redDc / (acIrRms / irDc);
    if (ratio >= cfg.spo2MinRatio && ratio <= cfg.spo2MaxRatio) {
      const spo2 = -45.06 * ratio * ratio + 30.354 * ratio + 94.845;
      spo2Raw = Math.min(100, Math.max(70, spo2));
    }
  }

  return { contact: true, beats, perfusionIndex, spo2Raw, saturated: false };
}
