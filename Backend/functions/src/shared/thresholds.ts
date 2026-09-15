import type { Thresholds } from "./schema";

/**
 * Default thresholds from the TAF. Mirrors the firmware sketch constants and
 * MobileApp/lib/core/constants/thresholds.dart. Runtime overrides live in
 * config/thresholds (written by `npm run admin -- config`).
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  bpmSpikeDelta: 30,
  bpmSpikeWindowSec: 90,
  spo2Low: 94,
  spo2Critical: 90,
  coreTempHighC: 38.0,
  stillnessTimeoutSec: 30,
  alertEscalationSec: 120,
  volunteerRadiusM: 50,
  surgeSpeedMps: 1.5,
  surgeZoneRadiusM: 20,
  surgeMinBands: 5,
  deviceOfflineAfterSec: 15, // current sketch uploads every 5 s; allow a few missed uploads
};
