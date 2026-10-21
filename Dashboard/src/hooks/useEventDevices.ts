import { useMemo } from "react";

import type { Thresholds } from "@/types";
import { toDeviceRow } from "@/utils/deviceRow";
import { mergeC2Config } from "@shared/c2Config";
import { mergeHriConfig } from "@shared/hriConfig";
import { paths } from "@shared/paths";
import { DEFAULT_THRESHOLDS } from "@shared/thresholds";

import { useDevicesLive, useEventAssignments } from "./useEventData";
import { useNow } from "./useNow";
import { useRealtimeValue } from "./useRealtimeValue";

export { toDeviceRow, type EventDeviceRow } from "@/utils/deviceRow";

export function useThresholds(): Thresholds {
  const { data } = useRealtimeValue<Partial<Thresholds>>(paths.thresholds());
  return useMemo(() => ({ ...DEFAULT_THRESHOLDS, ...(data ?? {}) }), [data]);
}

/** Live HRI configuration (config/hri merged over the defaults). */
export function useHriConfig() {
  const { data } = useRealtimeValue<unknown>(paths.hriConfig());
  return useMemo(() => mergeHriConfig(data), [data]);
}

/** Live C2 alert configuration (config/c2 merged over the defaults). */
export function useC2Config() {
  const { data } = useRealtimeValue<unknown>(paths.c2Config());
  return useMemo(() => mergeC2Config(data), [data]);
}

/** Active assignments of one event joined with live band data (bounded by the assignment count). */
export function useEventDevices(eventId: string | null) {
  const assignments = useEventAssignments(eventId, "active");
  const deviceIds = useMemo(() => assignments.data.map((a) => a.deviceId), [assignments.data]);
  const live = useDevicesLive(deviceIds);
  const thresholds = useThresholds();
  const now = useNow(1000);
  const rows = useMemo(
    () => assignments.data.map((a) => toDeviceRow(a, live[a.deviceId], now, thresholds)),
    [assignments.data, live, now, thresholds],
  );
  return { rows, loading: assignments.loading, error: assignments.error, now, thresholds };
}
