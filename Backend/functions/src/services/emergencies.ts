/**
 * Emergency lifecycle: manual SOS (band button / attendee app) and automated HRI alerts.
 *
 *  - Durable: every alert is written to emergencies/{eventId}/{alertId} with an audit trail.
 *  - Idempotent: emergencyKeys/{key} is reserved in a transaction before the alert is written;
 *    a retry with the same key re-writes a missing alert instead of creating a duplicate.
 *  - Manual SOS is independent of HRI: no score, confidence or missing sensor can suppress it.
 *  - Automated HRI alerts are P2 and always marked requiresHumanReview.
 *  - Status changes go through a state machine with role checks, and are mirrored to the
 *    attendee's sosRequests node (the attendee cannot read emergencies directly).
 */
import {
  paths,
  parseLatest,
  UNASSIGNED_EVENT,
  type Assignment,
  type AttendeeLink,
  type DeviceMeta,
  type DeviceRecord,
  type Emergency,
  type EmergencyAuditEntry,
  type EmergencyStatus,
  type SosRequest,
} from "../shared";
import { sosClassification } from "../c2/classify";
import { loadC2Config } from "../c2/config-store";
import { onAlertCreated, syncAfterTransition } from "../c2/lifecycle";
import type { AlertSeverity } from "../shared";
import { getEventRole, getGlobalRoles } from "./access";
import { clean, conflict, denied, invalid, notFound, SERVER_TIMESTAMP, type ServiceContext } from "./context";
import { ALERT_ID_PATTERN, EVENT_ID_PATTERN, safeKey } from "./ids";
import { allowOnly, oneOf, str, type Payload } from "./validate";

/** An open app SOS from the same account within this window is treated as a repeat press. */
export const SOS_REPEAT_WINDOW_MS = 10 * 60_000;

export type EmergencyAction = "acknowledge" | "assignResponder" | "markInProgress" | "resolve" | "reopen" | "review" | "escalate";

const UNACKED: EmergencyStatus[] = ["open", "escalated"];

/** Pure state machine (unit-tested). Returns the next status or null if the action is not allowed. */
export function nextStatus(current: EmergencyStatus, action: EmergencyAction): EmergencyStatus | null {
  switch (action) {
    case "acknowledge":
      return UNACKED.includes(current) ? "acknowledged" : null;
    case "escalate": // system only (C2 escalation worker)
      return current === "open" ? "escalated" : null;
    case "assignResponder":
      return current === "resolved" ? null : UNACKED.includes(current) ? "acknowledged" : current;
    case "markInProgress":
      return UNACKED.includes(current) || current === "acknowledged" ? "in_progress" : null;
    case "resolve":
      return current === "acknowledged" || current === "in_progress" ? "resolved" : null;
    case "reopen":
      return current === "resolved" ? "open" : null;
    case "review":
      return current;
  }
}

export interface EmergencyDraft {
  idempotencyKey: string;
  type: Emergency["type"];
  source: Emergency["source"];
  eventId: string;
  deviceId?: string | null;
  assignmentId?: string | null;
  participantId?: string | null;
  reasons: string[];
  measuredAt?: number | null;
  location?: Emergency["location"];
  hri?: Emergency["hri"];
  origin?: Emergency["origin"];
  demo: boolean;
  // ---- C2 ----
  /** Pre-generated id (C2 reserves it inside the device-state transaction). */
  alertId?: string;
  severity: AlertSeverity;
  reasonCodes: string[];
  contributing?: Emergency["contributing"];
  /** Server time the trigger reached the alert service. */
  receivedAt: number;
}

