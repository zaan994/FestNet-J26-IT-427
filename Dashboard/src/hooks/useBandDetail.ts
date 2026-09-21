import { useEffect, useState } from "react";

import {
  subscribeDeviceAlerts,
  subscribeDeviceHistory,
  type AlertWithId,
} from "@/services/deviceService";
import type { HistoryPoint } from "@/types";

/** Last `count` computed history points (10 s apart), oldest first. */
export function useBandHistory(deviceId: string, count: number) {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  useEffect(() => {
    setPoints(null);
    return subscribeDeviceHistory(deviceId, count, setPoints);
  }, [deviceId, count]);
  return points;
}

/** Most recent alerts of a band, newest first. */
export function useBandAlerts(deviceId: string, count = 20) {
  const [alerts, setAlerts] = useState<AlertWithId[] | null>(null);
  useEffect(() => subscribeDeviceAlerts(deviceId, count, setAlerts), [deviceId, count]);
  return alerts;
}
