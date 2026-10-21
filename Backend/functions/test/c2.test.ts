/**
 * C2 pure-function tests: classification boundaries, data validation, dedupe/cooldown/upgrade,
 * volunteer routing (Haversine boundary), trend prediction and the alert state machine.
 * Deterministic clock; no Firebase. Run: npm test
 */
import { describe, expect, it } from "vitest";

import { classifyHealth, sosClassification, type Classification } from "../src/c2/classify";
import { decideHealthAction, type DeviceAlertState } from "../src/c2/decide";
import { predictTrend } from "../src/c2/predict";
import { selectVolunteers } from "../src/c2/routing";
import { FakeSender } from "../src/c2/sender";
import { nextStatus } from "../src/services/emergencies";
import { DEFAULT_C2_CONFIG, haversineMeters, mergeC2Config, offsetMeters, type DeviceHealth } from "../src/shared";

const NOW = 1_790_000_000_000;
const cfg = DEFAULT_C2_CONFIG;

function health(over: { score?: number | null; conf?: DeviceHealth["hri"]["confidence"]["level"]; status?: DeviceHealth["hri"]["status"]; bpm?: number | null; bpmQuality?: DeviceHealth["heartRate"]["quality"]; activity?: DeviceHealth["activity"]["level"]; worn?: boolean; computedAt?: number; surfaceC?: number } = {}): Partial<DeviceHealth> {
  const score = over.score === undefined ? 10 : over.score;
  return {
    deviceId: "FESTNET_001",
    seq: 1,
    computedAt: over.computedAt ?? NOW,
    measuredAt: (over.computedAt ?? NOW) - 500,
    worn: over.worn ?? true,
    heartRate: { bpm: over.bpm === undefined ? 75 : over.bpm, quality: over.bpmQuality ?? "valid", beats: 3, method: "t" },
    temperature: { surfaceC: over.surfaceC ?? 33 },
    activity: { level: over.activity ?? "rest", stillSec: 0, impactDetected: false },
    hri: {
      hriScore: score,
      status: over.status ?? (score === null ? "insufficient_data" : score >= 60 ? "high" : score >= 30 ? "elevated" : "low"),
      confidence: { level: over.conf ?? "high", value: 0.8 },
      calculatedAt: NOW,
      window: { fromMs: null, toMs: null, seconds: 60 },
      availableInputs: [],
      missingInputs: [],
      contributingFactors: score && score >= 30 ? [{ ruleId: "hrRiseAtLowActivity", label: "x", points: 30, detail: "x" }] : [],
      dataQuality: { flags: [], notes: [] },
      baselineAvailable: true,
      algorithmVersion: "t",
      configVersion: "t",
      experimental: true,
      validated: false,
    },
  };
}

describe("classifyHealth — HRI thresholds", () => {
  it.each([
    [39, null],
    [40, "warning"],
    [59, "warning"],
    [60, "danger"],
    [79, "danger"],
    [80, "critical"],
  ])("score %i → %s", (score, expected) => {
    expect(classifyHealth(health({ score }), NOW, cfg).severity).toBe(expected);
  });

  it("records the C1 contributing factors as reason codes", () => {
    const c = classifyHealth(health({ score: 65 }), NOW, cfg);
    expect(c.reasonCodes).toEqual(["hri_danger", "hri_factor:hrRiseAtLowActivity"]);
    expect(c.contributing.hriScore).toBe(65);
  });

  it("ignores low-confidence or insufficient HRI and falls back to validated heart rate", () => {
    expect(classifyHealth(health({ score: 90, conf: "low", bpm: 70 }), NOW, cfg).severity).toBeNull();
    expect(classifyHealth(health({ score: 90, status: "insufficient_data", bpm: 70 }), NOW, cfg).severity).toBeNull();
    expect(classifyHealth(health({ score: null, bpm: 150 }), NOW, cfg).severity).toBe("danger");
  });
});

describe("classifyHealth — validated heart-rate fallback", () => {
  const fb = (bpm: number, activity: DeviceHealth["activity"]["level"] = "rest") => classifyHealth(health({ score: null, bpm, activity }), NOW, cfg).severity;
  it("high boundaries", () => {
    expect(fb(120)).toBeNull();
    expect(fb(121)).toBe("warning");
    expect(fb(140)).toBe("warning");
    expect(fb(141)).toBe("danger");
    expect(fb(160)).toBe("danger");
    expect(fb(161)).toBe("critical");
  });
  it("low boundaries", () => {
    expect(fb(45)).toBeNull();
    expect(fb(44)).toBe("danger");
    expect(fb(35)).toBe("danger");
    expect(fb(34)).toBe("critical");
  });
  it("activity gating: exertion is not an anomaly", () => {
    expect(fb(130, "vigorous")).toBeNull();
    expect(fb(150, "vigorous")).toBeNull();
    expect(fb(150, "unknown")).toBe("danger");
    expect(fb(130, "unknown")).toBeNull();
    expect(fb(165, "vigorous")).toBe("critical");
  });
});

