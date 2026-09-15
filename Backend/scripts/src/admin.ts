/**
 * FestNet admin CLI.
 *
 *   npm run admin -- config                                   write default thresholds + demo event
 *   npm run admin -- user   --email a@b.c --password pw --name "Ann" --role organiser
 *   npm run admin -- device --id FESTNET_001 --email band-001@festnet.dev [--password pw] [--label "Band 1"]
 *   npm run admin -- list
 *
 * `device` links a Firebase Auth account to a band (deviceAuth/{uid} = deviceId) so the
 * security rules let that band write devices/{deviceId}/*. If the account already
 * exists (e.g. the account in the Arduino sketch) it is linked, not re-created.
 * It also adds the band to deviceIndex/ so the dashboard lists it.
 */
import { parseArgs } from "node:util";

import type { DataSnapshot } from "firebase-admin/database";

import { DEFAULT_THRESHOLDS, paths, type FestEvent, type Role, type UserProfile } from "../../functions/src/shared";
import { auth, db, target } from "./firebase";

const ROLES: Role[] = ["participant", "volunteer", "medical", "organiser"];
const DEMO_CENTER = { latitude: 6.9147, longitude: 79.9729 }; // SLIIT Malabe

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
    role: { type: "string" },
    id: { type: "string" },
    label: { type: "string" },
  },
});

type Option = "email" | "password" | "name" | "role" | "id" | "label";

function required(name: Option): string {
  const value = values[name];
  if (typeof value !== "string" || value === "") {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return value;
}

async function getOrCreateAuthUser(email: string, password?: string, displayName?: string) {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  auth user exists: ${existing.uid}`);
    return existing;
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    if (!password) {
      console.error(`User ${email} does not exist — pass --password to create it.`);
      process.exit(1);
    }
    const created = await auth.createUser({ email, password, displayName });
    console.log(`  auth user created: ${created.uid}`);
    return created;
  }
}

async function seedConfig() {
  await db.ref(paths.thresholds()).set(DEFAULT_THRESHOLDS);
  const now = Date.now();
  const demoEvent: FestEvent = {
    name: "Demo Festival",
    startTs: now,
    endTs: now + 12 * 3600_000,
    center: DEMO_CENTER,
  };
  await db.ref(paths.event("demo-event")).update(demoEvent);
  console.log("Wrote config/thresholds and events/demo-event");
}

async function createUser() {
  const email = required("email");
  const name = values.name ?? email.split("@")[0];
  const role = (values.role ?? "participant") as Role;
  if (!ROLES.includes(role)) {
    console.error(`--role must be one of ${ROLES.join(", ")}`);
    process.exit(1);
  }
  const user = await getOrCreateAuthUser(email, values.password, name);
  const ref = db.ref(paths.user(user.uid));
  const existing = (await ref.get()).val() as Partial<UserProfile> | null;
  await ref.update({ name, email, role, createdAt: existing?.createdAt ?? Date.now() });
  console.log(`users/${user.uid} -> role=${role}`);
}

async function registerDevice() {
  const deviceId = required("id");
  const email = required("email");
  const user = await getOrCreateAuthUser(email, values.password, deviceId);
  const label = values.label ?? deviceId;
  await db.ref(paths.deviceAuth(user.uid)).set(deviceId);
  await db.ref(paths.deviceIndexEntry(deviceId)).update({ label, addedAt: Date.now() });
  await db.ref(paths.deviceMeta(deviceId)).update({ label, eventId: "demo-event" });
  console.log(`deviceAuth/${user.uid} -> ${deviceId}`);
}

async function list() {
  const [users, devices, deviceAuth] = await Promise.all([
    db.ref(paths.users()).get(),
    db.ref(paths.devices()).get(),
    db.ref("festnet/deviceAuth").get(),
  ]);
  console.log("Users:");
  users.forEach((u: DataSnapshot) => {
    const v = u.val() as UserProfile;
    console.log(`  ${u.key}  ${v.role.padEnd(11)} ${v.email}  device=${v.deviceId ?? "-"}`);
  });
  console.log("Device logins:");
  deviceAuth.forEach((d: DataSnapshot) => {
    console.log(`  ${d.key} -> ${d.val()}`);
  });
  console.log("Devices:");
  devices.forEach((d: DataSnapshot) => {
    const latest = d.child("latest").val();
    const age = latest?.serverTs ? `${Math.round((Date.now() - latest.serverTs) / 1000)} s ago` : "never";
    console.log(`  ${d.key}  last update ${age}`);
  });
}

async function main() {
  console.log(`[festnet-admin] target: ${target}`);
  switch (positionals[0]) {
    case "config": return seedConfig();
    case "user": return createUser();
    case "device": return registerDevice();
    case "list": return list();
    default:
      console.log("Commands: config | user | device | list   (see header of src/admin.ts)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