/** Creates an alert exactly once per idempotency key. Returns the alert and whether it already existed. */
export async function createEmergency(ctx: ServiceContext, draft: EmergencyDraft): Promise<{ alertId: string; eventId: string; duplicate: boolean }> {
  const key = safeKey(draft.idempotencyKey);
  const keyRef = ctx.db.ref(paths.emergencyKey(key));
  const newAlertId = draft.alertId ?? (ctx.db.ref(paths.emergencies(draft.eventId)).push().key as string);
  const now = ctx.now();
  const c2 = await loadC2Config(ctx);

  const tx = await keyRef.transaction((current: { alertId: string; eventId: string; committed: boolean } | null) => {
    if (current) return undefined; // already reserved
    return { alertId: newAlertId, eventId: draft.eventId, committed: false, at: now };
  });
  const reserved = tx.snapshot.val() as { alertId: string; eventId: string; committed: boolean } | null;
  if (!reserved) throw new Error("Could not reserve emergency key.");
  const isNew = tx.committed && reserved.alertId === newAlertId;

  if (!isNew && reserved.committed) {
    await ctx.db.ref(paths.emergencyAudit(reserved.eventId, reserved.alertId)).push(
      clean({ action: "duplicate_suppressed", by: "system", at: SERVER_TIMESTAMP, note: `Duplicate trigger (${draft.source}) ignored.` }),
    );
    return { alertId: reserved.alertId, eventId: reserved.eventId, duplicate: true };
  }

  // New, or a previous attempt reserved the key but failed before writing: (re)write the alert.
  const emergency: Emergency = {
    alertId: reserved.alertId,
    idempotencyKey: key,
    type: draft.type,
    source: draft.source,
    priority: draft.type === "sos" || draft.severity === "critical" ? "P1" : draft.severity === "danger" ? "P2" : "P3",
    status: "open",
    eventId: reserved.eventId,
    deviceId: draft.deviceId ?? null,
    assignmentId: draft.assignmentId ?? null,
    participantId: draft.participantId ?? null,
    reasons: draft.reasons.slice(0, 10),
    createdAt: now,
    measuredAt: draft.measuredAt ?? null,
    location: draft.location ?? null,
    hri: draft.hri ?? null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    responder: null,
    resolution: null,
    review: null,
    requiresHumanReview: draft.type === "hri",
    origin: draft.origin ?? null,
    repeatCount: 0,
    demo: draft.demo,
    updatedAt: now,
    severity: draft.severity,
    reasonCodes: draft.reasonCodes.slice(0, 20),
    contributing: draft.contributing ?? null,
    receivedAt: draft.receivedAt,
    dispatchStartedAt: null,
    dispatchedAt: null,
    latencyFromReceiptMs: null,
    sourceToDispatchMs: null,
    escalationLevel: 0,
    escalatedAt: null,
    escalationDueAt: now + c2.escalation.timeoutSec * 1000,
    notified: {},
    upgradedFrom: null,
    algorithmVersion: c2.version,
  };
  const auditKey = ctx.db.ref(paths.emergencyAudit(reserved.eventId, reserved.alertId)).push().key as string;
  await ctx.db.ref().update(
    clean({
      [paths.emergency(reserved.eventId, reserved.alertId)]: emergency,
      [`${paths.emergencyAudit(reserved.eventId, reserved.alertId)}/${auditKey}`]: {
        action: "created",
        by: draft.source,
        at: now,
        toStatus: "open",
        note: draft.reasons[0] ?? null,
      } satisfies EmergencyAuditEntry,
      [`${paths.emergencyKey(key)}/committed`]: true,
    }),
  );
  ctx.log("info", "emergency created", { eventId: reserved.eventId, alertId: reserved.alertId, type: draft.type, source: draft.source, severity: draft.severity });
  // C2: escalation queue + notifications (the alert is already durable above).
  await onAlertCreated(ctx, emergency);
  return { alertId: reserved.alertId, eventId: reserved.eventId, duplicate: false };
}

/** Band location for an alert: only when the band reports a current, plausible fix. */
async function bandLocation(ctx: ServiceContext, deviceId: string): Promise<{ location: Emergency["location"]; latest: ReturnType<typeof parseLatest> }> {
  const latest = parseLatest((await ctx.db.ref(paths.deviceLatest(deviceId)).get()).val(), ctx.now());
  const fixAt = latest?.serverTs ?? null;
  return {
    latest,
    location: latest?.gps.location && fixAt ? { ...latest.gps.location, fixAt, source: "band_gps" } : null,
  };
}

