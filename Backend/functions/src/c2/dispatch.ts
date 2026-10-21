/**
 * C2 — notification dispatch for one alert phase (initial | upgrade-<severity> | escalation).
 *
 * Order (the alert is already durable before this runs):
 *  1. Claim the phase lock (transaction) → each phase notifies at most once, even with retries,
 *     duplicate database events or two hosts.
 *  2. Resolve recipients server-side from eventStaff / eventVolunteers (never from client data).
 *  3. Write inbox entries so the apps show the alert even if push fails.
 *  4. Send in parallel through ctx.sender, retry transient failures once, remove invalid tokens.
 *  5. Record counts, timestamps and latency on the alert, a dispatch log entry and an audit entry.
 */
import {
  paths,
  SEVERITY_RANK,
  UNASSIGNED_EVENT,
  type AlertSeverity,
  type DispatchRecord,
  type Emergency,
  type EmergencyAuditEntry,
  type InboxEntry,
  type NotifyCounts,
  type ResponderRecord,
  type ResponderRole,
} from "../shared";
import { clean, type ServiceContext } from "../services/context";
import { loadC2Config } from "./config-store";
import { selectVolunteers } from "./routing";
import type { PushMessage, SendResult } from "./sender";

export type DispatchPhase = "initial" | "upgrade" | "escalation";

const roleOf = (eventRole: string): ResponderRole | null =>
  eventRole === "medicalResponder" ? "medical" : eventRole === "secondaryResponder" ? "secondary" : eventRole === "eventOperator" ? "operator" : null;

async function recipientsFor(ctx: ServiceContext, alert: Emergency, phase: DispatchPhase): Promise<Map<string, ResponderRole>> {
  const cfg = await loadC2Config(ctx);
  const severity: AlertSeverity = alert.severity ?? "critical";
  const out = new Map<string, ResponderRole>();

  if (alert.eventId === UNASSIGNED_EVENT) {
    // Bands / accounts without an assignment: device administrators handle these.
    const roles = ((await ctx.db.ref(paths.allRoles()).get()).val() as Record<string, Record<string, boolean>> | null) ?? {};
    for (const [uid, r] of Object.entries(roles)) if (r?.deviceAdmin === true) out.set(uid, "operator");
    return out;
  }

  const staff = ((await ctx.db.ref(paths.eventStaff(alert.eventId)).get()).val() as Record<string, string> | null) ?? {};
  const byRole = (role: ResponderRole) => Object.entries(staff).filter(([, r]) => roleOf(r) === role).map(([uid]) => uid);

  if (phase === "escalation") {
    const secondary = byRole("secondary");
    const targets = secondary.length ? secondary : byRole("medical"); // fallback to the medical team
    for (const uid of targets) out.set(uid, secondary.length ? "secondary" : "medical");
    if (cfg.routing.notifyOperators) for (const uid of byRole("operator")) if (!out.has(uid)) out.set(uid, "operator");
    return out;
  }

  for (const uid of byRole("medical")) out.set(uid, "medical");
  if (cfg.routing.notifyOperators) for (const uid of byRole("operator")) if (!out.has(uid)) out.set(uid, "operator");

  if (SEVERITY_RANK[severity] >= SEVERITY_RANK[cfg.routing.volunteerMinSeverity]) {
    const volunteers = Object.keys(((await ctx.db.ref(paths.eventVolunteers(alert.eventId)).get()).val() as Record<string, unknown> | null) ?? {});
    const records = await Promise.all(
      volunteers.map(async (uid) => ({ uid, record: (await ctx.db.ref(paths.responder(uid)).get()).val() as ResponderRecord | null })),
    );
    const sel = selectVolunteers(records, { severity, location: alert.location ?? null }, ctx.now(), cfg);
    for (const v of sel.selected) if (!out.has(v.uid)) out.set(v.uid, "volunteer");
    ctx.log("info", "volunteer routing", { alertId: alert.alertId, selected: sel.selected.length, ...sel.excluded, skipped: sel.skippedReason ?? null });
  }
  return out;
}

