/** HRI engine — complete, partial, low-quality and no data. */
import { describe, expect, it } from "vitest";

import { computeHri, type HriEngineInput } from "../src/hri/engine";
import { DEFAULT_HRI_CONFIG, mergeHriConfig } from "../src/shared";

const T = 1_760_000_000_000;

function input(over: Partial<HriEngineInput> = {}): HriEngineInput {
  return {
    nowMs: T,
    window: { fromMs: T - 60_000, toMs: T, seconds: 60 },
    worn: true,
    heartRate: { bpm: 72, quality: "valid", riseInWindow: 2 },
    hrv: { rmssdMs: 45, quality: "valid" },
    spo2: { value: null, quality: "unavailable", belowThresholdSec: 0 },
    temperature: { surfaceC: 33.8, ambientC: 29, surfaceBaselineC: 33.6 },
    activity: { level: "rest", available: true, stillSec: 0, impactThenStillSec: null },
    baseline: { available: true, restingBpm: 70, rmssdMs: 46 },
    flags: [],
    ...over,
  };
}

describe("HRI — complete data", () => {
  it("no rule fires → score 0, low, high confidence, experimental", () => {
    const r = computeHri(input(), DEFAULT_HRI_CONFIG);
    expect(r.hriScore).toBe(0);
    expect(r.status).toBe("low");
    expect(r.confidence.level).toBe("high");
    expect(r.contributingFactors).toEqual([]);
    expect(r.experimental).toBe(true);
    expect(r.validated).toBe(false);
    expect(r.algorithmVersion).toMatch(/experimental/);
  });

  it("explains each contributing rule", () => {
    const r = computeHri(
      input({
        heartRate: { bpm: 112, quality: "valid", riseInWindow: 40 },
        temperature: { surfaceC: 35.6, ambientC: 36, surfaceBaselineC: 33.6 },
      }),
      DEFAULT_HRI_CONFIG,
    );
    const ids = r.contributingFactors.map((f) => f.ruleId);
    expect(ids).toEqual(expect.arrayContaining(["hrRiseAtLowActivity", "hrElevatedVsBaseline", "surfaceTempRise", "highAmbientTemp"]));
    expect(r.hriScore).toBe(80);
    expect(r.status).toBe("high");
    for (const f of r.contributingFactors) expect(f.detail.length).toBeGreaterThan(10);
    expect(r.contributingFactors.find((f) => f.ruleId === "surfaceTempRise")!.detail).toMatch(/not core/);
  });
});

describe("HRI — activity awareness", () => {
  it("a heart-rate rise during vigorous activity does not count", () => {
    const r = computeHri(
      input({ heartRate: { bpm: 130, quality: "valid", riseInWindow: 50 }, activity: { level: "vigorous", available: true, stillSec: 0, impactThenStillSec: null } }),
      DEFAULT_HRI_CONFIG,
    );
    expect(r.contributingFactors.map((f) => f.ruleId)).not.toContain("hrRiseAtLowActivity");
  });
  it("hot ambient alone adds no points", () => {
    const r = computeHri(input({ temperature: { surfaceC: 33.7, ambientC: 40, surfaceBaselineC: 33.6 } }), DEFAULT_HRI_CONFIG);
    expect(r.hriScore).toBe(0);
    expect(r.dataQuality.notes.join(" ")).toMatch(/Ambient temperature is high/);
  });
  it("a possible impact only counts with sustained immobility", () => {
    const shortStill = computeHri(input({ activity: { level: "rest", available: true, stillSec: 5, impactThenStillSec: 5 } }), DEFAULT_HRI_CONFIG);
    expect(shortStill.contributingFactors).toEqual([]);
    const longStill = computeHri(input({ activity: { level: "rest", available: true, stillSec: 40, impactThenStillSec: 40 } }), DEFAULT_HRI_CONFIG);
    expect(longStill.contributingFactors.map((f) => f.ruleId)).toEqual(expect.arrayContaining(["impactThenImmobility", "prolongedImmobility"]));
  });
});

describe("HRI — partial / low-quality / no data", () => {
  it("not worn → null score, insufficient_data, no confidence", () => {
    const r = computeHri(input({ worn: false }), DEFAULT_HRI_CONFIG);
    expect(r.hriScore).toBeNull();
    expect(r.status).toBe("insufficient_data");
    expect(r.confidence.level).toBe("none");
  });

  it("no physiological input → null score (missing data is not low risk)", () => {
    const r = computeHri(
      input({
        heartRate: { bpm: null, quality: "unavailable", riseInWindow: null },
        hrv: { rmssdMs: null, quality: "unavailable" },
        temperature: { surfaceC: null, ambientC: 29, surfaceBaselineC: null },
      }),
      DEFAULT_HRI_CONFIG,
    );
    expect(r.hriScore).toBeNull();
    expect(r.status).toBe("insufficient_data");
    expect(r.missingInputs).toEqual(expect.arrayContaining(["heart_rate", "hrv", "surface_temperature"]));
  });

  it("low-quality data lowers confidence and withholds the status", () => {
    const r = computeHri(input({ flags: ["low_perfusion", "motion_artifact_risk", "beat_detection_unstable"] }), DEFAULT_HRI_CONFIG);
    expect(r.confidence.value).toBeLessThan(DEFAULT_HRI_CONFIG.minConfidenceForStatus);
    expect(r.status).toBe("insufficient_data");
    expect(r.dataQuality.flags).toEqual(expect.arrayContaining(["low_perfusion"]));
  });

  it("low-quality heart rate is never used by heart-rate rules", () => {
    const r = computeHri(input({ heartRate: { bpm: 140, quality: "low_quality", riseInWindow: 60 } }), DEFAULT_HRI_CONFIG);
    expect(r.contributingFactors.map((f) => f.ruleId)).not.toContain("hrRiseAtLowActivity");
    expect(r.missingInputs).toContain("heart_rate");
  });

  it("without a personal baseline, baseline rules cannot fire and confidence drops", () => {
    const withBaseline = computeHri(input(), DEFAULT_HRI_CONFIG);
    const without = computeHri(input({ baseline: { available: false, restingBpm: null, rmssdMs: null }, heartRate: { bpm: 120, quality: "valid", riseInWindow: 5 } }), DEFAULT_HRI_CONFIG);
    expect(without.contributingFactors.map((f) => f.ruleId)).not.toContain("hrElevatedVsBaseline");
    expect(without.confidence.value).toBeLessThan(withBaseline.confidence.value);
    expect(without.missingInputs).toContain("personal_baseline");
  });

  it("SpO2 is ignored unless explicitly enabled", () => {
    const r = computeHri(input({ spo2: { value: 85, quality: "valid", belowThresholdSec: 60 } }), DEFAULT_HRI_CONFIG);
    expect(r.contributingFactors.map((f) => f.ruleId)).not.toContain("lowSpo2");
    const enabled = mergeHriConfig({ spo2: { useInHri: true }, rules: { lowSpo2: { enabled: true } } });
    const r2 = computeHri(input({ spo2: { value: 85, quality: "valid", belowThresholdSec: 60 } }), enabled);
    expect(r2.contributingFactors.map((f) => f.ruleId)).toContain("lowSpo2");
  });

  it("missing motion data is reported and reduces confidence", () => {
    const r = computeHri(input({ activity: { level: "unknown", available: false, stillSec: 0, impactThenStillSec: null }, flags: ["sensor_missing_imu"] }), DEFAULT_HRI_CONFIG);
    expect(r.missingInputs).toContain("activity");
    expect(r.confidence.value).toBeLessThan(1);
  });
});
