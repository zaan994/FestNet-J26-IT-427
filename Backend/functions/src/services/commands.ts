/**
 * Command queue: commands/{uid}/{commandId} written by staff clients, executed here by the
 * trusted backend (Cloud Function trigger or local worker). Each command is claimed with a
 * transaction so it runs once even if both hosts see it; the result is written back to the
 * same node, which only that staff member can read.
 */
import { invalidateAssignmentCache } from "../health/store";
import { paths, type Command, type CommandType } from "../shared";
import { cancelAssignment, assignDevice, issueClaimCode, returnDevice } from "./assignments";
import { SERVER_TIMESTAMP, ServiceError, clean, type ServiceContext } from "./context";
import { registerDevice, updateDevice } from "./devices";
import { transitionEmergency } from "./emergencies";
import { createEvent, setEventStaff, updateEvent } from "./events";
import { createParticipant } from "./participants";
import { exportResearch } from "./research";
import { setGlobalRole } from "./roles";
import { asPayload, type Payload } from "./validate";

type Handler = (ctx: ServiceContext, uid: string, payload: Payload) => Promise<Record<string, unknown>>;

const HANDLERS: Record<CommandType, Handler> = {
  createEvent,
  updateEvent,
  setEventStaff,
  registerDevice,
  updateDevice,
  createParticipant,
  assignDevice,
  returnDevice,
  cancelAssignment,
  issueClaimCode,
  acknowledgeAlert: (ctx, uid, p) => transitionEmergency(ctx, uid, "acknowledge", p),
  assignResponder: (ctx, uid, p) => transitionEmergency(ctx, uid, "assignResponder", p),
  markAlertInProgress: (ctx, uid, p) => transitionEmergency(ctx, uid, "markInProgress", p),
  resolveAlert: (ctx, uid, p) => transitionEmergency(ctx, uid, "resolve", p),
  reopenAlert: (ctx, uid, p) => transitionEmergency(ctx, uid, "reopen", p),
  reviewAlert: (ctx, uid, p) => transitionEmergency(ctx, uid, "review", p),
  exportResearch,
  setGlobalRole,
};

export const COMMAND_TYPES = Object.keys(HANDLERS) as CommandType[];

/** Commands older than this are rejected (e.g. queued while the backend was down) — never replayed. */
export const COMMAND_MAX_AGE_MS = 10 * 60_000;

export async function executeCommand(ctx: ServiceContext, uid: string, commandId: string, command: Command | null): Promise<void> {
  if (!command || command.status) return;
  const ref = ctx.db.ref(paths.command(uid, commandId));
  if (typeof command.createdAt === "number" && ctx.now() - command.createdAt > COMMAND_MAX_AGE_MS) {
    await ref.update({ status: "error", error: "This request expired before the server processed it. Please retry.", processedAt: SERVER_TIMESTAMP });
    return;
  }

  // Claim: only one host executes a command.
  const claim = await ref.child("status").transaction((current: unknown) => (current ? undefined : "processing"));
  if (!claim.committed) return;

  try {
    const handler = HANDLERS[command.type as CommandType];
    if (!handler) throw new ServiceError("invalid-argument", `Unknown command "${String(command.type)}".`);
    const result = await handler(ctx, uid, asPayload(command.payload ?? {}));
    if (command.type === "assignDevice" || command.type === "returnDevice" || command.type === "cancelAssignment") {
      invalidateAssignmentCache(); // processor in this host sees the new assignment immediately
    }
    await ref.update(clean({ status: "ok", result, error: null, processedAt: SERVER_TIMESTAMP }));
    ctx.log("info", "command ok", { type: command.type, commandId });
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : "The server could not complete this action. Please retry.";
    ctx.log(err instanceof ServiceError ? "warn" : "error", "command failed", {
      type: command.type,
      commandId,
      code: err instanceof ServiceError ? err.code : "internal",
      error: err instanceof ServiceError ? err.message : String(err),
    });
    await ref.update({ status: "error", error: message, result: null, processedAt: SERVER_TIMESTAMP });
  }
}
