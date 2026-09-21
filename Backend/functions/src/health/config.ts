/**
 * C1 algorithm constants (signal-processing details). Clinical / organiser-tunable
 * thresholds live in shared/thresholds.ts (config/thresholds in RTDB).
 */
export const HEALTH_CONFIG = {
  // --- PPG / heart rate ---
  /** Median IR level that means the sensor touches skin. */
  ppgContactIrMin: 50_000,
  /** Moving-average window removed from the PPG to isolate the pulse (s). */
  ppgDetrendWindowSec: 0.75,
  /** Smoothing window applied to the pulse waveform (samples @100 Hz = 50 ms). */
  ppgSmoothSamples: 5,
  /** Peak must exceed this fraction of the 95th percentile of the pulse waveform. */
  ppgPeakThresholdRatio: 0.5,
  /** Beats are accepted with this delay so a peak at a chunk boundary is seen with both neighbours. */
  ppgAcceptDelayMs: 200,
  /** Seconds of PPG kept from the previous chunk (filter continuity + 4-s SpO2 window). */
  ppgTailSec: 2,

  ibiMinMs: 300, // 200 bpm
  ibiMaxMs: 2000, // 30 bpm
  /** Reject an interval more than 30 % away from the median of the last 5 (artefact). */
  ibiMaxDeviation: 0.3,
  ibiMedianCount: 5,
  /** Consecutive rejected intervals before the rhythm history is reset (re-lock). */
  ibiRelockAfter: 4,
  bpmMedianCount: 8,
  bpmMinIbis: 4,
  /** No beat for this long -> BPM unknown. */
  bpmStaleMs: 4000,

  // --- SpO2 (ratio of ratios, uncalibrated empirical curve) ---
  spo2MinRatio: 0.3,
  spo2MaxRatio: 1.6,
  spo2Smoothing: 0.3,

  // --- HRV / stress ---
  hrvWindowMs: 60_000,
  hrvMinIbis: 10,
  /** Personal baseline from the first 2 minutes of valid wear. */
  stressBaselineMs: 120_000,
  stressBaselineMinSamples: 10,
  /** Population reference used until the personal baseline is ready. */
  stressRefRmssdMs: 42,
  stressRefBpm: 75,
  stressSmoothing: 0.3,

  // --- temperature ---
  tempSmoothing: 0.3,

  // --- motion (IMU @ 50 Hz) ---
  fallFreefallG: 0.5,
  fallFreefallMinMs: 60,
  fallImpactG: 2.5,
  fallImpactWindowMs: 1000,
  /** A fall stays active until movement resumes, and for at least this long. */
  fallHoldMs: 10_000,
  /** Per 2-s chunk: below both limits = no movement. */
  stillMaxStdG: 0.02,
  stillMaxGyroDps: 10,
  /** motion.state becomes "still" after this many seconds without movement. */
  stillStateAfterSec: 5,

  // --- anomaly rules ---
  spo2SustainMs: 10_000,
  tempSustainMs: 5_000,
  /** Hysteresis: a condition must be gone this long before its anomaly clears. */
  anomalyClearHoldMs: 6_000,
  /** A fall counts if the band was worn within this time (impact can break skin contact). */
  wornGraceMs: 10_000,

  // --- outputs / housekeeping ---
  historyIntervalMs: 10_000,
  /** Raw chunks are deleted after this age (server time). */
  rawRetentionMs: 5 * 60_000,
  /** Run raw pruning every N processed chunks. */
  rawPruneEvery: 15,
  /** Computed history is deleted after this age (scheduled function). */
  historyRetentionMs: 24 * 3_600_000,
} as const;

export type HealthConfig = typeof HEALTH_CONFIG;
