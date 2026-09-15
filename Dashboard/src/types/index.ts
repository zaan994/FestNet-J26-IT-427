// Shared data contract (Backend/functions/src/shared) + dashboard-only view models.
export type * from "@shared/schema";

import type { DeviceIndexEntry, DeviceLatest, Role } from "@shared/schema";

/** A band as shown in the UI: index entry + live data + client-side online status. */
export interface BandView {
  deviceId: string;
  index: DeviceIndexEntry | null;
  latest: DeviceLatest | null;
  /** Client time (ms) when the latest snapshot last changed — works without device timestamps. */
  lastSeenAt: number | null;
  online: boolean;
}

export const DASHBOARD_ROLES: Role[] = ["organiser", "medical"];
