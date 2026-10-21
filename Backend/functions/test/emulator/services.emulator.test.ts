/**
 * Service integration tests against the Realtime Database emulator (Admin SDK, rules bypassed —
 * these test the server-side checks). Run from Backend/functions:  npm run test:emulator
 */
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { assignDevice, issueClaimCode, redeemClaim, returnDevice } from "../../src/services/assignments";
import type { ServiceContext } from "../../src/services/context";
import { createEmergency, handleDeviceSos, transitionEmergency } from "../../src/services/emergencies";
import { paths, type DeviceRecord, type Emergency } from "../../src/shared";

const EVENT = "fest-test-aaaa";
const OTHER = "fest-other-bbbb";
let app: App;
let db: Database;
let ctx: ServiceContext;

beforeAll(() => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error("Run via `npm run test:emulator` (needs the RTDB emulator).");
  app = initializeApp({ projectId: "demo-festnet", databaseURL: "https://demo-festnet-default-rtdb.firebaseio.com" }, "services-test");
  db = getDatabase(app);
  ctx = { db, now: () => Date.now(), log: () => {} };
});
afterAll(async () => app && deleteApp(app));

beforeEach(async () => {
  await db.ref("festnet").set({
    roles: { admin: { deviceAdmin: true } },
    eventStaff: { [EVENT]: { op: "eventOperator", med: "medicalResponder" }, [OTHER]: { opOther: "eventOperator" } },
    events: { [EVENT]: { eventId: EVENT, name: "Test", status: "active", demo: true }, [OTHER]: { eventId: OTHER, name: "Other", status: "active", demo: true } },
    deviceIndex: {
      FESTNET_001: { inventoryStatus: "available", label: "1" },
      FESTNET_002: { inventoryStatus: "available", label: "2" },
      FESTNET_009: { inventoryStatus: "maintenance", label: "9" },
    },
    participants: {
      [EVENT]: {
        "P-AAAAAAAA": { participantId: "P-AAAAAAAA", eventId: EVENT, researchConsent: false, demo: true },
        "P-BBBBBBBB": { participantId: "P-BBBBBBBB", eventId: EVENT, researchConsent: false, demo: true },
      },
    },
  });
});

const SOS = {
  type: "sos" as const,
  source: "device_button" as const,
  eventId: EVENT,
  reasons: ["t"],
  demo: true,
  severity: "critical" as const,
  reasonCodes: ["manual_sos"],
  receivedAt: Date.now(),
};

const assign = (uid: string, deviceId: string, participantId: string, eventId = EVENT) => assignDevice(ctx, uid, { eventId, deviceId, participantId });

