/** Device inventory (deviceIndex/{deviceId}). deviceAdmin only — no health history access implied. */
import { paths, type DeviceInventoryStatus, type DeviceRecord } from "../shared";
import { requireGlobalRole } from "./access";
import { audit } from "./audit";
import { clean, conflict, notFound, type ServiceContext } from "./context";
import { DEVICE_ID_PATTERN } from "./ids";
import { allowOnly, bool, oneOf, str, type Payload } from "./validate";

export async function registerDevice(ctx: ServiceContext, uid: string, p: Payload) {
  await requireGlobalRole(ctx, uid, "deviceAdmin");
  allowOnly(p, ["deviceId", "label", "demo"]);
  const deviceId = str(p, "deviceId", { pattern: DEVICE_ID_PATTERN }).toUpperCase();
  const label = str(p, "label", { max: 60, optional: true });
  const demo = bool(p, "demo", false);

  const ref = ctx.db.ref(paths.deviceIndexEntry(deviceId));
  const tx = await ref.transaction((current: DeviceRecord | null) => {
    if (current && current.inventoryStatus) return undefined; // already registered → abort
    return clean({
      ...(current ?? {}),
      label: label ?? current?.label ?? deviceId,
      addedAt: current?.addedAt ?? ctx.now(),
      inventoryStatus: "available",
      currentAssignmentId: null,
      currentEventId: null,
      currentParticipantId: null,
      demo,
      updatedAt: ctx.now(),
    });
  });
  if (!tx.committed) throw conflict(`Device ${deviceId} is already registered.`);
  await audit(ctx, "global", "device_registered", uid, deviceId, { demo });
  return { deviceId };
}

const SETTABLE: readonly DeviceInventoryStatus[] = ["available", "maintenance", "retired"];

export async function updateDevice(ctx: ServiceContext, uid: string, p: Payload) {
  await requireGlobalRole(ctx, uid, "deviceAdmin");
  allowOnly(p, ["deviceId", "label", "inventoryStatus", "zone", "notes"]);
  const deviceId = str(p, "deviceId", { pattern: DEVICE_ID_PATTERN });
  const status = oneOf(p, "inventoryStatus", SETTABLE, true);
  const label = str(p, "label", { max: 60, optional: true });
  const zone = str(p, "zone", { max: 40, optional: true });
  const notes = str(p, "notes", { max: 300, optional: true });

  const ref = ctx.db.ref(paths.deviceIndexEntry(deviceId));
  let reason = "";
  const tx = await ref.transaction((current: DeviceRecord | null) => {
    // The first run may see null from an empty local cache: write a no-op null so the server
    // re-runs us with the real value; existence is checked on the committed snapshot below.
    if (!current) return null;
    if (status && current.currentAssignmentId) {
      reason = "assigned";
      return undefined;
    }
    return clean({
      ...current,
      ...(label ? { label } : {}),
      ...(status ? { inventoryStatus: status } : {}),
      ...(zone !== null ? { zone } : {}),
      ...(notes !== null ? { notes } : {}),
      updatedAt: ctx.now(),
    });
  });
  if (!tx.committed && reason === "assigned") {
    throw conflict("Return the device from its active assignment before changing its status.");
  }
  if (!tx.snapshot.exists()) throw notFound(`Device ${deviceId} is not registered.`);
  await audit(ctx, "global", "device_updated", uid, deviceId, { inventoryStatus: status, zone });
  return { deviceId };
}
