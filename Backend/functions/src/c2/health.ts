/**
 * C2 — consumes C1's derived health record right after C1 writes it (same host, no extra trigger,
 * no re-read of raw chunks) and turns it into alerts and watch-list entries.
 *
 *   classify (pure) → device-state transaction (dedupe / cooldown / upgrade, pure decide)
 *   → create alert (durable) or upgrade it → notifications → watch list.
 * C2 never writes back into devices/*, so it cannot retrigger C1 processing.
 */
import { paths, SEVERITY_RANK, type DeviceHealth, type Emergency, type EmergencyAuditEntry } from "../shared";
import { clean, type ServiceContext } from "../services/context";
import { createEmergency, currentBandLocation } from "../services/emergencies";
import { classifyHealth } from "./classify";
import { loadC2Config } from "./config-store";
import { decideHealthAction, type DeviceAlertState, type HealthAction } from "./decide";
import { dispatchAlert } from "./dispatch";
import { predictTrend } from "./predict";

export interface HealthAssignment {
  assignmentId: string;
  eventId: string;
  participantId: string;
  demo: boolean;
}

export async function evaluateHealth(ctx: ServiceContext, deviceId: string, health: DeviceHealth, assignment: HealthAssignment | null): Promise<HealthAction | null> {
  // Alerts are tied to an assignment (event + participant); unassigned bands only raise SOS.
  if (!assignment) return null;
  const cfg = await loadC2Config(ctx);
  const receivedAt = ctx.now();
  const cls = classifyHealth(health, receivedAt, cfg);
  const newAlertId = ctx.db.ref(paths.emergencies(assignment.eventId)).push().key as string;

  let action: HealthAction = { kind: "none", reason: "no_anomaly" };
  let finalState: DeviceAlertState | null = null;
  await ctx.db.ref(paths.deviceAlertState(deviceId)).transaction((cur: DeviceAlertState | null) => {
    const r = decideHealthAction(cur, cls, { nowMs: receivedAt, assignmentId: assignment.assignmentId, newAlertId, cfg });
    action = r.action;
    finalState = r.state;
    if (r.action.kind === "none" && r.action.reason === "replay") return undefined;
    if (r.action.kind === "create") r.state.openEventId = assignment.eventId;
    return clean(r.state);
  });

  const act = action as HealthAction;
  if (act.kind === "create") {
    const source = cls.reasonCodes.some((c) => c.startsWith("hri_")) ? "hri_engine" : "heart_rate";
    const location = await currentBandLocation(ctx, deviceId);
    await createEmergency(ctx, {
      alertId: act.alertId,
      idempotencyKey: `c2-health-${deviceId}-${act.alertId}`,
      type: "hri",
      source,
      eventId: assignment.eventId,
      deviceId,
      assignmentId: assignment.assignmentId,
      participantId: assignment.participantId,
      reasons: [cls.summary || "Health anomaly detected", ...(location ? [] : ["No current GPS fix from the band."])],
      measuredAt: cls.contributing.measuredAt,
      location,
      hri: cls.contributing.hriScore !== null ? { score: cls.contributing.hriScore, status: health.hri.status, confidence: health.hri.confidence.level } : null,
      demo: assignment.demo,
      severity: act.severity,
      reasonCodes: cls.reasonCodes,
      contributing: cls.contributing,
      receivedAt,
    });
  } else if (act.kind === "upgrade") {
    await upgradeAlert(ctx, act.eventId || assignment.eventId, act.alertId, act.to, cls);
  }

  if (cfg.watch.enabled) await updateWatch(ctx, deviceId, assignment.eventId, finalState, receivedAt);
  return act;
}

async function upgradeAlert(ctx: ServiceContext, eventId: string, alertId: string, to: Emergency["severity"] & string, cls: ReturnType<typeof classifyHealth>) {
  const now = ctx.now();
  let from: Emergency["severity"] | null = null;
  const tx = await ctx.db.ref(paths.emergency(eventId, alertId)).transaction((cur: Emergency | null) => {
    if (cur === null) return null;
    if (cur.status === "resolved" || !cur.severity || SEVERITY_RANK[to] <= SEVERITY_RANK[cur.severity]) return undefined;
    from = cur.severity;
    return clean({
      ...cur,
      severity: to,
      priority: to === "critical" ? "P1" : to === "danger" ? "P2" : "P3",
      upgradedFrom: cur.severity,
      upgradedAt: now,
      reasonCodes: [...new Set([...(cur.reasonCodes ?? []), ...cls.reasonCodes])].slice(0, 20),
      reasons: [cls.summary || cur.reasons?.[0] || "Health anomaly", ...(cur.reasons ?? []).slice(1)],
      contributing: cls.contributing,
      updatedAt: now,
    } satisfies Emergency);
  });
  if (!tx.committed || !tx.snapshot.exists()) return;
  const auditKey = ctx.db.ref(paths.emergencyAudit(eventId, alertId)).push().key as string;
  await ctx.db.ref().update({
    [`${paths.emergencyAudit(eventId, alertId)}/${auditKey}`]: clean({ action: "severity_upgraded", by: "system", at: now, note: `${from} → ${to}: ${cls.summary}` } satisfies EmergencyAuditEntry),
    [`${paths.openAlert(alertId)}/severity`]: to,
  });
  await dispatchAlert(ctx, eventId, alertId, "upgrade", `upgrade-${to}`);
}

/** Last watch-list state written per device in this host — avoids a database write every 2 s. */
const watchWritten = new Map<string, { on: boolean; at: number }>();
const WATCH_REFRESH_MS = 30_000;

async function updateWatch(ctx: ServiceContext, deviceId: string, eventId: string, state: DeviceAlertState | null, now: number) {
  const cfg = await loadC2Config(ctx);
  const trend = predictTrend(state?.series, now, cfg);
  const ref = ctx.db.ref(paths.watchEntry(eventId, deviceId));
  const on = trend.watch && !state?.openAlertId;
  const key = `${eventId}/${deviceId}`;
  const last = watchWritten.get(key);
  // Write only when the state flips, or refresh an active entry every 30 s.
  if (last && last.on === on && (!on || now - last.at < WATCH_REFRESH_MS)) return;
  watchWritten.set(key, { on, at: now });
  if (on) {
    await ref.set({
      deviceId,
      eventId,
      currentScore: trend.currentScore,
      projectedScore: trend.projectedScore,
      slopePerMin: trend.slopePerMin,
      horizonSec: cfg.watch.horizonSec,
      points: trend.points,
      at: now,
    });
  } else {
    await ref.remove();
  }
}
