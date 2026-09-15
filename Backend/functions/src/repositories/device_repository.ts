/** Typed admin-SDK access to devices/* (shared by all components' triggers). */
import { getDatabase } from "firebase-admin/database";

import { paths, type DeviceLatest, type DeviceMeta } from "../shared";

export async function getDeviceLatest(deviceId: string): Promise<DeviceLatest | null> {
  const snap = await getDatabase().ref(paths.deviceLatest(deviceId)).get();
  return snap.exists() ? (snap.val() as DeviceLatest) : null;
}

export async function getDeviceMeta(deviceId: string): Promise<DeviceMeta | null> {
  const snap = await getDatabase().ref(paths.deviceMeta(deviceId)).get();
  return snap.exists() ? (snap.val() as DeviceMeta) : null;
}

export async function getAllLatest(): Promise<Record<string, DeviceLatest>> {
  const snap = await getDatabase().ref(paths.devices()).get();
  const result: Record<string, DeviceLatest> = {};
  snap.forEach((child) => {
    const latest = child.child("latest").val() as DeviceLatest | null;
    if (latest && child.key) result[child.key] = latest;
  });
  return result;
}
