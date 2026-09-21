import { useEffect, useMemo, useState } from "react";

import { subscribeDeviceHealth, subscribeDeviceIndex, subscribeDeviceLatest } from "@/services/deviceService";
import type { BandView, DeviceHealth, DeviceIndexEntry, DeviceLatest } from "@/types";
import { DEFAULT_THRESHOLDS } from "@shared/thresholds";

import { useNow } from "./useNow";

interface LatestEntry {
  latest: DeviceLatest | null;
  receivedAt: number | null;
}

/**
 * All bands in deviceIndex/ with their live `latest` snapshot.
 * Online = a new snapshot arrived within deviceOfflineAfterSec (client receive time,
 * so it works even though the current firmware sends no wall-clock timestamp).
 */
export function useBands(offlineAfterSec = DEFAULT_THRESHOLDS.deviceOfflineAfterSec) {
  const [index, setIndex] = useState<Record<string, DeviceIndexEntry> | null>(null);
  const [latest, setLatest] = useState<Record<string, LatestEntry>>({});
  const [health, setHealth] = useState<Record<string, DeviceHealth | null>>({});
  const now = useNow(1000);

  useEffect(() => subscribeDeviceIndex(setIndex), []);

  const deviceIds = useMemo(() => Object.keys(index ?? {}).sort(), [index]);

  useEffect(() => {
    const unsubs = deviceIds.map((id) => {
      let initial = true;
      return subscribeDeviceLatest(id, (value) => {
        // The first callback is the stored value, not a fresh upload: don't count it as "seen now".
        const receivedAt = initial ? null : Date.now();
        initial = false;
        setLatest((prev) => ({
          ...prev,
          [id]: { latest: value, receivedAt: receivedAt ?? prev[id]?.receivedAt ?? null },
        }));
      });
    });
    const healthUnsubs = deviceIds.map((id) =>
      subscribeDeviceHealth(id, (value) => setHealth((prev) => ({ ...prev, [id]: value }))),
    );
    return () => [...unsubs, ...healthUnsubs].forEach((u) => u());
  }, [deviceIds]);

  const bands: BandView[] = deviceIds.map((deviceId) => {
    const entry = latest[deviceId];
    const lastSeenAt = entry?.receivedAt ?? null;
    return {
      deviceId,
      index: index?.[deviceId] ?? null,
      latest: entry?.latest ?? null,
      health: health[deviceId] ?? null,
      lastSeenAt,
      online: lastSeenAt !== null && now - lastSeenAt < offlineAfterSec * 1000,
    };
  });

  return { bands, loading: index === null };
}
