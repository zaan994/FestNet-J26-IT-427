/**
 * Component 1 — Real-Time Health Monitoring (owner: Rizvi M.Z.M.)
 *
 * processRawChunk:   each raw chunk → derived health + explainable HRI (+ history, stats, HRI alert).
 * pruneHealthHistory: hourly cleanup of per-assignment history past its retention.
 *
 * Without the Blaze plan, run the same code locally: cd Backend/scripts && npm run worker
 */
import * as logger from "firebase-functions/logger";
import { onValueCreated } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { DB_INSTANCE, functionsContext, REGION } from "../config/runtime";
import { processRawChunk as processAndStore, pruneHistory } from "../health/store";
import type { RawChunk } from "../shared";

export const processRawChunk = onValueCreated(
  {
    ref: "/festnet/devices/{deviceId}/raw/{chunkId}",
    instance: DB_INSTANCE,
    region: REGION,
    // One chunk at a time keeps each band's chunks in order against one processor state.
    // Fine for a prototype; see docs/architecture/scaling.md for sharding at festival scale.
    maxInstances: 1,
    concurrency: 1,
  },
  async (event) => {
    const { deviceId, chunkId } = event.params;
    const chunk = event.data.val() as RawChunk | null;
    if (!chunk || typeof chunk.seq !== "number" || typeof chunk.t0UptimeMs !== "number") {
      logger.warn("Ignoring malformed raw chunk", { deviceId, chunkId });
      return;
    }
    const result = await processAndStore(functionsContext(), deviceId, chunk);
    if (result.skipped) logger.info("Skipped raw chunk", { deviceId, seq: chunk.seq, reason: result.skipped });
  },
);

export const pruneHealthHistory = onSchedule({ schedule: "every 60 minutes", region: REGION }, async () => {
  const removed = await pruneHistory(functionsContext());
  logger.info("Pruned health history", { removedAssignments: removed });
});
