/**
 * HRI (Health Risk Indicator) configuration — EXPERIMENTAL / UNVALIDATED.
 *
 * Every number below is a research placeholder. Values marked `source: "TAF"` come from the
 * project's Topic Assessment Form proposal (J26-IT-427); all others are engineering defaults
 * chosen only so the pipeline runs. NONE are clinically validated thresholds or weights.
 * They must be reviewed by the research team / supervisors and tuned with the evaluation
 * protocol in docs/research/c1-health-monitoring.md before any claim is made.
 *
 * Runtime overrides: config/hri (merged over these defaults by the backend).
 */
import type { DataQualityFlag } from "./schema";

export interface HriRuleConfig {
  enabled: boolean;
  /** Points added to the score when the rule fires. */
  points: number;
  threshold: number;
  /** Secondary parameter (window, minimum duration ...), rule-specific. */
  param?: number;
  source: "TAF" | "engineering-default";
  description: string;
}

export interface HriConfig {
  version: string;
  experimental: true;
  validated: false;
  rules: {
    hrRiseAtLowActivity: HriRuleConfig;
    hrElevatedVsBaseline: HriRuleConfig;
    hrvReducedVsBaseline: HriRuleConfig;
    surfaceTempRise: HriRuleConfig;
    highAmbientTemp: HriRuleConfig;
    prolongedImmobility: HriRuleConfig;
    impactThenImmobility: HriRuleConfig;
    lowSpo2: HriRuleConfig;
  };
  /** Score cut-offs for the status category (only when confidence ≥ minConfidenceForStatus). */
  statusCutoffs: { elevated: number; high: number };
  /** Below this confidence value the status is "insufficient_data" and the score is null. */
  minConfidenceForScore: number;
  minConfidenceForStatus: number;
  baseline: {
    /** Seconds of high-quality, low-activity data needed before a personal baseline exists. */
    minQualifiedSeconds: number;
  };
  /**
   * Confidence multiplier applied for each active data-quality flag (1 = no effect, 0 = no confidence).
   * Confidence is reported separately from the score so a low-quality score never looks trustworthy.
   */
  confidencePenalties: Record<DataQualityFlag, number>;
  spo2: {
    /** SpO2 uses an uncalibrated ratio-of-ratios curve. Keep false until validated. */
    useInHri: boolean;
    displayEnabled: boolean;
  };
  alerts: {
    enabled: boolean;
    /** HRI status must be "high" with confidence ≥ this level for N consecutive chunks. */
    minConfidence: "medium" | "high";
    consecutiveChunks: number;
    /** No new automated alert for the same assignment within this time. */
    cooldownSec: number;
  };
}

