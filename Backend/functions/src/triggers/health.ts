/**
 * Component 1 — Real-Time Health Monitoring (owner: Rizvi M.Z.M.)
 *
 * processRawChunk:  every raw chunk the band pushes -> BPM, SpO2, HRV, stress, core temp,
 *                   fall / stillness, anomalies -> devices/{id}/health, history, alerts.
 * pruneHealthHistory: hourly cleanup of computed history older than 24 h.
 *
 * Without the Blaze plan, run the same processing locally instead:
 *   cd Backend/scripts && npm run process
 */
import { getDatabase } from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import { onValueCreated } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { DB_INSTANCE, REGION } from "../config/runtime";
import { processRawChunk as processChunkAndStore, pruneHistory } from "../health";
import type { RawChunk } from "../shared";

export const processRawChunk = onValueCreated(
  {
    ref: "/festnet/devices/{deviceId}/raw/{chunkId}",
    instance: DB_INSTANCE,
    region: REGION,
    // One chunk at a time, so each band's chunks are processed in order against a
    // consistent processor state. Fine for prototype scale (a few bands).
    maxInstances: 1,
    concurrency: 1,
  },
  async (event) => {
    const { deviceId, chunkId } = event.params;
    const chunk = event.data.val() as RawChunk | null;
    if (!chunk || typeof chunk.seq !== "number") {
      logger.warn("Ignoring malformed raw chunk", { deviceId, chunkId });
      return;
    }
    const result = await processChunkAndStore(getDatabase(), deviceId, chunk);
    if (result.skipped) {
      logger.info("Skipped raw chunk", { deviceId, seq: chunk.seq, reason: result.skipped });
    } else if (result.alert) {
      logger.info("Anomaly alert", { deviceId, severity: result.alert.severity, types: result.alert.types });
    }
  },
);

export const pruneHealthHistory = onSchedule({ schedule: "every 60 minutes", region: REGION }, async () => {
  const removed = await pruneHistory(getDatabase());
  logger.info("Pruned health history", { removed });
});
