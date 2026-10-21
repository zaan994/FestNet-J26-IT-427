/**
 * C2 integration tests against the Realtime Database emulator, with a FakeSender and an injected
 * clock (no real waiting, no real push). Run from Backend/functions: npm run test:emulator
 */
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetC2ConfigCache } from "../../src/c2/config-store";
import { escalateDue } from "../../src/c2/escalation";
import { evaluateHealth } from "../../src/c2/health";
import { FakeSender } from "../../src/c2/sender";
import type { ServiceContext } from "../../src/services/context";
import { handleDeviceSos, transitionEmergency } from "../../src/services/emergencies";
import { offsetMeters, paths, type DeviceHealth, type Emergency } from "../../src/shared";

const EVENT = "fest-c2-aaaa";
const ASSIGNMENT = { assignmentId: "A-C2TEST01", eventId: EVENT, participantId: "P-AAAAAAAA", demo: false };
const ORIGIN = { latitude: 6.98642, longitude: 79.909917 };
let app: App;
let db: Database;
let clock = 1_790_000_000_000;
let sender: FakeSender;
let ctx: ServiceContext;

beforeAll(() => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error("Run via `npm run test:emulator` (needs the RTDB emulator).");
  app = initializeApp({ projectId: "demo-festnet", databaseURL: "https://demo-festnet-default-rtdb.firebaseio.com" }, "c2-test");
  db = getDatabase(app);
});
afterAll(async () => app && deleteApp(app));

beforeEach(async () => {
  clock = 1_790_000_000_000;
  resetC2ConfigCache();
  sender = new FakeSender((token) => (token.startsWith("bad") ? { ok: false, invalidToken: true, transient: false } : { ok: true, invalidToken: false, transient: false }));
  ctx = { db, now: () => clock, log: () => {}, sender };
  const near = offsetMeters(ORIGIN, 20, 45);
  const far = offsetMeters(ORIGIN, 400, 45);
  const token = (t: string) => ({ token: t, platform: "web", updatedAt: clock });
  await db.ref("festnet").set({
    eventStaff: { [EVENT]: { op: "eventOperator", med: "medicalResponder", sec: "secondaryResponder" } },
    eventVolunteers: { [EVENT]: { volNear: true, volFar: true } },
    events: { [EVENT]: { eventId: EVENT, name: "C2", status: "active", demo: false } },
    deviceIndex: { FESTNET_001: { inventoryStatus: "assigned", currentAssignmentId: ASSIGNMENT.assignmentId, currentEventId: EVENT } },
    assignments: { [ASSIGNMENT.assignmentId]: { ...ASSIGNMENT, deviceId: "FESTNET_001", status: "active", startedAt: clock - 60_000 } },
    devices: { FESTNET_001: { latest: { deviceId: "FESTNET_001", serverTs: clock, gps: { fix: true, latitude: ORIGIN.latitude, longitude: ORIGIN.longitude } }, meta: { lastBootServerTs: clock - 600_000 } } },
    emergency: {
      responders: {
        med: { tokens: { a: token("tok-med-aaaaaaaa"), b: token("bad-med-bbbbbbbb") } },
        op: { tokens: { a: token("tok-op-aaaaaaaa") } },
        sec: { tokens: { a: token("tok-sec-aaaaaaaa") } },
        volNear: { onDuty: true, lat: near.latitude, lng: near.longitude, locationUpdatedAt: clock - 5000, tokens: { a: token("tok-vnear-aaaaaa") } },
        volFar: { onDuty: true, lat: far.latitude, lng: far.longitude, locationUpdatedAt: clock - 5000, tokens: { a: token("tok-vfar-aaaaaaa") } },
      },
    },
  });
});