export const DEFAULT_HRI_CONFIG: HriConfig = {
  version: "hri-config-0.1-experimental",
  experimental: true,
  validated: false,
  rules: {
    hrRiseAtLowActivity: {
      enabled: true,
      points: 30,
      threshold: 30,
      param: 90,
      source: "TAF",
      description: "Heart rate rose by more than {threshold} bpm within {param} s while activity was rest/light.",
    },
    hrElevatedVsBaseline: {
      enabled: true,
      points: 20,
      threshold: 25,
      source: "engineering-default",
      description: "Heart rate is more than {threshold} bpm above the personal resting baseline at rest/light activity.",
    },
    hrvReducedVsBaseline: {
      enabled: true,
      points: 15,
      threshold: 0.6,
      source: "engineering-default",
      description: "RMSSD fell below {threshold}× the personal baseline (valid beat intervals only).",
    },
    surfaceTempRise: {
      enabled: true,
      points: 20,
      threshold: 1.5,
      source: "engineering-default",
      description: "Band surface/object temperature is more than {threshold} °C above its personal baseline (surface, not core).",
    },
    highAmbientTemp: {
      enabled: true,
      points: 10,
      threshold: 35,
      source: "engineering-default",
      description: "Ambient temperature near the band is above {threshold} °C (context only).",
    },
    prolongedImmobility: {
      enabled: true,
      points: 15,
      threshold: 30,
      source: "TAF",
      description: "No movement for more than {threshold} s while the band is worn.",
    },
    impactThenImmobility: {
      enabled: true,
      points: 25,
      threshold: 30,
      source: "engineering-default",
      description: "A possible impact (free-fall then >2.5 g) followed by no movement for {threshold} s. Not a fall diagnosis.",
    },
    lowSpo2: {
      enabled: false,
      points: 25,
      threshold: 94,
      param: 10,
      source: "TAF",
      // Disabled: the SpO2 estimate is uncalibrated (research note — see file header).
      description: "SpO2 below {threshold} % for {param} s.",
    },
  },
  statusCutoffs: { elevated: 30, high: 60 },
  minConfidenceForScore: 0.25,
  minConfidenceForStatus: 0.4,
  baseline: { minQualifiedSeconds: 120 },
  confidencePenalties: {
    not_worn: 0,
    sensor_missing_ppg: 0.3,
    sensor_missing_imu: 0.7,
    sensor_missing_temperature: 0.9,
    ppg_samples_low: 0.7,
    imu_samples_low: 0.85,
    ppg_fifo_overflow: 0.8,
    chunk_gap: 0.8,
    dropped_chunks_increased: 0.85,
    low_perfusion: 0.6,
    beat_detection_unstable: 0.6,
    motion_artifact_risk: 0.6,
    clock_not_synced: 0.9,
    delayed_chunk: 0.85,
    ppg_saturation: 0.5,
  },
  spo2: { useInHri: false, displayEnabled: false },
  alerts: { enabled: true, minConfidence: "medium", consecutiveChunks: 3, cooldownSec: 600 },
};

/** Deep-merges a partial runtime override (config/hri) over the defaults. */
export function mergeHriConfig(override: unknown): HriConfig {
  if (!override || typeof override !== "object") return DEFAULT_HRI_CONFIG;
  const o = override as Partial<HriConfig>;
  const rules = { ...DEFAULT_HRI_CONFIG.rules };
  for (const key of Object.keys(rules) as (keyof HriConfig["rules"])[]) {
    const r = (o.rules as Partial<HriConfig["rules"]> | undefined)?.[key];
    if (r && typeof r === "object") rules[key] = { ...rules[key], ...r };
  }
  return {
    ...DEFAULT_HRI_CONFIG,
    version: typeof o.version === "string" ? o.version : DEFAULT_HRI_CONFIG.version,
    rules,
    statusCutoffs: { ...DEFAULT_HRI_CONFIG.statusCutoffs, ...(o.statusCutoffs ?? {}) },
    baseline: { ...DEFAULT_HRI_CONFIG.baseline, ...(o.baseline ?? {}) },
    confidencePenalties: { ...DEFAULT_HRI_CONFIG.confidencePenalties, ...(o.confidencePenalties ?? {}) },
    spo2: { ...DEFAULT_HRI_CONFIG.spo2, ...(o.spo2 ?? {}) },
    alerts: { ...DEFAULT_HRI_CONFIG.alerts, ...(o.alerts ?? {}) },
    minConfidenceForScore: typeof o.minConfidenceForScore === "number" ? o.minConfidenceForScore : DEFAULT_HRI_CONFIG.minConfidenceForScore,
    minConfidenceForStatus: typeof o.minConfidenceForStatus === "number" ? o.minConfidenceForStatus : DEFAULT_HRI_CONFIG.minConfidenceForStatus,
    experimental: true,
    validated: false,
  };
}

/** Human-readable rule description with its parameters filled in. */
export function describeRule(rule: HriRuleConfig): string {
  return rule.description.replace("{threshold}", String(rule.threshold)).replace("{param}", String(rule.param ?? ""));
}

/**
 * User-facing statement. Research status (experimental, not clinically validated — see the header of
 * this file and docs/research/c1-health-monitoring.md) is documented in code and docs, not in the UI.
 */
export const HRI_DISCLAIMER = "The Health Risk Indicator supports staff decisions. It is not a medical diagnosis and does not replace assessment by medical staff.";
