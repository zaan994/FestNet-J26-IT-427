import { equalTo, limitToLast, onValue, orderByChild, query, ref, set, type Unsubscribe } from "firebase/database";

import { db } from "@/config/firebase";
import type { Alert, DeviceHealth, DeviceIndexEntry, DeviceLatest, HistoryPoint } from "@/types";
import { paths } from "@shared/paths";

/** Computed vitals + anomaly state from the C1 backend processor. */
export function subscribeDeviceHealth(deviceId: string, cb: (health: DeviceHealth | null) => void): Unsubscribe {
  return onValue(ref(db, paths.deviceHealth(deviceId)), (snap) => cb(snap.val() as DeviceHealth | null));
}

export interface AlertWithId extends Alert {
  id: string;
}

/** Last `count` alerts of one band, newest first. */
export function subscribeDeviceAlerts(deviceId: string, count: number, cb: (alerts: AlertWithId[]) => void): Unsubscribe {
  const q = query(ref(db, paths.alerts()), orderByChild("deviceId"), equalTo(deviceId), limitToLast(count));
  return onValue(q, (snap) => {
    const alerts: AlertWithId[] = [];
    snap.forEach((child) => {
      alerts.push({ id: child.key as string, ...(child.val() as Alert) });
    });
    alerts.sort((a, b) => (b.serverCreatedAt ?? 0) - (a.serverCreatedAt ?? 0));
    cb(alerts);
  });
}

export function subscribeDeviceIndex(cb: (index: Record<string, DeviceIndexEntry>) => void): Unsubscribe {
  return onValue(ref(db, paths.deviceIndex()), (snap) => cb((snap.val() as Record<string, DeviceIndexEntry>) ?? {}));
}

export function subscribeDeviceLatest(deviceId: string, cb: (latest: DeviceLatest | null) => void): Unsubscribe {
  return onValue(ref(db, paths.deviceLatest(deviceId)), (snap) => cb(snap.val() as DeviceLatest | null));
}

/** Last `count` history points, oldest first. */
export function subscribeDeviceHistory(deviceId: string, count: number, cb: (points: HistoryPoint[]) => void): Unsubscribe {
  const q = query(ref(db, paths.deviceHistory(deviceId)), orderByChild("ts"), limitToLast(count));
  return onValue(q, (snap) => {
    const points: HistoryPoint[] = [];
    snap.forEach((child) => {
      points.push(child.val() as HistoryPoint);
    });
    cb(points);
  });
}

export function addDeviceToIndex(deviceId: string, label: string) {
  const entry: DeviceIndexEntry = { label: label || deviceId, addedAt: Date.now() };
  return set(ref(db, paths.deviceIndexEntry(deviceId)), entry);
}