/** Band SOS button: latest.sosPressCount increased. */
export async function handleDeviceSos(ctx: ServiceContext, deviceId: string, pressCount: number): Promise<void> {
  if (!Number.isInteger(pressCount) || pressCount <= 0) return;
  const receivedAt = ctx.now();
  const [metaSnap, deviceSnap] = await Promise.all([
    ctx.db.ref(paths.deviceMeta(deviceId)).get(),
    ctx.db.ref(paths.deviceIndexEntry(deviceId)).get(),
  ]);
  const meta = (metaSnap.val() as DeviceMeta | null) ?? {};
  const device = (deviceSnap.val() as DeviceRecord | null) ?? {};
  const { location, latest } = await bandLocation(ctx, deviceId);

  // sosPressCount restarts at 0 after a reboot, so the boot time is part of the key.
  const bootTs = meta.lastBootServerTs ?? meta.lastBootTs ?? "unknown-boot";
  let key = `sos-dev-${deviceId}-${bootTs}-${pressCount}`;
  // If boot metadata lags behind a fresh boot, an old key could collide: detect it by age.
  const existing = (await ctx.db.ref(paths.emergencyKey(safeKey(key))).get()).val() as { at?: number } | null;
  const uptime = latest?.uptimeMs ?? null;
  if (existing?.at && uptime !== null && existing.at < ctx.now() - uptime - 60_000) key = `${key}-r${ctx.now()}`;

  let assignment: Assignment | null = null;
  if (device.currentAssignmentId) {
    assignment = (await ctx.db.ref(paths.assignment(device.currentAssignmentId)).get()).val() as Assignment | null;
  }
  await createEmergency(ctx, {
    idempotencyKey: key,
    type: "sos",
    source: "device_button",
    eventId: assignment?.status === "active" ? assignment.eventId : UNASSIGNED_EVENT,
    deviceId,
    assignmentId: assignment?.assignmentId ?? null,
    participantId: assignment?.participantId ?? null,
    reasons: [
      "SOS button pressed on the band.",
      ...(location ? [] : ["No current GPS fix from the band."]),
      ...(assignment ? [] : ["Device has no active assignment."]),
    ],
    measuredAt: latest?.deviceTs ?? null,
    location,
    demo: device.demo ?? assignment?.demo ?? false,
    // Manual SOS: always critical, never suppressed (independent of HRI and data quality).
    ...sosFields("device_button", receivedAt),
  });
}

