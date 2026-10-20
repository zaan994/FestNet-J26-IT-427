/**
 * Security-rules tests (Firebase Emulator required): cross-user and cross-event denial.
 * Run from Backend/functions:  npm run test:emulator
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { get, ref, serverTimestamp, set } from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const E1 = "ev-one-aaaa";
const E2 = "ev-two-bbbb";

const SEED = {
  roles: { admin: { deviceAdmin: true }, researcher: { researchAdmin: true } },
  eventStaff: { [E1]: { opA: "eventOperator", medB: "medicalResponder" }, [E2]: { opC: "eventOperator" } },
  deviceAuth: { band1: "FESTNET_001", band2: "FESTNET_002" },
  deviceIndex: {
    FESTNET_001: { inventoryStatus: "assigned", currentEventId: E1, currentAssignmentId: "A-1" },
    FESTNET_002: { inventoryStatus: "assigned", currentEventId: E2, currentAssignmentId: "A-2" },
  },
  devices: {
    FESTNET_001: { latest: { deviceId: "FESTNET_001" }, health: { deviceId: "FESTNET_001", seq: 1 } },
    FESTNET_002: { latest: { deviceId: "FESTNET_002" }, health: { deviceId: "FESTNET_002", seq: 1 } },
  },
  events: { [E1]: { eventId: E1, name: "One" }, [E2]: { eventId: E2, name: "Two" } },
  eventsPublic: { [E1]: { name: "One" } },
  participants: { [E1]: { "P-AAAAAAAA": { participantId: "P-AAAAAAAA" } }, [E2]: { "P-BBBBBBBB": { participantId: "P-BBBBBBBB" } } },
  assignments: { "A-1": { eventId: E1, deviceId: "FESTNET_001" }, "A-2": { eventId: E2, deviceId: "FESTNET_002" } },
  attendeeLinks: {
    att1: { deviceId: "FESTNET_001", assignmentId: "A-1", eventId: E1, participantId: "P-AAAAAAAA" },
    att2: { deviceId: "FESTNET_002", assignmentId: "A-2", eventId: E2, participantId: "P-BBBBBBBB" },
  },
  healthHistory: { "A-1": { h1: { ts: 1 } }, "A-2": { h1: { ts: 1 } } },
  emergencies: { [E1]: { x1: { alertId: "x1" } }, [E2]: { x2: { alertId: "x2" } }, _unassigned: { x3: { alertId: "x3" } } },
  auditLog: { [E1]: { a: { action: "t" } }, global: { a: { action: "t" } } },
  researchExports: { r1: { exportId: "r1" } },
};

let env: RulesTestEnvironment;
const db = (uid: string | null) => (uid ? env.authenticatedContext(uid).database() : env.unauthenticatedContext().database());
const read = (uid: string | null, path: string) => get(ref(db(uid), `festnet/${path}`));
const write = (uid: string | null, path: string, value: unknown) => set(ref(db(uid), `festnet/${path}`), value);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-festnet",
    database: { rules: readFileSync(resolve(__dirname, "../../../database.rules.json"), "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => set(ref(ctx.database(), "festnet"), SEED));
});

describe("default deny", () => {
  it("unauthenticated users read nothing", async () => {
    await assertFails(read(null, "devices/FESTNET_001/latest"));
    await assertFails(read(null, "eventsPublic/" + E1));
    await assertFails(read(null, ""));
  });
  it("nobody reads the whole tree or raw signals", async () => {
    await assertFails(read("admin", ""));
    await assertFails(read("opA", "devices/FESTNET_001/raw"));
  });
});

describe("attendee isolation", () => {
  it("reads only their own device, health and history", async () => {
    await assertSucceeds(read("att1", "devices/FESTNET_001/health"));
    await assertSucceeds(read("att1", "healthHistory/A-1"));
    await assertSucceeds(read("att1", "attendeeLinks/att1"));
    await assertFails(read("att1", "devices/FESTNET_002/health"));
    await assertFails(read("att1", "healthHistory/A-2"));
    await assertFails(read("att1", "attendeeLinks/att2"));
  });
  it("cannot read staff data or other attendees", async () => {
    await assertFails(read("att1", `emergencies/${E1}`));
    await assertFails(read("att1", `participants/${E1}`));
    await assertFails(read("att1", "deviceIndex"));
  });
  it("cannot grant itself access or roles", async () => {
    await assertFails(write("att1", "attendeeLinks/att1", { deviceId: "FESTNET_002" }));
    await assertFails(write("att1", "roles/att1/deviceAdmin", true));
    await assertFails(write("att1", "users/att1", { displayName: "x", role: "organiser" }));
    await assertSucceeds(write("att1", "users/att1", { displayName: "Me" }));
  });
});

describe("event staff isolation", () => {
  it("operators read their event only", async () => {
    await assertSucceeds(read("opA", "devices/FESTNET_001/health"));
    await assertSucceeds(read("opA", `emergencies/${E1}`));
    await assertSucceeds(read("opA", "healthHistory/A-1"));
    await assertFails(read("opA", "devices/FESTNET_002/health"));
    await assertFails(read("opA", `emergencies/${E2}`));
    await assertFails(read("opA", "healthHistory/A-2"));
    await assertFails(read("opA", `participants/${E2}`));
    await assertFails(read("opA", `events/${E2}`));
  });
  it("medical responders see alerts but not the operator audit log", async () => {
    await assertSucceeds(read("medB", `emergencies/${E1}`));
    await assertFails(read("medB", `auditLog/${E1}`));
    await assertSucceeds(read("opA", `auditLog/${E1}`));
  });
  it("staff cannot write alerts or assignments directly", async () => {
    await assertFails(write("opA", `emergencies/${E1}/x1/status`, "resolved"));
    await assertFails(write("opA", "assignments/A-1/status", "returned"));
    await assertFails(write("opA", "deviceIndex/FESTNET_001/currentEventId", E2));
  });
});

describe("global roles are least-privilege", () => {
  it("deviceAdmin manages inventory but gets no health data", async () => {
    await assertSucceeds(read("admin", "deviceIndex"));
    await assertSucceeds(read("admin", "devices/FESTNET_001/latest"));
    await assertSucceeds(read("admin", "emergencies/_unassigned"));
    await assertFails(read("admin", "devices/FESTNET_001/health"));
    await assertFails(read("admin", "healthHistory/A-1"));
  });
  it("researchAdmin reads exports, not live health", async () => {
    await assertSucceeds(read("researcher", "researchExports"));
    await assertFails(read("researcher", "devices/FESTNET_001/health"));
    await assertFails(read("researcher", `emergencies/${E1}`));
  });
});

describe("bands", () => {
  it("write only their own node with a matching deviceId", async () => {
    await assertSucceeds(write("band1", "devices/FESTNET_001/latest", { deviceId: "FESTNET_001" }));
    await assertFails(write("band1", "devices/FESTNET_001/latest", { deviceId: "FESTNET_002" }));
    await assertFails(write("band1", "devices/FESTNET_002/latest", { deviceId: "FESTNET_002" }));
    await assertSucceeds(write("band1", "devices/FESTNET_001/raw/c1", { seq: 1, t0UptimeMs: 0, durationMs: 2000 }));
    await assertFails(write("band1", "devices/FESTNET_001/health", { seq: 1 }));
    await assertFails(read("band1", "devices/FESTNET_001/health"));
  });
});

describe("request queues", () => {
  it("commands: create own, never set results", async () => {
    await assertSucceeds(write("opA", "commands/opA/c1", { type: "createParticipant", payload: { eventId: E1 }, createdAt: serverTimestamp() }));
    await assertFails(write("opA", "commands/opA/c2", { type: "x", payload: {}, createdAt: serverTimestamp(), status: "ok" }));
    await assertFails(write("opA", "commands/medB/c3", { type: "x", payload: {}, createdAt: serverTimestamp() }));
    await assertFails(write("opA", "commands/opA/c1", { type: "y", payload: {}, createdAt: serverTimestamp() })); // overwrite
  });
  it("SOS requests: create own, cannot forge status or the _active pointer", async () => {
    await assertSucceeds(write("att1", "sosRequests/att1/r1", { clientCreatedAt: 1, createdAt: serverTimestamp() }));
    await assertFails(write("att1", "sosRequests/att1/_active", { clientCreatedAt: 1, createdAt: serverTimestamp() }));
    await assertFails(write("att1", "sosRequests/att1/r2", { clientCreatedAt: 1, createdAt: serverTimestamp(), status: "received" }));
    await assertFails(write("att1", "sosRequests/att2/r3", { clientCreatedAt: 1, createdAt: serverTimestamp() }));
  });
});
