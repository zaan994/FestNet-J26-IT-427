/**
 * C2 — automatic escalation of unacknowledged alerts.
 *
 * escalateDue(ctx) is called periodically (Cloud Scheduler every minute when deployed; every 30 s by
 * the local worker). For each open alert whose escalationDueAt has passed:
 *   transaction on the alert: only status "open" → "escalated" (escalationLevel 1) commits, so
 *   overlapping runs, retries and two hosts escalate an alert exactly once; acknowledged / resolved
 *   alerts are never escalated. Then secondary responders are notified (fallback: medical team).
 *
 * Timing: with a periodic runner an alert escalates between timeout and timeout + interval after
 * creation (e.g. 2:00–3:00 with a 1-minute schedule). Exact timing would need a delayed task
 * queue (Cloud Tasks) per alert.
 */
import { paths, type Emergency, type EmergencyAuditEntry } from "../shared";
import { clean, type ServiceContext } from "../services/context";
import { nextStatus } from "../services/emergencies";
import { dispatchAlert } from "./dispatch";

interface OpenAlertIndex {
  eventId: string;
  escalationDueAt?: number | null;
}

/** Due entries of the escalation queue. Uses the escalationDueAt index; if the rules with that index
 *  are not deployed yet, falls back to reading the (small, bounded) open-alert queue. */
async function dueAlerts(ctx: ServiceContext, now: number, limit: number): Promise<[string, OpenAlertIndex][]> {
  try {
    const snap = await ctx.db.ref(paths.openAlerts()).orderByChild("escalationDueAt").startAt(1).endAt(now).limitToFirst(limit).get();
    const out: [string, OpenAlertIndex][] = [];
    snap.forEach((c) => {
      out.push([c.key as string, c.val() as OpenAlertIndex]);
    });
    return out;
  } catch (err) {
    ctx.log("warn", "escalation index missing — deploy the database rules (firebase deploy --only database)", { error: String(err) });
    const all = ((await ctx.db.ref(paths.openAlerts()).limitToFirst(500).get()).val() as Record<string, OpenAlertIndex> | null) ?? {};
    return Object.entries(all)
      .filter(([, v]) => typeof v?.escalationDueAt === "number" && v.escalationDueAt > 0 && v.escalationDueAt <= now)
      .slice(0, limit);
  }
}

export async function escalateDue(ctx: ServiceContext, limit = 50): Promise<string[]> {
  const now = ctx.now();
  const due = await dueAlerts(ctx, now, limit);
  const escalated: string[] = [];
  const jobs: Promise<void>[] = [];
  due.forEach(([alertId, idx]) => {
    jobs.push(
      (async () => {
        if (await escalateOne(ctx, idx.eventId, alertId, now)) escalated.push(alertId);
      })().catch((err) => ctx.log("error", "escalation failed", { alertId, error: String(err) })),
    );
  });
  await Promise.all(jobs);
  return escalated;
}

export async function escalateOne(ctx: ServiceContext, eventId: string, alertId: string, now: number): Promise<boolean> {
  const ref = ctx.db.ref(paths.emergency(eventId, alertId));
  let from: Emergency["status"] | null = null;
  const tx = await ref.transaction((cur: Emergency | null) => {
    if (cur === null) return null;
    from = cur.status;
    if (nextStatus(cur.status, "escalate") !== "escalated") return undefined;
    if (cur.escalationDueAt != null && cur.escalationDueAt > now) return undefined;
    return clean({ ...cur, status: "escalated", escalationLevel: (cur.escalationLevel ?? 0) + 1, escalatedAt: now, escalationDueAt: null, updatedAt: now } satisfies Emergency);
  });
  if (!tx.snapshot.exists()) {
    await ctx.db.ref(paths.openAlert(alertId)).remove(); // stale index entry
    return false;
  }
  if (!tx.committed) {
    const status = (tx.snapshot.val() as Emergency).status;
    // Already handled by someone: drop it from the escalation queue.
    if (status !== "open") await ctx.db.ref(`${paths.openAlert(alertId)}/escalationDueAt`).remove();
    return false;
  }
  const alert = tx.snapshot.val() as Emergency;
  const auditKey = ctx.db.ref(paths.emergencyAudit(eventId, alertId)).push().key as string;
  const multi: Record<string, unknown> = {
    [`${paths.emergencyAudit(eventId, alertId)}/${auditKey}`]: clean({
      action: "escalated",
      by: "system",
      at: now,
      fromStatus: from,
      toStatus: "escalated",
      note: "Not acknowledged within the escalation timeout.",
    } satisfies EmergencyAuditEntry),
    [`${paths.openAlert(alertId)}/escalationDueAt`]: null,
  };
  if (alert.origin) multi[`${paths.sosRequests(alert.origin.uid)}/${alert.origin.requestId}/alertStatus`] = "escalated";
  const recipients = ((await ctx.db.ref(paths.alertRecipients(alertId)).get()).val() as Record<string, string> | null) ?? {};
  for (const uid of Object.keys(recipients)) multi[`${paths.inboxEntry(uid, alertId)}/status`] = "escalated";
  await ctx.db.ref().update(multi);
  await dispatchAlert(ctx, eventId, alertId, "escalation");
  ctx.log("info", "alert escalated", { alertId, eventId });
  return true;
}
