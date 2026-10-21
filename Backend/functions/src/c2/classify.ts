/**
 * C2 — anomaly classification (pure, unit-tested in test/c2.test.ts).
 *
 * Input is C1's DERIVED health record (devices/{id}/health), never raw optical counts.
 *  1. HRI path: C1 hriScore with configurable cut-offs, only when C1 rates the result usable
 *     (status ≠ insufficient_data, confidence ≥ cfg.hri.minConfidence). A null score never alerts.
 *  2. Fallback path, only when no usable HRI exists: backend-validated heart rate
 *     (quality "valid", band worn) with activity gating — exertion is not an anomaly.
 *  3. Stale, missing, malformed or not-worn data → no physiological alert (never treated as 0).
 * Manual SOS is classified separately and is always critical.
 */
import { SEVERITY_RANK, type AlertSeverity, type ConfidenceLevel, type DeviceHealth } from "../shared";
import type { C2Config } from "../shared/c2Config";

export interface Classification {
  severity: AlertSeverity | null;
  reasonCodes: string[];
  /** One-line, human readable (shown to staff; no participant identity). */
  summary: string;
  contributing: {
    hriScore: number | null;
    hriStatus: DeviceHealth["hri"]["status"] | null;
    hriConfidence: ConfidenceLevel | null;
    bpm: number | null;
    activity: DeviceHealth["activity"]["level"] | null;
    healthSeq: number | null;
    measuredAt: number | null;
    computedAt: number | null;
  };
  /** Why nothing was classified (for logs / tests). */
  skipped?: "no_data" | "stale" | "not_worn" | "no_usable_metric";
}

const CONF_RANK: Record<ConfidenceLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };

const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const maxSeverity = (a: AlertSeverity | null, b: AlertSeverity | null): AlertSeverity | null =>
  !a ? b : !b ? a : SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;

export function classifyHealth(health: Partial<DeviceHealth> | null | undefined, nowMs: number, cfg: C2Config): Classification {
  const contributing: Classification["contributing"] = {
    hriScore: null,
    hriStatus: null,
    hriConfidence: null,
    bpm: null,
    activity: null,
    healthSeq: null,
    measuredAt: null,
    computedAt: null,
  };
  const none = (skipped: Classification["skipped"]): Classification => ({ severity: null, reasonCodes: [], summary: "", contributing, skipped });
  if (!health || typeof health !== "object") return none("no_data");

  contributing.healthSeq = finite(health.seq);
  contributing.measuredAt = finite(health.measuredAt);
  contributing.computedAt = finite(health.computedAt);
  contributing.activity = health.activity?.level ?? null;

  const computedAt = contributing.computedAt;
  if (computedAt === null || nowMs - computedAt > cfg.maxHealthAgeSec * 1000 || computedAt - nowMs > 60_000) return none("stale");
  if (health.worn !== true) return none("not_worn");

  const reasons: string[] = [];
  const parts: string[] = [];
  let severity: AlertSeverity | null = null;

  // ---- 1. HRI (C1) ----
  const hri = health.hri;
  const score = finite(hri?.hriScore);
  const conf = hri?.confidence?.level ?? "none";
  contributing.hriScore = score;
  contributing.hriStatus = hri?.status ?? null;
  contributing.hriConfidence = conf;
  const hriUsable =
    cfg.hri.enabled &&
    score !== null &&
    score >= 0 &&
    score <= 100 &&
    hri?.status !== undefined &&
    hri.status !== "insufficient_data" &&
    CONF_RANK[conf] >= CONF_RANK[cfg.hri.minConfidence];

  if (hriUsable) {
    const s: AlertSeverity | null = score >= cfg.hri.critical ? "critical" : score >= cfg.hri.danger ? "danger" : score >= cfg.hri.warning ? "warning" : null;
    if (s) {
      severity = s;
      reasons.push(`hri_${s}`);
      for (const f of hri!.contributingFactors ?? []) if (f?.ruleId) reasons.push(`hri_factor:${f.ruleId}`);
      parts.push(`Health Risk Indicator ${score} (${conf} confidence)`);
    }
  } else if (cfg.bpmFallback.enabled) {
    // ---- 2. Fallback: validated heart rate only ----
    const hr = health.heartRate;
    const bpm = hr?.quality === "valid" ? finite(hr.bpm) : null;
    if (bpm !== null && bpm >= 20 && bpm <= 250) {
      contributing.bpm = bpm;
      const level = health.activity?.level ?? "unknown";
      const lowActivity = level === "rest" || level === "light";
      const fb = cfg.bpmFallback;
      let s: AlertSeverity | null = null;
      let code = "";
      if (bpm > fb.criticalHigh) [s, code] = ["critical", "bpm_critical_high"];
      else if (bpm < fb.criticalLow) [s, code] = ["critical", "bpm_critical_low"];
      else if (bpm > fb.dangerHigh && (lowActivity || level === "unknown")) [s, code] = ["danger", "bpm_danger_high"];
      else if (bpm < fb.dangerLow) [s, code] = ["danger", "bpm_danger_low"];
      else if (bpm > fb.warningHigh && lowActivity) [s, code] = ["warning", "bpm_warning_high"];
      if (s) {
        severity = maxSeverity(severity, s);
        reasons.push(code);
        parts.push(`Heart rate ${Math.round(bpm)} bpm at ${level} activity`);
      }
    } else {
      return none("no_usable_metric");
    }
  } else {
    return none("no_usable_metric");
  }

  return { severity, reasonCodes: reasons, summary: parts.join(" · "), contributing };
}

export function sosClassification(source: "device_button" | "attendee_app"): Pick<Classification, "severity" | "reasonCodes" | "summary"> {
  return {
    severity: "critical",
    reasonCodes: ["manual_sos", source === "device_button" ? "sos_band_button" : "sos_app"],
    summary: source === "device_button" ? "SOS button pressed on the band" : "SOS sent from the FestNet app",
  };
}