function health(score: number | null, opts: { bpm?: number | null; quality?: "valid" | "unavailable" } = {}): DeviceHealth {
  return {
    deviceId: "FESTNET_001",
    assignmentId: ASSIGNMENT.assignmentId,
    eventId: EVENT,
    seq: Math.floor(clock / 2000),
    computedAt: clock,
    measuredAt: clock - 400,
    worn: true,
    heartRate: { bpm: opts.bpm ?? 80, quality: opts.quality ?? "valid", beats: 3, method: "t" },
    spo2: { quality: "unavailable", validated: false, displayEnabled: false, note: "" },
    hrv: { ibiCount: 0, windowSec: 60, quality: "unavailable" },
    temperature: { surfaceC: 33 },
    activity: { level: "rest", stillSec: 0, impactDetected: false },
    signal: { ppgSamples: 200, ppgExpected: 200, imuSamples: 100, imuExpected: 100, ppgOverflow: 0, flags: [], clockSynced: true },
    hri: {
      hriScore: score,
      status: score === null ? "insufficient_data" : score >= 60 ? "high" : "elevated",
      confidence: { level: "high", value: 0.9 },
      calculatedAt: clock,
      window: { fromMs: null, toMs: null, seconds: 60 },
      availableInputs: [],
      missingInputs: [],
      contributingFactors: [],
      dataQuality: { flags: [], notes: [] },
      baselineAvailable: true,
      algorithmVersion: "t",
      configVersion: "t",
      experimental: true,
      validated: false,
    },
    latency: {},
  };
}

const alerts = async () => Object.values(((await db.ref(paths.emergencies(EVENT)).get()).val() as Record<string, Emergency> | null) ?? {});
const tick = (ms = 2000) => (clock += ms);

describe("health anomaly → alert", () => {
  it("one danger alert after the threshold persists, routed to medical, operators and the nearby volunteer only", async () => {
    await evaluateHealth(ctx, "FESTNET_001", health(65), ASSIGNMENT);
    expect(await alerts()).toHaveLength(0); // first result only builds the streak
    tick();
    await evaluateHealth(ctx, "FESTNET_001", health(65), ASSIGNMENT);
    tick();
    await evaluateHealth(ctx, "FESTNET_001", health(66), ASSIGNMENT); // still open → no duplicate
    const list = await alerts();
    expect(list).toHaveLength(1);
    const a = list[0];
    expect(a.severity).toBe("danger");
    expect(a.reasonCodes).toContain("hri_danger");
    expect(a.dispatchedAt).not.toBeNull();
    expect(a.latencyFromReceiptMs).toBeGreaterThanOrEqual(0);
    const tokens = sender.sent.map((m) => m.token).sort();
    expect(tokens).toEqual(["bad-med-bbbbbbbb", "tok-med-aaaaaaaa", "tok-op-aaaaaaaa", "tok-vnear-aaaaaa"]);
    expect((await db.ref(paths.inboxEntry("volNear", a.alertId)).get()).exists()).toBe(true);
    expect((await db.ref(paths.inboxEntry("volFar", a.alertId)).get()).exists()).toBe(false);
    // The invalid token was removed, the responder record and the valid token were kept.
    const medTokens = (await db.ref(`${paths.responder("med")}/tokens`).get()).val();
    expect(Object.keys(medTokens)).toEqual(["a"]);
  });

  it("a higher severity upgrades the same alert and notifies again", async () => {
    await evaluateHealth(ctx, "FESTNET_001", health(65), ASSIGNMENT);
    tick();
    await evaluateHealth(ctx, "FESTNET_001", health(65), ASSIGNMENT);
    const before = sender.sent.length;
    tick();
    await evaluateHealth(ctx, "FESTNET_001", health(85), ASSIGNMENT);
    const list = await alerts();
    expect(list).toHaveLength(1);
    expect(list[0].severity).toBe("critical");
    expect(list[0].upgradedFrom).toBe("danger");
    expect(sender.sent.length).toBeGreaterThan(before);
  });

  it("data without a usable metric never creates a physiological alert", async () => {
    for (let i = 0; i < 4; i++) {
      await evaluateHealth(ctx, "FESTNET_001", health(null, { bpm: 190, quality: "unavailable" }), ASSIGNMENT);
      tick();
    }
    expect(await alerts()).toHaveLength(0);
  });

  it("duplicate delivery of the same record does not create or notify twice", async () => {
    await evaluateHealth(ctx, "FESTNET_001", health(70), ASSIGNMENT);
    tick();
    const h = health(70);
    await Promise.all([evaluateHealth(ctx, "FESTNET_001", h, ASSIGNMENT), evaluateHealth(ctx, "FESTNET_001", h, ASSIGNMENT)]);
    expect(await alerts()).toHaveLength(1);
    expect(new Set(sender.sent.map((m) => m.token)).size).toBe(sender.sent.length);
  });
});

