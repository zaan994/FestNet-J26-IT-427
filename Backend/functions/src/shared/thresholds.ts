import type { Thresholds } from "./schema";

/**
 * Application thresholds (freshness only). Clinical / HRI rules live in shared/hriConfig.ts
 * and are explicitly experimental. Runtime overrides: config/thresholds.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  /** A band is "stale" after this long without a new `latest` upload (uploads every ~2 s). */
  deviceOfflineAfterSec: 15,
  /** A GPS position older than this is shown as stale and never used as a "current" location. */
  gpsStaleAfterSec: 60,
};
