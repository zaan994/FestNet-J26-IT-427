/**
 * Explainable HRI (Health Risk Indicator) — EXPERIMENTAL, UNVALIDATED research prototype.
 *
 * Pure function: (inputs, config) -> HriResult. No Firebase, no clock reads (time is an input),
 * so every behaviour is unit-tested in test/hri.test.ts.
 *
 * How it works (documented in docs/research/c1-health-monitoring.md):
 *  1. CONFIDENCE (data quality) is computed first and kept separate from the score:
 *       start at 1.0, multiply by the configured penalty of every active data-quality flag,
 *       then by input coverage (0.4 + 0.6 × available physiological inputs / 3) and by 0.85 when no
 *       personal baseline exists. Not worn → 0.
 *  2. RULES: each enabled rule checks one transparent condition on VALID inputs only and, if it
 *       fires, adds its configured points and an explanation (contributingFactors). A rule whose
 *       inputs are missing does not fire and its input is listed in missingInputs — missing data
 *       never counts as "low risk".
 *  3. SCORE = min(100, Σ points), but null when confidence < minConfidenceForScore or no
 *       physiological input is available.
 *  4. STATUS = insufficient_data when the score is null or confidence < minConfidenceForStatus,
 *       otherwise low / elevated / high from the configured cut-offs.
 * Manual SOS is handled elsewhere and is never affected by this module.
 */
import type {
  ActivityLevel,
  ConfidenceLevel,
  DataQualityFlag,
  HriFactor,
  HriInput,
  HriResult,
  HriStatus,
  MetricQuality,
} from "../shared/schema";
import type { HriConfig, HriRuleConfig } from "../shared/hriConfig";

export const HRI_ALGORITHM_VERSION = "hri-rules-0.1-experimental";

export interface HriEngineInput {
  nowMs: number;
  window: { fromMs: number | null; toMs: number | null; seconds: number };
  worn: boolean;
  heartRate: { bpm: number | null; quality: MetricQuality; riseInWindow: number | null };
  hrv: { rmssdMs: number | null; quality: MetricQuality };
  spo2: { value: number | null; quality: MetricQuality; belowThresholdSec: number };
  temperature: { surfaceC: number | null; ambientC: number | null; surfaceBaselineC: number | null };
  activity: { level: ActivityLevel; available: boolean; stillSec: number; impactThenStillSec: number | null };
  baseline: { available: boolean; restingBpm: number | null; rmssdMs: number | null };
  flags: DataQualityFlag[];
}

const LOW_ACTIVITY: ActivityLevel[] = ["rest", "light"];

