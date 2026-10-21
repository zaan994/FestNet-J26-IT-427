/**
 * C2 — keeps the backend indexes consistent with the alert lifecycle:
 *  - onAlertCreated: add to emergency/openAlerts (escalation queue) and dispatch the initial round.
 *  - syncAfterTransition: on acknowledge / in progress → leave the escalation queue, start the
 *    per-device cooldown; resolve → close the device incident; reopen → back in the queue.
 *    Inbox entries of every recipient follow the alert status.
 * Only the trusted backend calls these (Admin SDK); clients cannot write these nodes (rules).
 */
import { paths, type Emergency, type EmergencyStatus } from "../shared";
import { clean, type ServiceContext } from "../services/context";
import { loadC2Config } from "./config-store";
import type { DeviceAlertState } from "./decide";
import { dispatchAlert } from "./dispatch";

export async function onAlertCreated(ctx: ServiceContext, alert: Emergency): Promise<void> {
  if (alert.status === "open" || alert.status === "escalated") {
    await ctx.db.ref(paths.openAlert(alert.alertId)).set(
      clean({
        eventId: alert.eventId,
        deviceId: alert.deviceId ?? null,
        severity: alert.severity ?? "critical",
        type: alert.type,
        createdAt: alert.createdAt,
        escalationDueAt: alert.escalationDueAt ?? null,
      }),
    );
  }
  try {
    await dispatchAlert(ctx, alert.eventId, alert.alertId, "initial");
  } catch (err) {
    // The alert is durable and visible already; log so the failure is never silent.
    ctx.log("error", "initial dispatch failed", { alertId: alert.alertId, error: String(err) });
  }
}

export async function syncAfterTransition(ctx: ServiceContext, alert: Emergency, from: EmergencyStatus | null): Promise<void> {
  const cfg = await loadC2Config(ctx);
  const now = ctx.now();
  const multi: Record<string, unknown> = {};
  const leftQueue = (from === "open" || from === "escalated") && alert.status !== "open" && alert.status !== "escalated";

  if (leftQueue || alert.status === "resolved") multi[paths.openAlert(alert.alertId)] = null;
  if (alert.status === "open" && from === "resolved") {
    const due = now + cfg.escalation.timeoutSec * 1000;
    multi[paths.openAlert(alert.alertId)] = clean({ eventId: alert.eventId, deviceId: alert.deviceId ?? null, severity: alert.severity ?? "critical", type: alert.type, createdAt: alert.createdAt, escalationDueAt: due });
    multi[`${paths.emergency(alert.eventId, alert.alertId)}/escalationDueAt`] = due;
  }

  const recipients = ((await ctx.db.ref(paths.alertRecipients(alert.alertId)).get()).val() as Record<string, string> | null) ?? {};
  for (const uid of Object.keys(recipients)) {
    multi[`${paths.inboxEntry(uid, alert.alertId)}/status`] = alert.status;
    multi[`${paths.inboxEntry(uid, alert.alertId)}/updatedAt`] = now;
  }
  if (Object.keys(multi).length) await ctx.db.ref().update(multi);

  // Device incident state (health anomalies only — SOS never sets a cooldown).
  if (alert.type === "hri" && alert.deviceId && (leftQueue || alert.status === "resolved")) {
    await ctx.db.ref(paths.deviceAlertState(alert.deviceId)).transaction((cur: DeviceAlertState | null) => {
      if (cur === null) return null;
      if (cur.openAlertId !== alert.alertId) return undefined;
      return clean({ ...cur, openAlertId: null, openEventId: null, openSeverity: null, cooldownUntil: now + cfg.cooldownAfterAckSec * 1000, cooldownSeverity: alert.severity ?? null, streakCount: 0 });
    });
  }
}