/** Attendee app SOS: sosRequests/{uid}/{requestId}. Never silently dropped. */
export async function handleAppSos(ctx: ServiceContext, uid: string, requestId: string, request: SosRequest | null): Promise<void> {
  if (requestId === "_active") return; // backend's own pointer, not a request
  if (!request || request.status) return; // already processed
  const receivedAt = ctx.now();
  const link = (await ctx.db.ref(paths.attendeeLink(uid)).get()).val() as AttendeeLink | null;
  const eventId = link?.eventId ?? UNASSIGNED_EVENT;

  // Repeat press while an SOS from this account is still open → fold into the existing alert.
  const activeRef = ctx.db.ref(`${paths.sosRequests(uid)}/_active`);
  const active = (await activeRef.get()).val() as { eventId: string; alertId: string; at: number } | null;
  if (active && ctx.now() - active.at < SOS_REPEAT_WINDOW_MS) {
    const current = (await ctx.db.ref(paths.emergency(active.eventId, active.alertId)).get()).val() as Emergency | null;
    if (current && current.status !== "resolved") {
      await ctx.db.ref().update(
        clean({
          [`${paths.emergency(active.eventId, active.alertId)}/repeatCount`]: (current.repeatCount ?? 0) + 1,
          [`${paths.emergency(active.eventId, active.alertId)}/updatedAt`]: ctx.now(),
          [`${paths.sosRequests(uid)}/${requestId}/status`]: "received",
          [`${paths.sosRequests(uid)}/${requestId}/alertId`]: active.alertId,
          [`${paths.sosRequests(uid)}/${requestId}/eventId`]: active.eventId,
          [`${paths.sosRequests(uid)}/${requestId}/alertStatus`]: current.status,
          [`${paths.sosRequests(uid)}/${requestId}/processedAt`]: ctx.now(),
        }),
      );
      await ctx.db.ref(paths.emergencyAudit(active.eventId, active.alertId)).push(
        clean({ action: "repeat_press", by: "attendee_app", at: SERVER_TIMESTAMP, note: "SOS pressed again in the app." }),
      );
      return;
    }
  }

  const location = link ? (await bandLocation(ctx, link.deviceId)).location : null;
  const created = await createEmergency(ctx, {
    idempotencyKey: `sos-app-${uid}-${requestId}`,
    type: "sos",
    source: "attendee_app",
    eventId,
    deviceId: link?.deviceId ?? null,
    assignmentId: link?.assignmentId ?? null,
    participantId: link?.participantId ?? null,
    reasons: ["SOS requested in the attendee app.", ...(link ? [] : ["App account is not linked to a device."]), ...(location ? [] : ["No current band GPS fix."])],
    measuredAt: typeof request.clientCreatedAt === "number" ? request.clientCreatedAt : null,
    location,
    origin: { uid, requestId },
    demo: false,
    ...sosFields("attendee_app", receivedAt),
  });
  await ctx.db.ref().update(
    clean({
      [`${paths.sosRequests(uid)}/${requestId}/status`]: "received",
      [`${paths.sosRequests(uid)}/${requestId}/alertId`]: created.alertId,
      [`${paths.sosRequests(uid)}/${requestId}/eventId`]: created.eventId,
      [`${paths.sosRequests(uid)}/${requestId}/alertStatus`]: "open",
      [`${paths.sosRequests(uid)}/${requestId}/processedAt`]: ctx.now(),
      [`${paths.sosRequests(uid)}/_active`]: { eventId: created.eventId, alertId: created.alertId, at: ctx.now() },
    }),
  );
}

function sosFields(source: "device_button" | "attendee_app", receivedAt: number) {
  const c = sosClassification(source);
  return { severity: c.severity as AlertSeverity, reasonCodes: c.reasonCodes, receivedAt };
}

/** Current band GPS fix for an alert (exported for the C2 health pipeline). */
export async function currentBandLocation(ctx: ServiceContext, deviceId: string) {
  return (await bandLocation(ctx, deviceId)).location;
}

/** Volunteers may only accept an alert they were sent ("I'm responding"); staff do the rest. */
const VOLUNTEER_ACTIONS: EmergencyAction[] = ["acknowledge", "markInProgress"];

/**
 * Responder / staff action on an alert (dashboard Emergency Command Centre or the app's Respond tab).
 * Identity comes from the authenticated command owner (uid), never from the payload.
 */