describe("assignment workflow", () => {
  it("assigns, prevents duplicates, returns and reassigns", async () => {
    const { assignmentId } = await assign("op", "FESTNET_001", "P-AAAAAAAA");
    const device = (await db.ref(paths.deviceIndexEntry("FESTNET_001")).get()).val() as DeviceRecord;
    expect(device.inventoryStatus).toBe("assigned");
    expect(device.currentAssignmentId).toBe(assignmentId);

    await expect(assign("op", "FESTNET_001", "P-BBBBBBBB")).rejects.toThrow(/active assignment/); // device busy
    await expect(assign("op", "FESTNET_002", "P-AAAAAAAA")).rejects.toThrow(/already has an active device/); // participant busy
    // The failed second lock must have rolled back FESTNET_002.
    expect(((await db.ref(paths.deviceIndexEntry("FESTNET_002")).get()).val() as DeviceRecord).inventoryStatus).toBe("available");

    await returnDevice(ctx, "op", { assignmentId, condition: "ok" });
    expect(((await db.ref(paths.deviceIndexEntry("FESTNET_001")).get()).val() as DeviceRecord).currentAssignmentId ?? null).toBeNull();
    expect((await db.ref(`${paths.assignment(assignmentId)}/status`).get()).val()).toBe("returned");
    await expect(returnDevice(ctx, "op", { assignmentId, condition: "ok" })).rejects.toThrow(/already returned/);

    const second = await assign("op", "FESTNET_001", "P-BBBBBBBB");
    expect(second.assignmentId).not.toBe(assignmentId);
  });

  it("concurrent assignment of one device succeeds exactly once", async () => {
    const results = await Promise.allSettled([assign("op", "FESTNET_001", "P-AAAAAAAA"), assign("op", "FESTNET_001", "P-BBBBBBBB")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("denies other events' staff, medical responders and unavailable devices", async () => {
    await expect(assign("opOther", "FESTNET_001", "P-AAAAAAAA")).rejects.toThrow(/Requires/);
    await expect(assign("med", "FESTNET_001", "P-AAAAAAAA")).rejects.toThrow(/Requires/);
    await expect(assign("op", "FESTNET_009", "P-AAAAAAAA")).rejects.toThrow(/maintenance/);
  });

  it("returning to maintenance blocks reuse", async () => {
    const { assignmentId } = await assign("op", "FESTNET_001", "P-AAAAAAAA");
    await returnDevice(ctx, "op", { assignmentId, condition: "maintenance" });
    await expect(assign("op", "FESTNET_001", "P-BBBBBBBB")).rejects.toThrow(/maintenance/);
  });
});

describe("claim codes", () => {
  it("link exactly one attendee, once, and are revoked on return", async () => {
    const { assignmentId } = await assign("op", "FESTNET_001", "P-AAAAAAAA");
    const { code } = (await issueClaimCode(ctx, "op", { assignmentId })) as { code: string };
    await db.ref(`${paths.claimRequests("att1")}/r1`).set({ code, createdAt: Date.now() });
    await redeemClaim(ctx, "att1", "r1", code);
    expect((await db.ref(paths.attendeeLink("att1")).get()).val()).toMatchObject({ deviceId: "FESTNET_001", assignmentId });

    await db.ref(`${paths.claimRequests("att2")}/r1`).set({ code, createdAt: Date.now() });
    await redeemClaim(ctx, "att2", "r1", code);
    expect((await db.ref(`${paths.claimRequests("att2")}/r1/status`).get()).val()).toBe("rejected");
    expect((await db.ref(paths.attendeeLink("att2")).get()).exists()).toBe(false);

    await returnDevice(ctx, "op", { assignmentId, condition: "ok" });
    expect((await db.ref(paths.attendeeLink("att1")).get()).exists()).toBe(false);
  });
});

describe("SOS and alert lifecycle", () => {
  it("band SOS is idempotent per press and survives without an assignment", async () => {
    await db.ref(paths.deviceMeta("FESTNET_001")).set({ lastBootServerTs: 1_760_000_000_000 });
    await handleDeviceSos(ctx, "FESTNET_001", 1);
    await handleDeviceSos(ctx, "FESTNET_001", 1); // duplicate trigger
    const unassigned = (await db.ref(paths.emergencies("_unassigned")).get()).val() as Record<string, Emergency>;
    expect(Object.values(unassigned)).toHaveLength(1);
    expect(Object.values(unassigned)[0].priority).toBe("P1");
    await handleDeviceSos(ctx, "FESTNET_001", 2); // new press
    expect(Object.keys((await db.ref(paths.emergencies("_unassigned")).get()).val())).toHaveLength(2);
  });

  it("concurrent creation with one key yields one alert", async () => {
    const draft = { ...SOS, idempotencyKey: "k-1" };
    await Promise.all([createEmergency(ctx, draft), createEmergency(ctx, draft), createEmergency(ctx, draft)]);
    expect(Object.keys((await db.ref(paths.emergencies(EVENT)).get()).val())).toHaveLength(1);
  });

  it("enforces roles, transitions and audit", async () => {
    const { alertId } = await createEmergency(ctx, { ...SOS, idempotencyKey: "k-2" });
    // Not staff of this event and not a recipient → denied.
    await expect(transitionEmergency(ctx, "opOther", "acknowledge", { eventId: EVENT, alertId })).rejects.toThrow(/sent to you/);
    await expect(transitionEmergency(ctx, "med", "resolve", { eventId: EVENT, alertId, note: "x" })).rejects.toThrow(/Cannot resolve/);
    await transitionEmergency(ctx, "med", "acknowledge", { eventId: EVENT, alertId });
    await transitionEmergency(ctx, "med", "assignResponder", { eventId: EVENT, alertId, responderUid: "med", responderName: "Medic 1" });
    await transitionEmergency(ctx, "med", "markInProgress", { eventId: EVENT, alertId });
    await expect(transitionEmergency(ctx, "med", "resolve", { eventId: EVENT, alertId })).rejects.toThrow(/note/);
    await transitionEmergency(ctx, "med", "resolve", { eventId: EVENT, alertId, note: "Treated at tent 2" });
    await transitionEmergency(ctx, "op", "reopen", { eventId: EVENT, alertId, note: "Returned" });
    const audit = (await db.ref(paths.emergencyAudit(EVENT, alertId)).get()).val() as Record<string, { action: string }>;
    // "notified" entries are written by C2 dispatch; the lifecycle order is what matters here.
    expect(Object.values(audit).map((a) => a.action).filter((a) => a !== "notified")).toEqual(["created", "acknowledged", "responder_assigned", "in_progress", "resolved", "reopened"]);
  });
});

describe("bounded history queries", () => {
  it("time-window + limit returns only the requested slice", async () => {
    const ref = db.ref(paths.healthHistory("A-TEST"));
    await Promise.all(Array.from({ length: 50 }, (_, i) => ref.push({ ts: 1000 + i * 10_000, hriStatus: "low" })));
    const last10 = await ref.orderByChild("ts").limitToLast(10).get();
    expect(last10.numChildren()).toBe(10);
    const windowed = await ref.orderByChild("ts").startAt(1000 + 40 * 10_000).get();
    expect(windowed.numChildren()).toBe(10);
  });
});
