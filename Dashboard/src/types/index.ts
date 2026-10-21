// Shared data contract (Backend/functions/src/shared) + dashboard-only view models.
export type * from "@shared/schema";
export type { ParsedLatest, Freshness } from "@shared/telemetry";

import type { DeviceHealth } from "@shared/schema";
import type { ParsedLatest } from "@shared/telemetry";

/** Live view of one band: parsed latest telemetry + derived health + client receive time. */
export interface DeviceLive {
  deviceId: string;
  latest: ParsedLatest | null;
  health: DeviceHealth | null;
  /** Client time the latest telemetry last CHANGED (the cached value on subscribe does not count). */
  receivedAt: number | null;
  /** Permission or network error for this device, if any. */
  error: string | null;
}
