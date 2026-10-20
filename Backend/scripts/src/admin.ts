/**
 * FestNet admin CLI (service account — run on a trusted machine only).
 *
 *   npm run admin config                                        thresholds + editable HRI config (experimental)
 *   npm run admin user email=a@b.c password=secret name=Ann     create / update a staff login (no role)
 *   npm run admin role email=a@b.c role=deviceAdmin             grant a GLOBAL role (deviceAdmin | researchAdmin)
 *   npm run admin role email=a@b.c role=researchAdmin enabled=false     revoke it
 *   npm run admin staff email=a@b.c event=<eventId> role=medicalResponder   per-event role (eventOperator | medicalResponder)
 *   npm run admin device id=FESTNET_001 email=band-001@festnet.dev [password=pw] [label="Band 1"]
 *   npm run admin spo2 enabled=true                             show the UNVALIDATED SpO2 estimate (research only)
 *   npm run admin migrate                                      legacy foundation roles + inventory → new model
 *   npm run admin demo email=<your staff email>                 DEMO ONLY event, participants, SIM devices
 *   npm run admin list
 *
 * Day-to-day actions (events, devices, assignments, alerts) are done in the dashboard and executed
 * by the backend (Cloud Functions or `npm run worker`). This CLI bootstraps the first deviceAdmin.
 */
import type { DataSnapshot } from "firebase-admin/database";

import {
  DEFAULT_HRI_CONFIG,
  DEFAULT_THRESHOLDS,
  GLOBAL_ROLES,
  paths,
  type DeviceRecord,
  type EventPublicInfo,
  type FestEvent,
  type GlobalRole,
  type Participant,
  type UserProfile,
} from "../../functions/src/shared";
import { newEventId, newParticipantId } from "../../functions/src/services/ids";
import { parseCli, requireValue } from "./args";
import { auth, db, target } from "./firebase";

const cli = parseCli(["email", "password", "name", "role", "id", "label", "event", "enabled", "uid"] as const);
const { positionals, values } = cli;
const required = (name: keyof typeof values) => requireValue(cli, name);