describe("classifyHealth — data validation", () => {
  it("missing, stale, future, not worn, malformed → no alert, never zero", () => {
    expect(classifyHealth(null, NOW, cfg).skipped).toBe("no_data");
    expect(classifyHealth(health({ score: 90, computedAt: NOW - 31_000 }), NOW, cfg).skipped).toBe("stale");
    expect(classifyHealth(health({ score: 90, computedAt: NOW + 120_000 }), NOW, cfg).skipped).toBe("stale");
    expect(classifyHealth(health({ score: 90, worn: false }), NOW, cfg).skipped).toBe("not_worn");
    expect(classifyHealth({ ...health({ score: Number.NaN as unknown as number, bpm: null }) }, NOW, cfg).severity).toBeNull();
  });
  it("a heart rate that is not quality-validated (e.g. raw optical data) never triggers", () => {
    const c = classifyHealth(health({ score: null, bpm: 200, bpmQuality: "unavailable" }), NOW, cfg);
    expect(c.severity).toBeNull();
    expect(c.skipped).toBe("no_usable_metric");
    expect(classifyHealth(health({ score: null, bpm: 200, bpmQuality: "low_quality" }), NOW, cfg).severity).toBeNull();
  });
  it("surface (object) temperature is never used as body temperature", () => {
    const c = classifyHealth(health({ score: 10, surfaceC: 45 }), NOW, cfg);
    expect(c.severity).toBeNull();
    expect(c.reasonCodes.join()).not.toMatch(/temp/);
  });
  it("manual SOS is always critical", () => {
    expect(sosClassification("device_button").severity).toBe("critical");
    expect(sosClassification("attendee_app").reasonCodes).toContain("manual_sos");
  });
});

describe("decideHealthAction — dedupe, cooldown, upgrade", () => {
  const cls = (score: number, t = NOW): Classification => classifyHealth(health({ score, computedAt: t }), t, cfg);
  const step = (state: DeviceAlertState | null, score: number, t: number, id = `A${t}`) =>
    decideHealthAction(state, cls(score, t), { nowMs: t, assignmentId: "A-1", newAlertId: id, cfg });

  it("needs consecutive results, then creates once, then suppresses, then upgrades", () => {
    let r = step(null, 65, NOW);
    expect(r.action).toEqual({ kind: "none", reason: "building" });
    r = step(r.state, 65, NOW + 2000);
    expect(r.action.kind).toBe("create");
    const id = (r.action as { alertId: string }).alertId;
    r = step({ ...r.state, openEventId: "e" }, 62, NOW + 4000);
    expect(r.action).toEqual({ kind: "none", reason: "already_open" });
    r = step(r.state, 85, NOW + 6000);
    expect(r.action).toMatchObject({ kind: "upgrade", alertId: id, from: "danger", to: "critical" });
    r = step(r.state, 85, NOW + 8000);
    expect(r.action.kind).toBe("none");
  });

  it("ignores replayed / out-of-order records", () => {
    const r = step({ lastComputedAt: NOW + 5000, streakCount: 5, assignmentId: "A-1" }, 90, NOW + 1000);
    expect(r.action).toEqual({ kind: "none", reason: "replay" });
  });

  it("cooldown after acknowledgement suppresses same/lower severity only", () => {
    const acked: DeviceAlertState = { assignmentId: "A-1", streakCount: 1, cooldownUntil: NOW + 300_000, cooldownSeverity: "danger" };
    expect(step(acked, 65, NOW).action).toEqual({ kind: "none", reason: "cooldown" });
    expect(step(acked, 85, NOW).action.kind).toBe("create");
    expect(step({ ...acked, cooldownUntil: NOW - 1 }, 65, NOW).action.kind).toBe("create");
  });

  it("a new assignment resets the streak (no mixing of wearers)", () => {
    const r = decideHealthAction({ assignmentId: "A-old", streakCount: 9, lastComputedAt: NOW - 1000 }, cls(65), { nowMs: NOW, assignmentId: "A-1", newAlertId: "X", cfg });
    expect(r.action).toEqual({ kind: "none", reason: "building" });
  });
});

