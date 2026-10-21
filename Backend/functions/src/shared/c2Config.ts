/**
 * C2 — Emergency Alert System configuration.
 *
 * Research note (kept in code, not shown in the UI): every threshold below is a provisional
 * prototype value from the C2 proposal, NOT a clinically validated rule. They must be approved by
 * the supervisors before use with real attendees and are tuned with the evaluation plan in
 * docs/research/c1-health-monitoring.md. Runtime overrides: config/c2 (deviceAdmin only).
 *
 * Fallback rules deliberately use ONLY the backend-validated heart rate (C1 quality = "valid").
 * SpO2 (uncalibrated) and MLX90614 object temperature (surface, not core) are never used.
 */
import type { AlertSeverity, ConfidenceLevel } from "./schema";

export interface C2Config {
  version: string;
  hri: {
    enabled: boolean;
    /** C1 hriScore cut-offs (0–100). */
    warning: number;
    danger: number;
    critical: number;
    /** Ignore HRI results below this C1 confidence level. */
    minConfidence: Exclude<ConfidenceLevel, "none">;
  };
  bpmFallback: {
    /** Used only when no usable HRI exists. */
    enabled: boolean;
    /** Warning only at rest/light activity (exertion is not an anomaly). */
    warningHigh: number;
    /** Danger at rest/light/unknown activity. */
    dangerHigh: number;
    dangerLow: number;
    /** Critical at any activity. */
    criticalHigh: number;
    criticalLow: number;
  };
  /** Consecutive qualifying 2-s results before an anomaly alert (SOS ignores this). */
  consecutiveChunks: number;
  /** Derived health older than this is stale and never alerts. */
  maxHealthAgeSec: number;
  /** Same-or-lower severity anomalies are suppressed this long after an acknowledgement. */
  cooldownAfterAckSec: number;
  escalation: { timeoutSec: number };
  routing: {
    notifyOperators: boolean;
    /** Minimum severity that reaches volunteers. */
    volunteerMinSeverity: AlertSeverity;
    volunteerRadiusM: number;
    /** Responder location older than this is excluded. */
    responderLocationMaxAgeSec: number;
    /** Band GPS fix older than this is not used for volunteer routing. */
    deviceFixMaxAgeSec: number;
  };
  watch: {
    enabled: boolean;
    minPoints: number;
    minSpanSec: number;
    horizonSec: number;
    /** Ignore trends whose residual noise (score points, RMS) is above this. */
    maxResidual: number;
  };
}

export const DEFAULT_C2_CONFIG: C2Config = {
  version: "c2-alerts-1",
  hri: { enabled: true, warning: 40, danger: 60, critical: 80, minConfidence: "medium" },
  bpmFallback: { enabled: true, warningHigh: 120, dangerHigh: 140, dangerLow: 45, criticalHigh: 160, criticalLow: 35 },
  consecutiveChunks: 2,
  maxHealthAgeSec: 30,
  cooldownAfterAckSec: 300,
  escalation: { timeoutSec: 120 },
  routing: {
    notifyOperators: true,
    volunteerMinSeverity: "danger",
    volunteerRadiusM: 50,
    responderLocationMaxAgeSec: 120,
    deviceFixMaxAgeSec: 60,
  },
  watch: { enabled: true, minPoints: 8, minSpanSec: 60, horizonSec: 300, maxResidual: 8 },
};

/** Deep-merges a partial runtime override (config/c2) over the defaults. */
export function mergeC2Config(override: unknown): C2Config {
  if (!override || typeof override !== "object") return DEFAULT_C2_CONFIG;
  const o = override as Partial<C2Config>;
  const d = DEFAULT_C2_CONFIG;
  return {
    version: typeof o.version === "string" ? o.version : d.version,
    hri: { ...d.hri, ...(o.hri ?? {}) },
    bpmFallback: { ...d.bpmFallback, ...(o.bpmFallback ?? {}) },
    consecutiveChunks: typeof o.consecutiveChunks === "number" ? o.consecutiveChunks : d.consecutiveChunks,
    maxHealthAgeSec: typeof o.maxHealthAgeSec === "number" ? o.maxHealthAgeSec : d.maxHealthAgeSec,
    cooldownAfterAckSec: typeof o.cooldownAfterAckSec === "number" ? o.cooldownAfterAckSec : d.cooldownAfterAckSec,
    escalation: { ...d.escalation, ...(o.escalation ?? {}) },
    routing: { ...d.routing, ...(o.routing ?? {}) },
    watch: { ...d.watch, ...(o.watch ?? {}) },
  };
}
