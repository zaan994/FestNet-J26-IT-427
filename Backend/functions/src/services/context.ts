/**
 * Runtime-agnostic service context. The same services run inside Cloud Functions and inside the
 * local worker (Backend/scripts), each passing its own firebase-admin Database.
 * Only TYPES are imported from firebase-admin here, so nothing is loaded twice at runtime.
 */
import type { Database } from "firebase-admin/database";

export const SERVER_TIMESTAMP = { ".sv": "timestamp" } as const;

export type LogLevel = "info" | "warn" | "error";

export interface ServiceContext {
  db: Database;
  /** Server-side current time (ms). */
  now: () => number;
  /** Resolve a staff e-mail to a Firebase Auth uid (Admin SDK), if available in this host. */
  lookupUid?: (email: string) => Promise<string | null>;
  /** Structured logging. Never pass credentials or health values. */
  log: (level: LogLevel, message: string, data?: Record<string, unknown>) => void;
}

/** Errors with a stable code; the message is safe to show to the requesting staff member. */
export class ServiceError extends Error {
  constructor(
    readonly code: "permission-denied" | "invalid-argument" | "not-found" | "failed-precondition" | "already-exists",
    message: string,
  ) {
    super(message);
  }
}

export const denied = (msg = "You do not have permission for this action.") => new ServiceError("permission-denied", msg);
export const invalid = (msg: string) => new ServiceError("invalid-argument", msg);
export const notFound = (msg: string) => new ServiceError("not-found", msg);
export const conflict = (msg: string) => new ServiceError("failed-precondition", msg);

/** Drops undefined (RTDB rejects it) and turns NaN into null. */
export function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
