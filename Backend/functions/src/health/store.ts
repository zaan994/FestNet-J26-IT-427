/**
 * C1 — Firebase I/O around the pure processor.
 *
 *  1. Look up the band's ACTIVE assignment server-side (deviceIndex → assignments). The band never
 *     declares who is wearing it.
 *  2. Run processChunk (state is reset automatically when the assignment changes).
 *  3. Write atomically: processor state, devices/{id}/health, healthHistory/{assignmentId},
 *     assignmentStats/{assignmentId}.
 *  4. Create an automated HRI alert through the emergency service (idempotent, cooldown).
 *  5. Prune raw chunks older than the retention window.
 */
import { mergeHriConfig, paths, type Assignment, type DeviceRecord, type HriConfig, type RawChunk } from "../shared";
import { clean, SERVER_TIMESTAMP, type ServiceContext } from "../services/context";
import { createHriAlert } from "../services/emergencies";
import { HEALTH_CONFIG } from "./config";
import { processChunk, type AssignmentContext, type ProcessResult } from "./processor";
import { normalizeState } from "./state";

const CACHE_MS = 30_000;
let hriConfigCache: { value: HriConfig; at: number } | null = null;
const assignmentCache = new Map<string, { value: AssignmentContext | null; at: number }>();

export async function loadHriConfig(ctx: ServiceContext): Promise<HriConfig> {
  if (hriConfigCache && ctx.now() - hriConfigCache.at < CACHE_MS) return hriConfigCache.value;
  const value = mergeHriConfig((await ctx.db.ref(paths.hriConfig()).get()).val());
  hriConfigCache = { value, at: ctx.now() };
  return value;
}

/** Active assignment of a band (cached briefly; a return/reassign takes effect within 30 s at most). */
export async function activeAssignment(ctx: ServiceContext, deviceId: string): Promise<AssignmentContext | null> {
  const cached = assignmentCache.get(deviceId);
  if (cached && ctx.now() - cached.at < CACHE_MS) return cached.value;
  const device = (await ctx.db.ref(paths.deviceIndexEntry(deviceId)).get()).val() as DeviceRecord | null;
  let value: AssignmentContext | null = null;
  if (device?.currentAssignmentId) {
    const a = (await ctx.db.ref(paths.assignment(device.currentAssignmentId)).get()).val() as Assignment | null;
    if (a && a.status === "active" && a.deviceId === deviceId) {
      value = { assignmentId: a.assignmentId, eventId: a.eventId, participantId: a.participantId, demo: a.demo };
    }
  }
  assignmentCache.set(deviceId, { value, at: ctx.now() });
  return value;
}

/** Forget cached assignment data (call after assign/return in the same process). */
export function invalidateAssignmentCache(deviceId?: string) {
  if (deviceId) assignmentCache.delete(deviceId);
  else assignmentCache.clear();
}

/** Processes one raw chunk of `deviceId` and writes all outputs. */
export async function processRawChunk(ctx: ServiceContext, deviceId: string, chunk: RawChunk): Promise<ProcessResult> {
  const [stateSnap, hriConfig, assignment, droppedSnap] = await Promise.all([
    ctx.db.ref(paths.processingState(deviceId)).get(),
    loadHriConfig(ctx),
    activeAssignment(ctx, deviceId),
    ctx.db.ref(`${paths.deviceLatest(deviceId)}/raw/droppedChunks`).get(),
  ]);
  const dropped = droppedSnap.val();
  const result = processChunk(normalizeState(stateSnap.val()), {
    deviceId,
    chunk,
    hriConfig,
    assignment,
    droppedChunks: typeof dropped === "number" ? dropped : null,
    nowMs: ctx.now(),
  });
  if (result.skipped) return result;

  const updates: Record<string, unknown> = {
    [paths.processingState(deviceId)]: clean(result.state),
    [paths.deviceHealth(deviceId)]: clean({ ...result.health, updatedAt: SERVER_TIMESTAMP }),
  };
  if (result.history && assignment) {
    const key = ctx.db.ref(paths.healthHistory(assignment.assignmentId)).push().key;
    updates[`${paths.healthHistory(assignment.assignmentId)}/${key}`] = clean({ ...result.history, serverTs: SERVER_TIMESTAMP });
  }
  if (result.stats && assignment) updates[paths.assignmentStats(assignment.assignmentId)] = clean(result.stats);
  await ctx.db.ref().update(updates);

  if (result.hriAlert) {
    try {
      await createHriAlert(ctx, result.hriAlert);
    } catch (err) {
      // Not silently discarded: logged; the idempotency key lets the next chunk retry safely.
      ctx.log("error", "HRI alert creation failed", { deviceId, error: String(err) });
    }
  }
  if (result.pruneRaw) {
    try {
      await pruneRaw(ctx, deviceId);
    } catch (err) {
      ctx.log("warn", "raw pruning failed (is the serverTs index deployed?)", { deviceId, error: String(err) });
    }
  }
  return result;
}

/** Deletes raw chunks older than HEALTH_CONFIG.rawRetentionMs (server time). */
export async function pruneRaw(ctx: ServiceContext, deviceId: string): Promise<number> {
  const cutoff = ctx.now() - HEALTH_CONFIG.rawRetentionMs;
  const snap = await ctx.db.ref(paths.deviceRaw(deviceId)).orderByChild("serverTs").endAt(cutoff).limitToFirst(500).get();
  const removals: Record<string, null> = {};
  snap.forEach((child) => {
    removals[child.key as string] = null;
  });
  const count = Object.keys(removals).length;
  if (count) await ctx.db.ref(paths.deviceRaw(deviceId)).update(removals);
  return count;
}

/** Deletes per-assignment history older than HEALTH_CONFIG.historyRetentionMs. Bounded per run. */
export async function pruneHistory(ctx: ServiceContext): Promise<number> {
  const cutoff = ctx.now() - HEALTH_CONFIG.historyRetentionMs;
  const assignments = await ctx.db.ref(paths.assignments()).orderByChild("endedAt").endAt(cutoff).limitToFirst(200).get();
  let total = 0;
  const ids: string[] = [];
  assignments.forEach((child) => {
    const a = child.val() as Assignment;
    if (a.status !== "active" && a.endedAt) ids.push(a.assignmentId);
  });
  for (const id of ids) {
    const snap = await ctx.db.ref(paths.healthHistory(id)).limitToFirst(1).get();
    if (snap.exists()) {
      await ctx.db.ref(paths.healthHistory(id)).remove();
      total++;
    }
  }
  return total;
}