export function confidenceLevel(value: number): ConfidenceLevel {
  if (value <= 0) return "none";
  if (value >= 0.7) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function computeHri(input: HriEngineInput, config: HriConfig): HriResult {
  const notes: string[] = [];
  const flags = [...new Set(input.flags)];

  // ---- inputs ----
  const hrValid = input.heartRate.quality === "valid" && input.heartRate.bpm !== null;
  const hrvValid = input.hrv.quality === "valid" && input.hrv.rmssdMs !== null;
  const spo2Usable = config.spo2.useInHri && input.spo2.quality === "valid" && input.spo2.value !== null;
  const surfaceValid = input.worn && input.temperature.surfaceC !== null;
  const ambientValid = input.temperature.ambientC !== null;

  const available: HriInput[] = [];
  const missing: HriInput[] = [];
  (hrValid ? available : missing).push("heart_rate");
  (hrvValid ? available : missing).push("hrv");
  if (config.spo2.useInHri) (spo2Usable ? available : missing).push("spo2");
  (surfaceValid ? available : missing).push("surface_temperature");
  (ambientValid ? available : missing).push("ambient_temperature");
  (input.activity.available ? available : missing).push("activity");
  (input.baseline.available ? available : missing).push("personal_baseline");

  // ---- confidence (data quality), separate from risk ----
  let confidence = input.worn ? 1 : 0;
  for (const flag of flags) confidence *= config.confidencePenalties[flag] ?? 1;
  const physiological = [hrValid, hrvValid, surfaceValid].filter(Boolean).length;
  confidence *= 0.4 + 0.6 * (physiological / 3);
  if (!input.baseline.available) confidence *= 0.85;
  confidence = Math.max(0, Math.min(1, confidence));

  if (!input.worn) notes.push("Band is not worn (no skin contact) — no physiological estimate.");
  if (!input.activity.available) notes.push("No motion data — exertion cannot be separated from risk.");
  if (!input.baseline.available) notes.push("Personal baseline not available yet — baseline rules cannot fire.");
  // SpO2 is excluded while its estimate is uncalibrated (research note); the UI text stays neutral.
  if (!config.spo2.useInHri) notes.push("SpO2 is not used in this indicator.");

  // ---- rules ----
  const factors: HriFactor[] = [];
  const fire = (ruleId: string, rule: HriRuleConfig, label: string, value: number | null, unit: string, detail: string) => {
    factors.push({ ruleId, label, points: rule.points, value: value === null ? null : round(value), threshold: rule.threshold, unit, detail });
  };
  const r = config.rules;
  const lowActivity = input.activity.available && LOW_ACTIVITY.includes(input.activity.level);

  if (r.hrRiseAtLowActivity.enabled && hrValid && lowActivity && input.heartRate.riseInWindow !== null) {
    if (input.heartRate.riseInWindow > r.hrRiseAtLowActivity.threshold) {
      fire("hrRiseAtLowActivity", r.hrRiseAtLowActivity, "Heart-rate rise at low activity", input.heartRate.riseInWindow, "bpm",
        `Heart rate rose ${round(input.heartRate.riseInWindow, 0)} bpm within ${r.hrRiseAtLowActivity.param ?? 90} s while activity was "${input.activity.level}".`);
    }
  }

  if (r.hrElevatedVsBaseline.enabled && hrValid && lowActivity && input.baseline.restingBpm !== null) {
    const delta = input.heartRate.bpm! - input.baseline.restingBpm;
    if (delta > r.hrElevatedVsBaseline.threshold) {
      fire("hrElevatedVsBaseline", r.hrElevatedVsBaseline, "Heart rate above personal baseline", delta, "bpm",
        `Heart rate is ${round(delta, 0)} bpm above the personal resting baseline (${round(input.baseline.restingBpm, 0)} bpm).`);
    }
  }

  if (r.hrvReducedVsBaseline.enabled && hrvValid && input.baseline.rmssdMs !== null && input.baseline.rmssdMs > 0) {
    const ratio = input.hrv.rmssdMs! / input.baseline.rmssdMs;
    if (ratio < r.hrvReducedVsBaseline.threshold) {
      fire("hrvReducedVsBaseline", r.hrvReducedVsBaseline, "Reduced heart-rate variability", ratio, "× baseline",
        `RMSSD is ${round(ratio)}× the personal baseline (${round(input.baseline.rmssdMs, 0)} ms).`);
    }
  }

  if (r.surfaceTempRise.enabled && surfaceValid && input.temperature.surfaceBaselineC !== null) {
    const delta = input.temperature.surfaceC! - input.temperature.surfaceBaselineC;
    if (delta > r.surfaceTempRise.threshold) {
      fire("surfaceTempRise", r.surfaceTempRise, "Surface temperature rise", delta, "°C",
        `Band surface/object temperature is ${round(delta, 1)} °C above its baseline. This is a surface reading, not core temperature.`);
    }
  }

  if (r.prolongedImmobility.enabled && input.worn && input.activity.available && input.activity.stillSec >= r.prolongedImmobility.threshold) {
    fire("prolongedImmobility", r.prolongedImmobility, "Prolonged immobility", input.activity.stillSec, "s",
      `No movement detected for ${input.activity.stillSec} s while worn.`);
  }

  if (r.impactThenImmobility.enabled && input.activity.impactThenStillSec !== null && input.activity.impactThenStillSec >= r.impactThenImmobility.threshold) {
    fire("impactThenImmobility", r.impactThenImmobility, "Possible impact, then no movement", input.activity.impactThenStillSec, "s",
      `A possible impact was followed by ${input.activity.impactThenStillSec} s without movement. Not a fall diagnosis — needs human check.`);
  }

  if (r.lowSpo2.enabled && spo2Usable && input.spo2.value! < r.lowSpo2.threshold && input.spo2.belowThresholdSec >= (r.lowSpo2.param ?? 10)) {
    fire("lowSpo2", r.lowSpo2, "Low SpO2 (experimental)", input.spo2.value, "%", `SpO2 below ${r.lowSpo2.threshold} % for ${input.spo2.belowThresholdSec} s.`);
  }

  // Ambient heat is context: it only adds points when a physiological rule already fired.
  const physiologicalFired = factors.length > 0;
  if (r.highAmbientTemp.enabled && ambientValid && input.temperature.ambientC! > r.highAmbientTemp.threshold) {
    if (physiologicalFired) {
      fire("highAmbientTemp", r.highAmbientTemp, "Hot environment (context)", input.temperature.ambientC, "°C",
        `Ambient temperature at the band is ${round(input.temperature.ambientC!, 1)} °C.`);
    } else {
      notes.push(`Ambient temperature is high (${round(input.temperature.ambientC!, 1)} °C) but no physiological rule fired, so it adds no points.`);
    }
  }

  // ---- score + status ----
  let hriScore: number | null = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  if (physiological === 0 || confidence < config.minConfidenceForScore) {
    hriScore = null;
    notes.push(physiological === 0 ? "No valid physiological input — score not calculated." : "Confidence too low — score not calculated.");
  }

  let status: HriStatus = "insufficient_data";
  if (hriScore !== null && confidence >= config.minConfidenceForStatus) {
    status = hriScore >= config.statusCutoffs.high ? "high" : hriScore >= config.statusCutoffs.elevated ? "elevated" : "low";
  }

  return {
    hriScore,
    status,
    confidence: { level: confidenceLevel(confidence), value: round(confidence) },
    calculatedAt: input.nowMs,
    window: input.window,
    availableInputs: available,
    missingInputs: missing,
    contributingFactors: factors,
    dataQuality: { flags, notes },
    baselineAvailable: input.baseline.available,
    algorithmVersion: HRI_ALGORITHM_VERSION,
    configVersion: config.version,
    experimental: true,
    validated: false,
  };
}
