/**
 * C1 processor v2 with synthetic signals (no Firebase). Run: npm test
 * Synthetic signals verify the algorithms behave as designed; they are NOT evidence of
 * accuracy on real people (see the evaluation plan in docs/research).
 */
import { describe, expect, it } from "vitest";

import { initialState, processChunk, type AssignmentContext, type ProcessResult } from "../src/health";
import { computeHrv } from "../src/health/heart";
import { DEFAULT_SYNTHETIC_PARAMS, SyntheticBand, type SyntheticParams } from "../src/health/synthetic";
import type { IbiRecord } from "../src/health/state";
import { DEFAULT_HRI_CONFIG, mergeHriConfig, type RawChunk } from "../src/shared";

const EPOCH = 1_760_000_000_000;
const A1: AssignmentContext = { assignmentId: "A-TEST-0001", eventId: "demo-event-abcd", participantId: "P-AAAABBBB", demo: true };
const A2: AssignmentContext = { assignmentId: "A-TEST-0002", eventId: "demo-event-abcd", participantId: "P-CCCCDDDD", demo: true };

interface RunOpts {
  assignment?: AssignmentContext | null;
  hriConfig?: typeof DEFAULT_HRI_CONFIG;
  mutate?: (chunk: RawChunk) => RawChunk;
}

function run(band: SyntheticBand, params: Partial<SyntheticParams> | ((i: number) => Partial<SyntheticParams>), chunks: number, start = initialState(), opts: RunOpts = {}) {
  let state = start;
  const results: ProcessResult[] = [];
  for (let i = 0; i < chunks; i++) {
    const p = typeof params === "function" ? params(i) : params;
    let chunk = band.nextChunk({ ...DEFAULT_SYNTHETIC_PARAMS, ...p });
    chunk = { ...chunk, serverTs: (chunk.t0 ?? EPOCH) + chunk.durationMs + 150 };
    if (opts.mutate) chunk = opts.mutate(chunk);
    const result = processChunk(state, {
      deviceId: "TEST",
      chunk,
      hriConfig: opts.hriConfig ?? DEFAULT_HRI_CONFIG,
      assignment: opts.assignment === undefined ? A1 : opts.assignment,
      nowMs: (chunk.t0 ?? EPOCH) + chunk.durationMs + 400,
    });
    state = result.state;
    results.push(result);
  }
  return { state, results, last: results[results.length - 1] };
}

describe("heart rate", () => {
  it("measures a steady 72 bpm at rest with valid quality", () => {
    const { last } = run(new SyntheticBand(EPOCH, 1), { bpm: 72, motion: "still" }, 30);
    const hr = last.health!.heartRate;
    expect(last.health!.worn).toBe(true);
    expect(hr.quality).toBe("valid");
    expect(hr.bpm).toBeGreaterThanOrEqual(69);
    expect(hr.bpm).toBeLessThanOrEqual(75);
  });

  it("tracks 120 bpm", () => {
    const { last } = run(new SyntheticBand(EPOCH, 2), { bpm: 120, motion: "still" }, 30);
    expect(last.health!.heartRate.bpm).toBeGreaterThanOrEqual(115);
    expect(last.health!.heartRate.bpm).toBeLessThanOrEqual(125);
  });

  it("reports nothing (unavailable, not zero) without skin contact", () => {
    const { last } = run(new SyntheticBand(EPOCH, 4), { contact: false }, 10);
    expect(last.health!.worn).toBe(false);
    expect(last.health!.heartRate.bpm ?? null).toBeNull();
    expect(last.health!.heartRate.quality).toBe("unavailable");
    expect(last.health!.signal.flags).toContain("not_worn");
    expect(last.health!.hri.hriScore).toBeNull();
    expect(last.health!.hri.status).toBe("insufficient_data");
  });

  it("flags too few PPG samples and downgrades heart-rate quality", () => {
    const { last } = run(new SyntheticBand(EPOCH, 5), { motion: "still" }, 30, initialState(), {
      mutate: (c) => ({ ...c, ppg: { ...c.ppg!, n: 120, red: c.ppg!.red!.slice(0, 120), ir: c.ppg!.ir!.slice(0, 120) } }),
    });
    expect(last.health!.signal.flags).toContain("ppg_samples_low");
    expect(last.health!.heartRate.quality).not.toBe("valid");
  });

  it("flags PPG FIFO overflow", () => {
    const { last } = run(new SyntheticBand(EPOCH, 6), { motion: "still" }, 5, initialState(), {
      mutate: (c) => ({ ...c, ppg: { ...c.ppg!, overflow: 7 } }),
    });
    expect(last.health!.signal.flags).toContain("ppg_fifo_overflow");
  });
});

