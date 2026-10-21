/**
 * Device ↔ participant assignment workflow (Module C).
 *
 * assignDevice:  locks the device record with a transaction (available + no active assignment),
 *                then locks the participant (no active assignment), then writes the assignment.
 *                If the second lock fails the first is rolled back.
 * returnDevice / cancelAssignment: transaction on the device (must still point at this
 *                assignment), closes the assignment, unlinks the attendee app, revokes claim codes.
 * issueClaimCode: short-lived one-time code (QR "FESTNET-CLAIM:<code>") for the attendee app.
 * redeemClaim:   attendee app request → validated server-side → attendeeLinks/{uid}.
 * Telemetry is associated with the active assignment by the backend processor, never by the band.
 */
import { paths, type Assignment, type ClaimCodeRecord, type DeviceRecord, type FestEvent, type Participant } from "../shared";
import { requireEventAccess, requireEventExists } from "./access";
import { audit } from "./audit";
import { clean, conflict, invalid, notFound, SERVER_TIMESTAMP, type ServiceContext } from "./context";
import {
  ASSIGNMENT_ID_PATTERN,
  DEVICE_ID_PATTERN,
  EVENT_ID_PATTERN,
  hashClaimCode,
  newAssignmentId,
  newClaimCode,
  normalizeClaimCode,
  PARTICIPANT_ID_PATTERN,
} from "./ids";
import { allowOnly, oneOf, str, type Payload } from "./validate";

export const CLAIM_CODE_TTL_MS = 15 * 60_000;

// ---------------------------------------------------------------------------
// Pure checks (unit-tested)
// ---------------------------------------------------------------------------

export function deviceAssignBlocker(device: DeviceRecord | null): string | null {
  if (!device || !device.inventoryStatus) return "Device is not registered in the inventory.";
  if (device.currentAssignmentId) return "Device already has an active assignment.";
  if (device.inventoryStatus !== "available") return `Device is ${device.inventoryStatus}, not available.`;
  return null;
}

export function participantAssignBlocker(participant: Participant | null, eventId: string): string | null {
  if (!participant) return "Participant not found in this event.";
  if (participant.eventId !== eventId) return "Participant belongs to a different event.";
  if (participant.activeAssignmentId) return "Participant already has an active device.";
  return null;
}

export function eventAssignBlocker(event: FestEvent): string | null {
  return event.status === "active" ? null : `Event is ${event.status}; devices can only be assigned while it is active.`;
}