function summaryOf(alert: Emergency): string {
  return (alert.reasons?.[0] ?? (alert.type === "sos" ? "SOS" : "Health alert")).slice(0, 140);
}

function messageFor(alert: Emergency, phase: DispatchPhase, token: string): PushMessage {
  const severity = alert.severity ?? "critical";
  const kind = alert.type === "sos" ? "SOS" : "Health alert";
  const prefix = phase === "escalation" ? "ESCALATED · " : phase === "upgrade" ? "UPGRADED · " : "";
  return {
    token,
    title: `${prefix}${severity.toUpperCase()} · ${kind}${alert.deviceId ? ` · ${alert.deviceId}` : ""}`,
    body: summaryOf(alert),
    data: {
      alertId: alert.alertId,
      eventId: alert.eventId,
      deviceId: alert.deviceId ?? "",
      severity,
      source: alert.type === "sos" ? "sos" : "anomaly",
      phase,
      ts: String(alert.createdAt),
      url: `/emergency?alert=${encodeURIComponent(alert.alertId)}`,
    },
  };
}

const emptyCounts = (): NotifyCounts => ({ recipients: 0, attempted: 0, accepted: 0, failed: 0 });

export async function dispatchAlert(ctx: ServiceContext, eventId: string, alertId: string, phase: DispatchPhase, lockKey: string = phase): Promise<DispatchRecord | null> {
  const lock = await ctx.db.ref(paths.dispatchLock(alertId, lockKey)).transaction((cur) => (cur ? undefined : { at: ctx.now() }));
  if (!lock.committed) return null; // this phase was already dispatched

  const alertRef = ctx.db.ref(paths.emergency(eventId, alertId));
  const alert = (await alertRef.get()).val() as Emergency | null;
  if (!alert) return null;

  const startedAt = ctx.now();
  const recipients = await recipientsFor(ctx, alert, phase);
  const byRole: Partial<Record<ResponderRole, NotifyCounts>> = {};
  const roleCounts = (r: ResponderRole) => (byRole[r] ??= emptyCounts());

  // Inbox first: visible in the apps even when push is unavailable.
  const multi: Record<string, unknown> = {};
  const tokensByUid = new Map<string, string[]>();
  for (const [uid, role] of recipients) {
    roleCounts(role).recipients++;
    const entry: InboxEntry = {
      alertId,
      eventId,
      deviceId: alert.deviceId ?? null,
      type: alert.type,
      severity: alert.severity ?? "critical",
      status: alert.status,
      summary: summaryOf(alert),
      role,
      location: alert.location ? { latitude: alert.location.latitude, longitude: alert.location.longitude, fixAt: alert.location.fixAt } : null,
      createdAt: alert.createdAt,
      sentAt: startedAt,
      updatedAt: startedAt,
    };
    multi[paths.inboxEntry(uid, alertId)] = clean(entry);
    multi[`${paths.alertRecipients(alertId)}/${uid}`] = role;
  }
  await Promise.all(
    [...recipients.keys()].map(async (uid) => {
      const rec = (await ctx.db.ref(`${paths.responder(uid)}/tokens`).get()).val() as ResponderRecord["tokens"] | null;
      tokensByUid.set(uid, Object.values(rec ?? {}).map((t) => t?.token).filter((t): t is string => typeof t === "string" && t.length > 0));
    }),
  );
  if (Object.keys(multi).length) await ctx.db.ref().update(multi);

  // Send.
  const messages: { uid: string; role: ResponderRole; msg: PushMessage }[] = [];
  for (const [uid, role] of recipients) for (const token of tokensByUid.get(uid) ?? []) messages.push({ uid, role, msg: messageFor(alert, phase, token) });

  let results: SendResult[] = [];
  let retried = 0;
  let note: string | null = null;
  if (!ctx.sender) note = "No push sender configured on this host — alert stored and shown in the apps only.";
  else if (messages.length) {
    try {
      results = await ctx.sender.sendMany(messages.map((m) => m.msg));
      const transient = results.filter((r) => !r.ok && r.transient).map((r) => r.token);
      if (transient.length) {
        retried = transient.length;
        const retry = await ctx.sender.sendMany(messages.filter((m) => transient.includes(m.msg.token)).map((m) => m.msg));
        const byToken = new Map(retry.map((r) => [r.token, r]));
        results = results.map((r) => byToken.get(r.token) ?? r);
      }
    } catch (err) {
      note = `Push sender failed: ${String(err).slice(0, 200)}`;
      results = messages.map((m) => ({ token: m.msg.token, ok: false, invalidToken: false, transient: true, error: "sender_exception" }));
    }
  } else note = "No registered devices for the selected recipients.";

  const resultByToken = new Map(results.map((r) => [r.token, r]));
  const cleanup: Record<string, null> = {};
  let invalid = 0;
  for (const m of messages) {
    const c = roleCounts(m.role);
    const r = resultByToken.get(m.msg.token);
    if (!r) continue;
    c.attempted++;
    if (r.ok) c.accepted++;
    else c.failed++;
    if (r.invalidToken) {
      // Remove only the invalid token — never the responder account.
      const tokens = (await ctx.db.ref(`${paths.responder(m.uid)}/tokens`).get()).val() as Record<string, { token?: string }> | null;
      for (const [id, t] of Object.entries(tokens ?? {})) if (t?.token === m.msg.token) cleanup[`${paths.responder(m.uid)}/tokens/${id}`] = null;
      invalid++;
    }
  }
  if (Object.keys(cleanup).length) await ctx.db.ref().update(cleanup);

  const finishedAt = ctx.now();
  const record: DispatchRecord = { phase, severity: alert.severity ?? "critical", startedAt, finishedAt, byRole, invalidTokensRemoved: invalid, retried, note };
  const logKey = ctx.db.ref(paths.dispatchLog(eventId, alertId)).push().key as string;

  // Merge counters into the alert; the first dispatch defines the latency figures.
  await alertRef.transaction((cur: Emergency | null) => {
    if (!cur) return cur;
    const notified = { ...(cur.notified ?? {}) };
    for (const [role, c] of Object.entries(byRole) as [ResponderRole, NotifyCounts][]) {
      const prev = notified[role] ?? emptyCounts();
      notified[role] = { recipients: prev.recipients + c.recipients, attempted: prev.attempted + c.attempted, accepted: prev.accepted + c.accepted, failed: prev.failed + c.failed };
    }
    const next: Emergency = { ...cur, notified };
    if (cur.dispatchedAt == null) {
      next.dispatchStartedAt = startedAt;
      next.dispatchedAt = finishedAt;
      next.latencyFromReceiptMs = cur.receivedAt != null ? finishedAt - cur.receivedAt : null;
      next.sourceToDispatchMs = cur.measuredAt != null && cur.measuredAt <= finishedAt ? finishedAt - cur.measuredAt : null;
    }
    return clean(next);
  });
  const total = Object.values(byRole).reduce((a, c) => ({ attempted: a.attempted + c.attempted, accepted: a.accepted + c.accepted, recipients: a.recipients + c.recipients }), { attempted: 0, accepted: 0, recipients: 0 });
  const auditKey = ctx.db.ref(paths.emergencyAudit(eventId, alertId)).push().key as string;
  await ctx.db.ref().update({
    [`${paths.dispatchLog(eventId, alertId)}/${logKey}`]: clean(record),
    [`${paths.emergencyAudit(eventId, alertId)}/${auditKey}`]: clean({
      action: "notified",
      by: "system",
      at: finishedAt,
      note: `${phase}: ${total.recipients} recipient(s), ${total.attempted} push attempt(s), ${total.accepted} accepted by FCM${note ? ` — ${note}` : ""}`,
    } satisfies EmergencyAuditEntry),
  });
  ctx.log("info", "alert dispatched", { alertId, phase, ...total, latencyMs: finishedAt - startedAt });
  return record;
}
