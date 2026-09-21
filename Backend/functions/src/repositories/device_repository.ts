/** Typed admin-SDK access to devices/* (shared by all components' triggers). */
import { getDatabase } from "firebase-admin/database";

import { paths, type DeviceHealth, type DeviceLatest, type DeviceMeta } from "../shared";

export async function getDeviceLatest(deviceId: string): Promise<DeviceLatest | null> {
  const snap = await getDatabase().ref(paths.deviceLatest(deviceId)).get();
  return snap.exists() ? (snap.val() as DeviceLatest) : null;
}

/** Computed C1 health (vitals + anomaly state) of a band. */
export async function getDeviceHealth(deviceId: string): Promise<DeviceHealth | null> {
  const snap = await getDatabase().ref(paths.deviceHealth(deviceId)).get();
  return snap.exists() ? (snap.val() as DeviceHealth) : null;
}

export async function getDeviceMeta(deviceId: string): Promise<DeviceMeta | null> {
  const snap = await getDatabase().ref(paths.deviceMeta(deviceId)).get();
  return snap.exists() ? (snap.val() as DeviceMeta) : null;
}

/**
 * `latest` of every band in deviceIndex/. Reads each band's `latest` separately — never read
 * the whole devices/ node, it contains the raw signal chunks and history.
 */
export async function getAllLatest(): Promise<Record<string, DeviceLatest>> {
  const index = (await getDatabase().ref(paths.deviceIndex()).get()).val() as Record<string, unknown> | null;
  const ids = Object.keys(index ?? {});
  const entries = await Promise.all(ids.map(async (id) => [id, await getDeviceLatest(id)] as const));
  const result: Record<string, DeviceLatest> = {};
  for (const [id, latest] of entries) if (latest) result[id] = latest;
  return result;
}