export function claimCodeBlocker(record: ClaimCodeRecord | null, now: number): string | null {
  if (!record) return "invalid";
  if (record.revoked) return "revoked";
  if (record.usedAt) return "used";
  if (record.expiresAt < now) return "expired";
  return null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function assignDevice(ctx: ServiceContext, uid: string, p: Payload) {
  allowOnly(p, ["eventId", "deviceId", "participantId", "zone"]);
  const eventId = str(p, "eventId", { pattern: EVENT_ID_PATTERN });
  const deviceId = str(p, "deviceId", { pattern: DEVICE_ID_PATTERN }).toUpperCase();
  const participantId = str(p, "participantId", { pattern: PARTICIPANT_ID_PATTERN });
  const zone = str(p, "zone", { max: 40, optional: true });
  await requireEventAccess(ctx, uid, eventId, ["eventOperator"]);
  const event = await requireEventExists(ctx, eventId);
  const eventProblem = eventAssignBlocker(event);
  if (eventProblem) throw conflict(eventProblem);

  const now = ctx.now();
  const assignmentId = newAssignmentId(now);

  // 1) lock the device
  let deviceProblem: string | null = null;
  const deviceTx = await ctx.db.ref(paths.deviceIndexEntry(deviceId)).transaction((current: DeviceRecord | null) => {
    if (current === null) return null; // see devices.ts: let the server re-run with real data
    deviceProblem = deviceAssignBlocker(current);
    if (deviceProblem) return undefined;
    return clean({
      ...current,
      inventoryStatus: "assigned",
      currentAssignmentId: assignmentId,
      currentEventId: eventId,
      currentParticipantId: participantId,
      zone: zone ?? current.zone ?? null,
      updatedAt: now,
    });
  });
  if (!deviceTx.snapshot.exists()) throw notFound(`Device ${deviceId} is not registered.`);
  if (!deviceTx.committed || deviceTx.snapshot.child("currentAssignmentId").val() !== assignmentId) {
    throw conflict(deviceProblem ?? "Device is not available.");
  }

  // 2) lock the participant (roll back the device on failure)
  let participantProblem: string | null = null;
  const participantRef = ctx.db.ref(paths.participant(eventId, participantId));
  const partTx = await participantRef.transaction((current: Participant | null) => {
    if (current === null) return null;
    participantProblem = participantAssignBlocker(current, eventId);
    if (participantProblem) return undefined;
    return { ...current, activeAssignmentId: assignmentId };
  });
  if (!partTx.committed || partTx.snapshot.child("activeAssignmentId").val() !== assignmentId) {
    await rollbackDevice(ctx, deviceId, assignmentId);
    throw conflict(partTx.snapshot.exists() ? (participantProblem ?? "Participant cannot be assigned.") : "Participant not found in this event.");
  }

  // 3) write the assignment (+ per-event index)
  const assignment: Assignment = {
    assignmentId,
    deviceId,
    participantId,
    eventId,
    status: "active",
    startedAt: now,
    startedBy: uid,
    endedAt: null,
    endedBy: null,
    returnCondition: null,
    zone: zone ?? null,
    demo: event.demo,
    claimCodeHash: null,
  };
  try {
    await ctx.db.ref().update(
      clean({
        [paths.assignment(assignmentId)]: assignment,
        [`${paths.eventAssignments(eventId)}/${assignmentId}`]: { deviceId, participantId, status: "active", startedAt: now },
      }),
    );
  } catch (err) {
    await rollbackDevice(ctx, deviceId, assignmentId);
    await participantRef.child("activeAssignmentId").set(null);
    throw err;
  }
  await audit(ctx, eventId, "assignment_created", uid, assignmentId, { deviceId, participantId });
  return { assignmentId, deviceId, participantId };
}

async function rollbackDevice(ctx: ServiceContext, deviceId: string, assignmentId: string) {
  await ctx.db.ref(paths.deviceIndexEntry(deviceId)).transaction((current: DeviceRecord | null) => {
    if (!current || current.currentAssignmentId !== assignmentId) return current;
    return { ...current, inventoryStatus: "available", currentAssignmentId: null, currentEventId: null, currentParticipantId: null };
  });
}

async function closeAssignment(ctx: ServiceContext, uid: string, p: Payload, mode: "returned" | "cancelled") {
  allowOnly(p, ["assignmentId", "condition", "note"]);
  const assignmentId = str(p, "assignmentId", { pattern: ASSIGNMENT_ID_PATTERN });
  const condition = mode === "returned" ? oneOf(p, "condition", ["ok", "maintenance"] as const) : "ok";
  const note = str(p, "note", { max: 300, optional: true });
  if (mode === "cancelled" && !note) throw invalid("A reason is required to cancel an assignment.");

  const aRef = ctx.db.ref(paths.assignment(assignmentId));
  const assignment = (await aRef.get()).val() as Assignment | null;
  if (!assignment) throw notFound("Assignment not found.");
  await requireEventAccess(ctx, uid, assignment.eventId, ["eventOperator"], ["deviceAdmin"]);
  if (assignment.status !== "active") throw conflict(`Assignment is already ${assignment.status}.`);
  const now = ctx.now();

  // Device must still point at this assignment.
  await ctx.db.ref(paths.deviceIndexEntry(assignment.deviceId)).transaction((current: DeviceRecord | null) => {
    if (!current || current.currentAssignmentId !== assignmentId) return current;
    return clean({
      ...current,
      inventoryStatus: condition === "maintenance" ? "maintenance" : "available",
      currentAssignmentId: null,
      currentEventId: null,
      currentParticipantId: null,
      updatedAt: now,
    });
  });

  const participantRef = ctx.db.ref(paths.participant(assignment.eventId, assignment.participantId));
  const participant = (await participantRef.get()).val() as Participant | null;
  const multi: Record<string, unknown> = {
    [`${paths.assignment(assignmentId)}/status`]: mode,
    [`${paths.assignment(assignmentId)}/endedAt`]: now,
    [`${paths.assignment(assignmentId)}/endedBy`]: uid,
    [`${paths.assignment(assignmentId)}/returnCondition`]: condition,
    [`${paths.assignment(assignmentId)}/note`]: note,
    [`${paths.eventAssignments(assignment.eventId)}/${assignmentId}/status`]: mode,
    [`${paths.eventAssignments(assignment.eventId)}/${assignmentId}/endedAt`]: now,
  };
  if (participant?.activeAssignmentId === assignmentId) multi[`${paths.participant(assignment.eventId, assignment.participantId)}/activeAssignmentId`] = null;
  if (participant?.attendeeUid) {
    const link = (await ctx.db.ref(paths.attendeeLink(participant.attendeeUid)).get()).val() as { assignmentId?: string } | null;
    if (link?.assignmentId === assignmentId) multi[paths.attendeeLink(participant.attendeeUid)] = null;
  }
  if (assignment.claimCodeHash) multi[`${paths.claimCode(assignment.claimCodeHash)}/revoked`] = true;
  await ctx.db.ref().update(multi);
  await audit(ctx, assignment.eventId, mode === "returned" ? "assignment_returned" : "assignment_cancelled", uid, assignmentId, {
    deviceId: assignment.deviceId,
    condition,
  });
  return { assignmentId, status: mode };
}

export const returnDevice = (ctx: ServiceContext, uid: string, p: Payload) => closeAssignment(ctx, uid, p, "returned");
export const cancelAssignment = (ctx: ServiceContext, uid: string, p: Payload) => closeAssignment(ctx, uid, p, "cancelled");

/** One-time, 15-minute claim code for the attendee app. Replaces any previous code. */
export async function issueClaimCode(ctx: ServiceContext, uid: string, p: Payload) {
  allowOnly(p, ["assignmentId"]);
  const assignmentId = str(p, "assignmentId", { pattern: ASSIGNMENT_ID_PATTERN });
  const assignment = (await ctx.db.ref(paths.assignment(assignmentId)).get()).val() as Assignment | null;
  if (!assignment) throw notFound("Assignment not found.");
  await requireEventAccess(ctx, uid, assignment.eventId, ["eventOperator"]);
  if (assignment.status !== "active") throw conflict("Assignment is not active.");

  const code = newClaimCode();
  const hash = hashClaimCode(code);
  const expiresAt = ctx.now() + CLAIM_CODE_TTL_MS;
  const record: ClaimCodeRecord = { assignmentId, eventId: assignment.eventId, expiresAt, createdBy: uid, usedAt: null, usedBy: null, revoked: false };
  const multi: Record<string, unknown> = {
    [paths.claimCode(hash)]: record,
    [`${paths.assignment(assignmentId)}/claimCodeHash`]: hash,
  };
  if (assignment.claimCodeHash) multi[`${paths.claimCode(assignment.claimCodeHash)}/revoked`] = true;
  await ctx.db.ref().update(clean(multi));
  await audit(ctx, assignment.eventId, "claim_code_issued", uid, assignmentId);
  // The code is returned only in this staff member's own command result.
  return { code, expiresAt, qrPayload: `FESTNET-CLAIM:${code}` };
}

/** Attendee app: redeem a claim code → attendeeLinks/{uid}. Generic errors avoid code probing. */
export async function redeemClaim(ctx: ServiceContext, uid: string, requestId: string, rawCode: unknown): Promise<void> {
  const reqRef = ctx.db.ref(`${paths.claimRequests(uid)}/${requestId}`);
  const reject = (error: string) => reqRef.update({ status: "rejected", error, processedAt: SERVER_TIMESTAMP });
  const code = typeof rawCode === "string" ? normalizeClaimCode(rawCode) : "";
  if (code.length !== 8) return void (await reject("Code is invalid or has expired. Ask staff for a new code."));

  const now = ctx.now();
  const hash = hashClaimCode(code);
  let problem: string | null = null;
  const tx = await ctx.db.ref(paths.claimCode(hash)).transaction((current: ClaimCodeRecord | null) => {
    if (current === null) return null;
    problem = claimCodeBlocker(current, now);
    if (problem) return undefined;
    return { ...current, usedAt: now, usedBy: uid };
  });
  if (!tx.snapshot.exists() || !tx.committed || tx.snapshot.child("usedBy").val() !== uid) {
    ctx.log("warn", "claim rejected", { reason: problem ?? "invalid" });
    return void (await reject("Code is invalid or has expired. Ask staff for a new code."));
  }
  const record = tx.snapshot.val() as ClaimCodeRecord;
  const assignment = (await ctx.db.ref(paths.assignment(record.assignmentId)).get()).val() as Assignment | null;
  if (!assignment || assignment.status !== "active") return void (await reject("This device is no longer assigned. Ask staff for help."));

  await ctx.db.ref().update(
    clean({
      [paths.attendeeLink(uid)]: {
        participantId: assignment.participantId,
        eventId: assignment.eventId,
        deviceId: assignment.deviceId,
        assignmentId: assignment.assignmentId,
        linkedAt: now,
      },
      [`${paths.participant(assignment.eventId, assignment.participantId)}/attendeeUid`]: uid,
      [`${paths.claimRequests(uid)}/${requestId}/status`]: "linked",
      [`${paths.claimRequests(uid)}/${requestId}/error`]: null,
      [`${paths.claimRequests(uid)}/${requestId}/processedAt`]: now,
    }),
  );
  await audit(ctx, assignment.eventId, "attendee_linked", "attendee-app", assignment.assignmentId);
}