async function getOrCreateAuthUser(email: string, password?: string, displayName?: string) {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  auth user exists: ${existing.uid}`);
    return existing;
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    if (!password) {
      console.error(`User ${email} does not exist — add password=... to create it.`);
      process.exit(1);
    }
    const created = await auth.createUser({ email, password, displayName });
    console.log(`  auth user created: ${created.uid}`);
    return created;
  }
}

async function resolveUid(): Promise<string> {
  if (values.uid) return values.uid;
  return (await getOrCreateAuthUser(required("email"))).uid;
}

async function seedConfig() {
  await db.ref(paths.thresholds()).set(DEFAULT_THRESHOLDS);
  const existing = await db.ref(paths.hriConfig()).get();
  if (!existing.exists()) await db.ref(paths.hriConfig()).set(DEFAULT_HRI_CONFIG);
  console.log("Wrote config/thresholds" + (existing.exists() ? " (config/hri already exists — left unchanged)" : " and config/hri (EXPERIMENTAL defaults)"));
}

/** Research switch: show the UNVALIDATED SpO2 estimate in the apps (never used in the HRI). */
async function setSpo2Display() {
  const enabled = required("enabled") === "true";
  await db.ref(`${paths.hriConfig()}/spo2/displayEnabled`).set(enabled);
  await db.ref(paths.auditLog("global")).push({ action: "spo2_display_changed", by: "admin-cli", at: Date.now(), target: "config/hri", details: { enabled } });
  console.log(`config/hri/spo2/displayEnabled = ${enabled} (picked up by the backend within ~30 s; values stay labelled "unvalidated")`);
}

async function createUser() {
  const email = required("email");
  const displayName = values.name ?? email.split("@")[0];
  const user = await getOrCreateAuthUser(email, values.password, displayName);
  const ref = db.ref(paths.user(user.uid));
  const existing = (await ref.get()).val() as UserProfile | null;
  await ref.update({ displayName, email, createdAt: existing?.createdAt ?? Date.now() });
  console.log(`users/${user.uid} ready. Grant access with: npm run admin role|staff ...`);
}

async function setRole() {
  const role = required("role") as GlobalRole;
  if (!GLOBAL_ROLES.includes(role)) {
    console.error(`role must be one of ${GLOBAL_ROLES.join(", ")} (event roles: use "staff")`);
    process.exit(1);
  }
  const uid = await resolveUid();
  const enabled = values.enabled !== "false";
  await db.ref(`${paths.roles(uid)}/${role}`).set(enabled ? true : null);
  await db.ref(paths.auditLog("global")).push({ action: enabled ? "global_role_granted" : "global_role_revoked", by: "admin-cli", at: Date.now(), target: uid, details: { role } });
  console.log(`roles/${uid}/${role} = ${enabled}`);
}

async function setStaff() {
  const eventId = required("event");
  const role = required("role");
  if (role !== "eventOperator" && role !== "medicalResponder") {
    console.error("role must be eventOperator or medicalResponder");
    process.exit(1);
  }
  if (!(await db.ref(paths.event(eventId)).get()).exists()) {
    console.error(`Event ${eventId} not found.`);
    process.exit(1);
  }
  const uid = await resolveUid();
  await db.ref().update({ [`${paths.eventStaff(eventId)}/${uid}`]: role, [`${paths.staffEvents(uid)}/${eventId}`]: role });
  await db.ref(paths.auditLog(eventId)).push({ action: "staff_role_set", by: "admin-cli", at: Date.now(), target: uid, details: { role } });
  console.log(`eventStaff/${eventId}/${uid} = ${role}`);
}

async function registerDevice() {
  const deviceId = required("id").toUpperCase();
  const email = required("email");
  const user = await getOrCreateAuthUser(email, values.password, deviceId);
  const label = values.label ?? deviceId;
  await db.ref(paths.deviceAuth(user.uid)).set(deviceId);
  await db.ref(paths.deviceIndexEntry(deviceId)).transaction((current: DeviceRecord | null) => ({
    ...(current ?? {}),
    label: current?.label ?? label,
    addedAt: current?.addedAt ?? Date.now(),
    inventoryStatus: current?.inventoryStatus ?? "available",
    updatedAt: Date.now(),
  }));
  await db.ref(paths.auditLog("global")).push({ action: "device_registered", by: "admin-cli", at: Date.now(), target: deviceId, details: null });
  console.log(`deviceAuth/${user.uid} -> ${deviceId}; deviceIndex/${deviceId} registered`);
}

/** Foundation build → new model. Idempotent. */
async function migrate() {
  const users = ((await db.ref(paths.users()).get()).val() as Record<string, UserProfile> | null) ?? {};
  for (const [uid, u] of Object.entries(users)) {
    if (u.role === "organiser") {
      await db.ref(`${paths.roles(uid)}/deviceAdmin`).set(true);
      console.log(`  ${uid}: organiser → deviceAdmin (add them to events as eventOperator from the dashboard)`);
    } else if (u.role === "medical") {
      console.log(`  ${uid}: medical → add per event: npm run admin staff uid=${uid} event=<id> role=medicalResponder`);
    }
  }
  const index = ((await db.ref(paths.deviceIndex()).get()).val() as Record<string, DeviceRecord> | null) ?? {};
  for (const [id, d] of Object.entries(index)) {
    if (!d.inventoryStatus) {
      await db.ref(`${paths.deviceIndexEntry(id)}/inventoryStatus`).set("available");
      console.log(`  ${id}: inventoryStatus = available`);
    }
  }
  console.log("Legacy nodes not used any more (safe to delete after checking): festnet/alerts, devices/*/history, events/demo-event.");
}

/** DEMO ONLY data, clearly labelled, separate from production events. */
async function demo() {
  const uid = await resolveUid();
  const now = Date.now();
  const eventId = newEventId("demo-festival");
  const event: FestEvent = {
    eventId,
    name: "DEMO ONLY — FestNet Demo Festival",
    status: "active",
    venue: "DEMO venue",
    startTs: now,
    endTs: now + 12 * 3600_000,
    demo: true,
    zones: { "gate-a": { name: "Gate A", type: "gate" }, "med-1": { name: "Medical tent 1", type: "medical" }, stage: { name: "Main stage", type: "stage" } },
    createdAt: now,
    createdBy: uid,
  };
  const publicInfo: EventPublicInfo = {
    name: event.name,
    status: "active",
    demo: true,
    helpPoints: { h0: { name: "Medical tent 1 (DEMO)", description: "Next to Gate A", zone: "med-1" } },
    safetyInfo: ["DEMO ONLY: this is sample safety information.", "Drink water regularly.", "If you feel unwell, go to a help point or press SOS."],
    contact: "DEMO contact — replace with the real event contact",
    dataRetention: "DEMO: derived health history is kept for 30 days, raw signals for 5 minutes.",
  };
  const participants: Record<string, Participant> = {};
  for (let i = 0; i < 3; i++) {
    const id = newParticipantId();
    participants[id] = { participantId: id, eventId, createdAt: now, createdBy: uid, demo: true, researchConsent: i === 0, consentRecordedAt: i === 0 ? now : null, attendeeUid: null, activeAssignmentId: null };
  }
  const updates: Record<string, unknown> = {
    [paths.event(eventId)]: event,
    [paths.eventPublic(eventId)]: publicInfo,
    [`${paths.eventStaff(eventId)}/${uid}`]: "eventOperator",
    [`${paths.staffEvents(uid)}/${eventId}`]: "eventOperator",
    [paths.participants(eventId)]: participants,
  };
  for (const sim of ["SIM_001", "SIM_002", "SIM_003"]) {
    updates[paths.deviceIndexEntry(sim)] = { label: `DEMO ${sim}`, addedAt: now, inventoryStatus: "available", demo: true, updatedAt: now };
  }
  await db.ref().update(updates);
  console.log(`DEMO ONLY event created: ${eventId}`);
  console.log(`  you (${uid}) are its eventOperator; participants: ${Object.keys(participants).join(", ")}`);
  console.log("  demo devices SIM_001..SIM_003 registered. Assign them in the dashboard, then run: npm run simulate");
}

async function list() {
  const [users, index, deviceAuth, roles] = await Promise.all([
    db.ref(paths.users()).get(),
    db.ref(paths.deviceIndex()).get(),
    db.ref("festnet/deviceAuth").get(),
    db.ref(paths.allRoles()).get(),
  ]);
  console.log("Users:");
  users.forEach((u: DataSnapshot) => {
    const v = u.val() as UserProfile;
    const r = Object.keys((roles.child(u.key as string).val() as Record<string, boolean> | null) ?? {}).join(",") || "-";
    console.log(`  ${u.key}  ${v.email ?? ""}  global=${r}${v.role ? `  (legacy role: ${v.role})` : ""}`);
  });
  console.log("Device logins:");
  deviceAuth.forEach((d: DataSnapshot) => {
    console.log(`  ${d.key} -> ${d.val()}`);
  });
  console.log("Inventory:");
  const ago = (ms: unknown) => (typeof ms === "number" ? `${Math.round((Date.now() - ms) / 1000)} s ago` : "never");
  const items = (index.val() as Record<string, DeviceRecord> | null) ?? {};
  for (const [id, d] of Object.entries(items).sort()) {
    const serverTs = (await db.ref(`${paths.deviceLatest(id)}/serverTs`).get()).val();
    console.log(`  ${id}  ${d.inventoryStatus ?? "unregistered"}${d.currentAssignmentId ? ` (${d.currentAssignmentId} @ ${d.currentEventId})` : ""}  last upload ${ago(serverTs)}${d.demo ? "  [DEMO]" : ""}`);
  }
}

const COMMANDS: Record<string, () => Promise<void>> = { config: seedConfig, user: createUser, spo2: setSpo2Display, role: setRole, staff: setStaff, device: registerDevice, migrate, demo, list };

async function main() {
  console.log(`[festnet-admin] target: ${target}`);
  const command = COMMANDS[positionals[0] ?? ""];
  if (!command) return console.log(`Commands: ${Object.keys(COMMANDS).join(" | ")}   (see header of src/admin.ts)`);
  await command();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
