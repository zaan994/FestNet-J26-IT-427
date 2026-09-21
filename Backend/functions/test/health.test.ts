/**
 * C1 processor tests with synthetic signals (no Firebase).  Run: npm test
 */
import { describe, expect, it } from "vitest";

import { initialState, processChunk, type ProcessResult } from "../src/health";
import { DEFAULT_SYNTHETIC_PARAMS, SyntheticBand, type SyntheticParams } from "../src/health/synthetic";
import { DEFAULT_THRESHOLDS } from "../src/shared";

const EPOCH = 1_760_000_000_000;

/** Feeds `chunks` chunks with the given params through the processor. */
function run(band: SyntheticBand, params: Partial<SyntheticParams>, chunks: number, start = initialState()) {
  let state = start;
  const results: ProcessResult[] = [];
  for (let i = 0; i < chunks; i++) {
    const chunk = band.nextChunk({ ...DEFAULT_SYNTHETIC_PARAMS, ...params });
    const result = processChunk(state, {
      deviceId: "TEST",
      chunk: { ...chunk, serverTs: (chunk.t0 ?? EPOCH) + chunk.durationMs + 150 },
      thresholds: DEFAULT_THRESHOLDS,
      nowMs: (chunk.t0 ?? EPOCH) + chunk.durationMs + 400,
    });
    state = result.state;
    results.push(result);
  }
  return { state, results, last: results[results.length - 1] };
}

describe("heart rate & SpO2", () => {
  it("measures a steady 72 bpm and ~98 % SpO2", () => {
    const { last } = run(new SyntheticBand(EPOCH, 1), { bpm: 72, spo2: 98 }, 30);
    expect(last.health?.worn).toBe(true);
    expect(last.health?.vitals.bpm).toBeGreaterThanOrEqual(69);
    expect(last.health?.vitals.bpm).toBeLessThanOrEqual(75);
    expect(last.health?.vitals.spo2).toBeGreaterThanOrEqual(96);
    expect(last.health?.vitals.spo2).toBeLessThanOrEqual(100);
  });

  it("tracks 120 bpm", () => {
    const { last } = run(new SyntheticBand(EPOCH, 2), { bpm: 120 }, 30);
    expect(last.health?.vitals.bpm).toBeGreaterThanOrEqual(115);
    expect(last.health?.vitals.bpm).toBeLessThanOrEqual(125);
  });

  it("reports HRV once enough beats are collected", () => {
    const { last } = run(new SyntheticBand(EPOCH, 3), { bpm: 70, hrvJitter: 0.05 }, 30);
    expect(last.health?.vitals.hrv.rmssdMs).toBeGreaterThan(5);
    expect(last.health?.vitals.hrv.sdnnMs).toBeGreaterThan(5);
    expect(last.health?.vitals.stress.level).not.toBe("unknown");
  });

  it("reports nothing without skin contact", () => {
    const { last } = run(new SyntheticBand(EPOCH, 4), { contact: false }, 10);
    expect(last.health?.worn).toBe(false);
    expect(last.health?.vitals.bpm ?? null).toBeNull();
    expect(last.health?.temperature.coreEstC ?? null).toBeNull();
    expect(last.health?.anomaly.severity).toBe("none");
  });
});

describe("anomalies", () => {
  it("flags a BPM spike of more than 30 within 90 s and creates one alert", () => {
    const band = new SyntheticBand(EPOCH, 5);
    const calm = run(band, { bpm: 70 }, 20);
    const spike = run(band, { bpm: 115 }, 10, calm.state);
    expect(spike.last.health?.anomaly.types).toContain("bpm_spike");
    expect(spike.last.health?.anomaly.severity).not.toBe("none");
    const alerts = spike.results.filter((r) => r.alert);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].alert?.types).toContain("bpm_spike");
  });

  it("flags high core temperature", () => {
    const { last } = run(new SyntheticBand(EPOCH, 6), { skinC: 35.2 }, 10); // 35.2 + 3.5 = 38.7
    expect(last.health?.temperature.coreEstC).toBeGreaterThan(38);
    expect(last.health?.anomaly.types).toContain("high_temp");
  });

  it("flags low SpO2 after 10 s", () => {
    const { last } = run(new SyntheticBand(EPOCH, 7), { spo2: 91 }, 15);
    expect(last.health?.vitals.spo2).toBeLessThan(94);
    expect(last.health?.anomaly.types).toContain("low_spo2");
  });

  it("detects a fall, and a fall followed by 30 s stillness is critical", () => {
    const band = new SyntheticBand(EPOCH, 8);
    const before = run(band, { motion: "active" }, 5);
    band.triggerFall();
    const after = run(band, { motion: "still" }, 18, before.state);
    expect(after.results[0].health?.anomaly.types).toContain("fall");
    expect(after.results[0].health?.motion.state).toBe("fall");
    expect(after.last.health?.anomaly.types).toEqual(expect.arrayContaining(["fall", "stillness"]));
    expect(after.last.health?.anomaly.severity).toBe("critical");
  });

  it("clears after the condition is gone (hysteresis)", () => {
    const band = new SyntheticBand(EPOCH, 9);
    const hot = run(band, { skinC: 35.2 }, 8);
    expect(hot.last.health?.anomaly.types).toContain("high_temp");
    const cooled = run(band, { skinC: 33.8 }, 15, hot.state);
    expect(cooled.last.health?.anomaly.severity).toBe("none");
  });
});

describe("chunk handling", () => {
  it("ignores duplicate chunks", () => {
    const band = new SyntheticBand(EPOCH, 10);
    const chunk = band.nextChunk(DEFAULT_SYNTHETIC_PARAMS);
    const input = { deviceId: "TEST", chunk, thresholds: DEFAULT_THRESHOLDS, nowMs: EPOCH };
    const first = processChunk(initialState(), input);
    const again = processChunk(first.state, input);
    expect(again.skipped).toBe("duplicate");
  });

  it("writes history every 10 s", () => {
    const { results } = run(new SyntheticBand(EPOCH, 11), {}, 10); // 20 s
    expect(results.filter((r) => r.history).length).toBe(2);
  });
});
