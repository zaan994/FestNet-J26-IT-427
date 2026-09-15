/**
 * Component 2 — Emergency Alert System (owner: Manubasha K.D.C.)
 *
 * FOUNDATION STATUS: logs every new alert so the band -> RTDB -> Functions pipeline
 * can be verified. C2 replaces the body with:
 *   - FCM dispatch to the medical team within 3 s (Warning / Danger / Critical urgency)
 *   - volunteer proximity query (shared/geo.ts haversineMeters, radius from thresholds)
 *   - auto-escalation when unacknowledged after `alertEscalationSec`
 */
import * as logger from "firebase-functions/logger";
import { onValueCreated } from "firebase-functions/v2/database";

import { DB_INSTANCE, REGION } from "../config/runtime";
import type { Alert } from "../shared";

export const onAlertCreated = onValueCreated(
  { ref: "/festnet/alerts/{alertId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const alert = event.data.val() as Alert;
    logger.info("New alert", {
      alertId: event.params.alertId,
      deviceId: alert.deviceId,
      source: alert.source,
      severity: alert.severity,
      types: alert.types ?? [],
    });
    // TODO(C2): dispatch, volunteer proximity, escalation.
  },
);
