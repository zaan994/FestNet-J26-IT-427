/**
 * C1 signal-processing constants (engineering defaults, not clinical thresholds).
 * Clinical/HRI rules are in shared/hriConfig.ts (experimental, configurable at config/hri).
 */
export const HEALTH_CONFIG = {
  // --- expected firmware rates (firmware v0.3.x) ---
  ppgFsHz: 100,
  imuFsHz: 50,
  /** A chunk with fewer than this fraction of expected samples is flagged. */
  minSampleCompleteness: 0.9,

  // --- PPG / heart rate ---
  /** Median IR level that means the sensor touches skin. */
  ppgContactIrMin: 50_000,
  /** 18-bit ADC full scale; samples at/near it are saturated. */
  ppgSaturationLevel: 262_000,
  ppgDetrendWindowSec: 0.75,
  ppgSmoothSamples: 5,
  ppgPeakThresholdRatio: 0.5,
  /** Beats are accepted with this delay so a peak at a chunk boundary is judged with both neighbours. */
  ppgAcceptDelayMs: 200,
  ppgTailSec: 2,
  /** Perfusion index (%) below this = weak pulse signal. */
  minPerfusionIndex: 0.1,

  ibiMinMs: 300, // 200 bpm
  ibiMaxMs: 2000, // 30 bpm
  ibiMaxDeviation: 0.3,
  ibiMedianCount: 5,
  ibiRelockAfter: 4,
  bpmMedianCount: 8,
  bpmMinIbis: 4,
  bpmStaleMs: 4000,
  /** Fraction of accepted beat intervals (rolling) below which beat detection is "unstable". */
  minBeatAcceptance: 0.7,

  // --- SpO2 (ratio of ratios, UNCALIBRATED — never displayed unless config enables it) ---
  spo2MinRatio: 0.3,
  spo2MaxRatio: 1.6,
  spo2Smoothing: 0.3,

  // --- HRV (guards) ---
  hrvWindowMs: 60_000,
  /** Minimum accepted intervals in the window. */
  hrvMinIbis: 10,
  /** Minimum consecutive accepted pairs (successive differences). */
  hrvMinPairs: 8,
  /** The intervals must span at least this long. */
  hrvMinSpanMs: 30_000,

  // --- temperature ---
  tempSmoothing: 0.3,

  // --- motion / activity (per 2-s chunk, magnitude in g) ---
  fallFreefallG: 0.5,
  fallFreefallMinMs: 60,
  fallImpactG: 2.5,
  fallImpactWindowMs: 1000,
  /** Possible-impact state clears once movement resumes after this long. */
  impactHoldMs: 10_000,
  activityRestStdG: 0.02,
  activityRestGyroDps: 10,
  activityLightStdG: 0.08,
  activityModerateStdG: 0.25,
  /** Wearable is "still" when activity is rest; activity.stillSec counts how long. */

  // --- timing / quality ---
  /** Raw chunk received more than this after its end (device clock) = delayed. */
  delayedChunkMs: 10_000,

  // --- outputs / housekeeping ---
  historyIntervalMs: 10_000,
  rawRetentionMs: 5 * 60_000,
  rawPruneEvery: 15,
  /** Per-assignment history retention (scheduled cleanup). Research exports should be taken before. */
  historyRetentionMs: 30 * 24 * 3_600_000,
} as const;

export type HealthConfig = typeof HEALTH_CONFIG;