describe("SOS, acknowledgement and escalation", () => {
  it("SOS → one critical alert even while an anomaly alert is open; duplicates suppressed", async () => {
    await evaluateHealth(ctx, "FESTNET_001", health(65), ASSIGNMENT);
    tick();
    await evaluateHealth(ctx, "FESTNET_001", health(65), ASSIGNMENT);
    await handleDeviceSos(ctx, "FESTNET_001", 1);
    await handleDeviceSos(ctx, "FESTNET_001", 1);
    const sos = (await alerts()).filter((a) => a.type === "sos");
    expect(sos).toHaveLength(1);
    expect(sos[0].severity).toBe("critical");
    expect(sos[0].priority).toBe("P1");
  });

  it("escalates exactly once after the timeout, to secondary responders", async () => {
    await handleDeviceSos(ctx, "FESTNET_001", 1);
    const [a] = await alerts();
    tick(119_000);
    expect(await escalateDue(ctx)).toEqual([]); // not due yet
    tick(2_000);
    const runs = await Promise.all([escalateDue(ctx), escalateDue(ctx)]);
    expect(runs.flat()).toEqual([a.alertId]);
    const after = (await db.ref(paths.emergency(EVENT, a.alertId)).get()).val() as Emergency;
    expect(after.status).toBe("escalated");
    expect(after.escalationLevel).toBe(1);
    expect(sender.sent.some((m) => m.token === "tok-sec-aaaaaaaa" && m.data.phase === "escalation")).toBe(true);
    tick(60_000);
    expect(await escalateDue(ctx)).toEqual([]);
  });

  it("acknowledged alerts are never escalated, and identity comes from the caller", async () => {
    await handleDeviceSos(ctx, "FESTNET_001", 1);
    const [a] = await alerts();
    await transitionEmergency(ctx, "med", "acknowledge", { eventId: EVENT, alertId: a.alertId });
    tick(300_000);
    expect(await escalateDue(ctx)).toEqual([]);
    const after = (await db.ref(paths.emergency(EVENT, a.alertId)).get()).val() as Emergency;
    expect(after.acknowledgedBy).toBe("med");
    expect((await db.ref(paths.openAlert(a.alertId)).get()).exists()).toBe(false);
    expect((await db.ref(`${paths.inboxEntry("med", a.alertId)}/status`).get()).val()).toBe("acknowledged");
  });

  it("volunteers may accept only alerts they were sent", async () => {
    await handleDeviceSos(ctx, "FESTNET_001", 1);
    const [a] = await alerts();
    await expect(transitionEmergency(ctx, "volFar", "acknowledge", { eventId: EVENT, alertId: a.alertId })).rejects.toThrow(/sent to you/);
    await expect(transitionEmergency(ctx, "volNear", "resolve", { eventId: EVENT, alertId: a.alertId, note: "x" })).rejects.toThrow(/sent to you/);
    await transitionEmergency(ctx, "volNear", "acknowledge", { eventId: EVENT, alertId: a.alertId });
    expect(((await db.ref(paths.emergency(EVENT, a.alertId)).get()).val() as Emergency).acknowledgedBy).toBe("volNear");
  });
});
