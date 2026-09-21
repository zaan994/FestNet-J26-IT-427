/**
 * C1 — Firebase I/O around the pure processor: load state, process a raw chunk, write
 * health / history / alerts atomically, prune old raw chunks.
 *
 * The Database is passed in (not imported) so the same code runs inside Cloud Functions
 * and inside the local processor script, which has its own firebase-admin instance.
 * Only a type is imported from firebase-admin, so nothing loads at runtime.
 */
import type { Database } from "firebase-admin/database";

import { DEFAULT_THRESHOLDS, paths, type DeviceLatest, type RawChunk, type Thresholds } from "../shared";
import { HEALTH_CONFIG } from "./config";
import { processChunk, type ProcessResult } from "./processor";
import { normalizeState } from "./state";

const SERVER_TIMESTAMP = { ".sv": "timestamp" } as const;
const THRESHOLDS_CACHE_MS = 60_000;

let thresholdsCache: { value: Thresholds; at: number } | null = null;

/** config/thresholds merged over the defaults, cached for a minute. */
export async function loadThresholds(db: Database): Promise<Thresholds> {
  if (thresholdsCache && Date.now() - thresholdsCache.at < THRESHOLDS_CACHE_MS) return thresholdsCache.value;
  const snap = await db.ref(paths.thresholds()).get();
  const value = { ...DEFAULT_THRESHOLDS, ...((snap.val() as Partial<Thresholds> | null) ?? {}) };
  thresholdsCache = { value, at: Date.now() };
  return value;
}

/** Drops undefined (RTDB rejects it) and turns NaN into null. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Processes one raw chunk of `deviceId` and writes all outputs in one atomic update. */
export async function processRawChunk(db: Database, deviceId: string, chunk: RawChunk): Promise<ProcessResult> {
  const [stateSnap, thresholds] = await Promise.all([
    db.ref(paths.processingState(deviceId)).get(),
    loadThresholds(db),
  ]);
  const result = processChunk(normalizeState(stateSnap.val()), {
    deviceId,
    chunk,
    thresholds,
    nowMs: Date.now(),
  });
  if (result.skipped) return result;

  const updates: Record<string, unknown> = {
    [paths.processingState(deviceId)]: clean(result.state),
    [paths.deviceHealth(deviceId)]: clean({ ...result.health, updatedAt: SERVER_TIMESTAMP }),
  };

  if (result.history) {
    const key = db.ref(paths.deviceHistory(deviceId)).push().key;
    updates[`${paths.deviceHistory(deviceId)}/${key}`] = clean({ ...result.history, serverTs: SERVER_TIMESTAMP });
  }

  if (result.alert) {
    const latest = (await db.ref(paths.deviceLatest(deviceId)).get()).val() as DeviceLatest | null;
    const gps = latest?.gps;
    const location =
      gps?.fix && typeof gps.latitude === "number" && typeof gps.longitude === "number"
        ? { latitude: gps.latitude, longitude: gps.longitude }
        : null;
    const key = db.ref(paths.alerts()).push().key;
    updates[`${paths.alerts()}/${key}`] = clean({ ...result.alert, location, serverCreatedAt: SERVER_TIMESTAMP });
  }

  await db.ref().update(updates);

  if (result.pruneRaw) await pruneRaw(db, deviceId);
  return result;
}

/** Deletes raw chunks older than HEALTH_CONFIG.rawRetentionMs (server time). */
export async function pruneRaw(db: Database, deviceId: string): Promise<number> {
  const cutoff = Date.now() - HEALTH_CONFIG.rawRetentionMs;
  const snap = await db.ref(paths.deviceRaw(deviceId)).orderByChild("serverTs").endAt(cutoff).limitToFirst(500).get();
  const removals: Record<string, null> = {};
  snap.forEach((child) => {
    removals[child.key as string] = null;
  });
  const count = Object.keys(removals).length;
  if (count) await db.ref(paths.deviceRaw(deviceId)).update(removals);
  return count;
}

/** Deletes computed history older than HEALTH_CONFIG.historyRetentionMs for every band. */
export async function pruneHistory(db: Database): Promise<number> {
  const index = (await db.ref(paths.deviceIndex()).get()).val() as Record<string, unknown> | null;
  const cutoff = Date.now() - HEALTH_CONFIG.historyRetentionMs;
  let total = 0;
  for (const deviceId of Object.keys(index ?? {})) {
    const snap = await db.ref(paths.deviceHistory(deviceId)).orderByChild("ts").endAt(cutoff).limitToFirst(1000).get();
    const removals: Record<string, null> = {};
    snap.forEach((child) => {
      removals[child.key as string] = null;
    });
    const count = Object.keys(removals).length;
    if (count) await db.ref(paths.deviceHistory(deviceId)).update(removals);
    total += count;
  }
  return total;
}