describe("selectVolunteers — Haversine routing", () => {
  const origin = { latitude: 6.98642, longitude: 79.909917 };
  const loc = { ...origin, fixAt: NOW - 5000 };
  const at = (m: number, bearing = 90) => offsetMeters(origin, m, bearing);
  const vol = (uid: string, p: { latitude: number; longitude: number } | null, over: Record<string, unknown> = {}) => ({
    uid,
    record: { onDuty: true, lat: p?.latitude ?? null, lng: p?.longitude ?? null, locationUpdatedAt: NOW - 10_000, ...over },
  });

  it("inside, outside and exactly on the radius", () => {
    const edge = at(50);
    const d = haversineMeters(origin, edge);
    const exact = mergeC2Config({ routing: { volunteerRadiusM: d } });
    const justBelow = mergeC2Config({ routing: { volunteerRadiusM: d - 0.001 } });
    expect(selectVolunteers([vol("edge", edge)], { severity: "danger", location: loc }, NOW, exact).selected).toHaveLength(1);
    expect(selectVolunteers([vol("edge", edge)], { severity: "danger", location: loc }, NOW, justBelow).selected).toHaveLength(0);
    const s = selectVolunteers([vol("in", at(30)), vol("out", at(80))], { severity: "critical", location: loc }, NOW, cfg);
    expect(s.selected.map((v) => v.uid)).toEqual(["in"]);
    expect(s.excluded.outOfRange).toBe(1);
  });

  it("excludes off-duty, missing, (0,0) and stale locations", () => {
    const s = selectVolunteers(
      [vol("off", at(10), { onDuty: false }), vol("none", null), vol("zero", { latitude: 0, longitude: 0 }), vol("stale", at(10), { locationUpdatedAt: NOW - 121_000 })],
      { severity: "critical", location: loc },
      NOW,
      cfg,
    );
    expect(s.selected).toHaveLength(0);
    expect(s.excluded).toEqual({ offDuty: 1, noLocation: 2, staleLocation: 1, outOfRange: 0 });
  });

  it("no volunteers for warnings, without a fix, or with a stale band fix", () => {
    expect(selectVolunteers([vol("a", at(5))], { severity: "warning", location: loc }, NOW, cfg).skippedReason).toBe("severity");
    expect(selectVolunteers([vol("a", at(5))], { severity: "critical", location: null }, NOW, cfg).skippedReason).toBe("no_device_fix");
    expect(selectVolunteers([vol("a", at(5))], { severity: "critical", location: { ...origin, fixAt: NOW - 61_000 } }, NOW, cfg).skippedReason).toBe("stale_device_fix");
  });
});

describe("predictTrend — watch list", () => {
  const series = (f: (i: number) => number, n = 12, stepMs = 10_000) => Array.from({ length: n }, (_, i) => ({ t: NOW - (n - 1 - i) * stepMs, s: f(i) }));
  it("rising series that will cross the warning cut-off → watch", () => {
    const r = predictTrend(series((i) => 20 + i * 1.5), NOW, cfg);
    expect(r.watch).toBe(true);
    expect(r.projectedScore!).toBeGreaterThanOrEqual(40);
  });
  it("flat, noisy, insufficient, short or already-alerting → no watch", () => {
    expect(predictTrend(series(() => 25), NOW, cfg).reason).toBe("not_rising");
    expect(predictTrend(series((i) => 20 + i + (i % 2 ? 25 : -25)), NOW, cfg).reason).toBe("noisy");
    expect(predictTrend(series((i) => 20 + i, 4), NOW, cfg).reason).toBe("insufficient");
    expect(predictTrend(series((i) => 20 + i, 10, 2000), NOW, cfg).reason).toBe("short_span");
    expect(predictTrend(series((i) => 35 + i), NOW, cfg).reason).toBe("already_alerting");
  });
});

describe("alert state machine", () => {
  it("escalation only from open; acknowledge from open or escalated", () => {
    expect(nextStatus("open", "escalate")).toBe("escalated");
    expect(nextStatus("escalated", "escalate")).toBeNull();
    expect(nextStatus("acknowledged", "escalate")).toBeNull();
    expect(nextStatus("resolved", "escalate")).toBeNull();
    expect(nextStatus("escalated", "acknowledge")).toBe("acknowledged");
    expect(nextStatus("escalated", "resolve")).toBeNull();
  });
});

describe("FakeSender", () => {
  it("scripts invalid and transient outcomes", async () => {
    const s = new FakeSender((token, attempt) =>
      token === "bad" ? { ok: false, invalidToken: true, transient: false } : token === "flaky" && attempt === 1 ? { ok: false, invalidToken: false, transient: true } : { ok: true, invalidToken: false, transient: false },
    );
    const r = await s.sendMany(["bad", "flaky", "ok"].map((token) => ({ token, title: "t", body: "b", data: {} })));
    expect(r.map((x) => x.ok)).toEqual([false, false, true]);
    expect((await s.sendMany([{ token: "flaky", title: "t", body: "b", data: {} }]))[0].ok).toBe(true);
  });
});