export async function transitionEmergency(ctx: ServiceContext, uid: string, action: EmergencyAction, p: Payload) {
  allowOnly(p, ["eventId", "alertId", "note", "responderUid", "responderName", "label"]);
  const eventId = str(p, "eventId", { pattern: /^(_unassigned|[a-z0-9-]{3,40})$/ });
  const alertId = str(p, "alertId", { pattern: ALERT_ID_PATTERN });
  const note = str(p, "note", { max: 500, optional: true });
  if (action === "escalate") throw denied("Escalation is performed by the system.");
  if (eventId === UNASSIGNED_EVENT) {
    if (!(await getGlobalRoles(ctx, uid)).has("deviceAdmin")) throw invalid("Unassigned alerts are handled by a deviceAdmin.");
  } else {
    if (!EVENT_ID_PATTERN.test(eventId)) throw invalid("Invalid event.");
    const role = await getEventRole(ctx, eventId, uid);
    if (!role) {
      // Volunteer: only for an alert in their own inbox, and only accept / on-my-way.
      const inbox = (await ctx.db.ref(paths.inboxEntry(uid, alertId)).get()).exists();
      const volunteer = (await ctx.db.ref(`${paths.eventVolunteers(eventId)}/${uid}`).get()).val() === true;
      if (!inbox || !volunteer || !VOLUNTEER_ACTIONS.includes(action)) throw denied("You can only accept alerts that were sent to you.");
    } else if (action === "reopen" && role !== "eventOperator") {
      throw denied("Only an event operator can reopen an alert.");
    }
  }
  if ((action === "resolve" || action === "reopen") && !note) throw invalid("A note is required.");

  const responderUid = action === "assignResponder" ? str(p, "responderUid", { max: 128 }) : null;
  const responderName = action === "assignResponder" ? str(p, "responderName", { max: 80 }) : null;
  const label = action === "review" ? oneOf(p, "label", ["true_positive", "false_positive", "uncertain"] as const) : null;

  const ref = ctx.db.ref(paths.emergency(eventId, alertId));
  const now = ctx.now();
  let fromStatus: EmergencyStatus | null = null;
  let toStatus: EmergencyStatus | null = null;
  const tx = await ref.transaction((current: Emergency | null) => {
    if (current === null) return null;
    fromStatus = current.status;
    toStatus = nextStatus(current.status, action);
    if (toStatus === null) return undefined;
    // Re-assigning the same responder is a no-op (no duplicate audit entries).
    if (action === "assignResponder" && current.responder?.uid === responderUid) {
      toStatus = null;
      return undefined;
    }
    const next: Emergency = { ...current, status: toStatus, updatedAt: now };
    if (action === "acknowledge" || ((action === "assignResponder" || action === "markInProgress") && UNACKED.includes(current.status))) {
      next.acknowledgedBy = uid;
      next.acknowledgedAt = now;
    }
    if (action === "assignResponder") next.responder = { uid: responderUid!, name: responderName!, assignedAt: now };
    if (action === "resolve") next.resolution = { note: note!, by: uid, at: now };
    if (action === "reopen") next.resolution = null;
    if (action === "review") next.review = { label: label!, note: note ?? undefined, by: uid, at: now };
    return clean(next);
  });
  if (!tx.snapshot.exists()) throw notFound("Alert not found.");
  if (!tx.committed) {
    if (action === "assignResponder" && (tx.snapshot.val() as Emergency).responder?.uid === responderUid) throw conflict("This responder is already assigned.");
    throw conflict(`Cannot ${action} an alert that is ${fromStatus ?? "in this state"}.`);
  }

  const emergency = tx.snapshot.val() as Emergency;
  const auditAction: EmergencyAuditEntry["action"] = (
    { acknowledge: "acknowledged", assignResponder: "responder_assigned", markInProgress: "in_progress", resolve: "resolved", reopen: "reopened", review: "reviewed", escalate: "escalated" } as const
  )[action];
  const multi: Record<string, unknown> = {};
  const auditKey = ctx.db.ref(paths.emergencyAudit(eventId, alertId)).push().key as string;
  multi[`${paths.emergencyAudit(eventId, alertId)}/${auditKey}`] = clean({
    action: auditAction,
    by: uid,
    at: now,
    fromStatus,
    toStatus,
    note: action === "assignResponder" ? `Responder: ${responderName}` : action === "review" ? `${label}${note ? ` — ${note}` : ""}` : note,
  });
  if (emergency.origin) {
    multi[`${paths.sosRequests(emergency.origin.uid)}/${emergency.origin.requestId}/alertStatus`] = emergency.status;
    if (emergency.status === "resolved") multi[`${paths.sosRequests(emergency.origin.uid)}/_active`] = null;
  }
  await ctx.db.ref().update(multi);
  const from = fromStatus as EmergencyStatus | null; // assigned inside the transaction callback
  if (from !== emergency.status) await syncAfterTransition(ctx, emergency, from);
  return { alertId, status: emergency.status };
}