describe("never misreport", () => {
  it("SpO2 is hidden by default (unvalidated)", () => {
    const { last } = run(new SyntheticBand(EPOCH, 7), { motion: "still" }, 20);
    expect(last.health!.spo2.value ?? null).toBeNull();
    expect(last.health!.spo2.validated).toBe(false);
    expect(last.health!.spo2.displayEnabled).toBe(false);
  });

  it("temperature is a surface reading only — no core estimate exists", () => {
    const { last } = run(new SyntheticBand(EPOCH, 8), { skinC: 34.1, motion: "still" }, 5);
    expect(last.health!.temperature.surfaceC).toBeCloseTo(34.1, 0);
    expect(last.health!.temperature).not.toHaveProperty("coreEstC");
  });

  it("flags a missing device clock", () => {
    const band = new SyntheticBand(null, 9);
    const { last } = run(band, { motion: "still" }, 3);
    expect(last.health!.signal.clockSynced).toBe(false);
    expect(last.health!.signal.flags).toContain("clock_not_synced");
    expect(last.health!.measuredAt ?? null).toBeNull();
  });
});

describe("HRV guards", () => {
  it("is null until enough accepted intervals span ≥ 30 s", () => {
    const { results } = run(new SyntheticBand(EPOCH, 10), { bpm: 70, hrvJitter: 0.05, motion: "still" }, 30);
    expect(results[5].health!.hrv.rmssdMs ?? null).toBeNull(); // ~10 s of data
    expect(results[29].health!.hrv.rmssdMs).toBeGreaterThan(5); // ~60 s
    expect(results[29].health!.hrv.quality).toBe("valid");
  });

  it("refuses to compute from too few or non-consecutive intervals", () => {
    const few: IbiRecord[] = Array.from({ length: 5 }, (_, i) => ({ t: i * 800, ibi: 800, follows: true }));
    expect(computeHrv(few, 4000).rmssdMs).toBeNull();
    const broken: IbiRecord[] = Array.from({ length: 40 }, (_, i) => ({ t: i * 1000, ibi: 1000, follows: false }));
    expect(computeHrv(broken, 39_000).rmssdMs).toBeNull(); // no consecutive pairs
    const short: IbiRecord[] = Array.from({ length: 20 }, (_, i) => ({ t: i * 500, ibi: 500, follows: true }));
    expect(computeHrv(short, 9_500).rmssdMs).toBeNull(); // spans < 30 s
  });
});

describe("assignment context", () => {
  it("unassigned bands produce health but no history, stats or alerts", () => {
    const { results } = run(new SyntheticBand(EPOCH, 11), { motion: "still" }, 10, initialState(), { assignment: null });
    expect(results.every((r) => r.health && !r.history && !r.stats && !r.hriAlert)).toBe(true);
    expect(results[9].health!.assignmentId ?? null).toBeNull();
  });

  it("history every 10 s while assigned, tagged with the event", () => {
    const { results } = run(new SyntheticBand(EPOCH, 12), {}, 10);
    const history = results.filter((r) => r.history);
    expect(history).toHaveLength(2);
    expect(history[0].history!.eventId).toBe(A1.eventId);
  });

  it("state resets when the band is reassigned (no leakage between attendees)", () => {
    const band = new SyntheticBand(EPOCH, 13);
    const first = run(band, { motion: "still" }, 70);
    expect(first.state.baselineReady).toBe(true);
    const second = run(band, { motion: "still" }, 1, first.state, { assignment: A2 });
    expect(second.state.assignmentId).toBe(A2.assignmentId);
    expect(second.state.baselineReady).toBe(false);
    expect(second.state.stats.chunks).toBe(1);
  });

  it("ignores duplicate chunks", () => {
    const band = new SyntheticBand(EPOCH, 14);
    const chunk = band.nextChunk(DEFAULT_SYNTHETIC_PARAMS);
    const input = { deviceId: "TEST", chunk, hriConfig: DEFAULT_HRI_CONFIG, assignment: A1, nowMs: EPOCH };
    const first = processChunk(initialState(), input);
    expect(processChunk(first.state, input).skipped).toBe("duplicate");
  });
});

describe("automated HRI alert", () => {
  it("fires once after sustained high HRI with enough confidence, then respects the cooldown", () => {
    const band = new SyntheticBand(EPOCH, 15);
    // 140 s calm at rest → personal baseline, then a gradual heart-rate rise + surface warming at rest.
    const calm = run(band, { bpm: 70, motion: "still", skinC: 33.8 }, 70);
    expect(calm.state.baselineReady).toBe(true);
    const stressed = run(band, (i) => ({ bpm: Math.min(118, 72 + i * 4), motion: "still", skinC: Math.min(36, 33.8 + i * 0.2) }), 40, calm.state);
    const alerts = stressed.results.filter((r) => r.hriAlert);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].hriAlert!.idempotencyKey).toContain(A1.assignmentId);
    expect(alerts[0].hriAlert!.reasons.length).toBeGreaterThan(0);
    expect(stressed.last.health!.hri.status).toBe("high");
  });

  it("can be disabled by configuration", () => {
    const band = new SyntheticBand(EPOCH, 16);
    const cfg = mergeHriConfig({ alerts: { enabled: false } });
    const calm = run(band, { bpm: 70, motion: "still", skinC: 33.8 }, 70, initialState(), { hriConfig: cfg });
    const stressed = run(band, (i) => ({ bpm: Math.min(118, 72 + i * 4), motion: "still", skinC: Math.min(36, 33.8 + i * 0.2) }), 40, calm.state, { hriConfig: cfg });
    expect(stressed.results.some((r) => r.hriAlert)).toBe(false);
  });
});
