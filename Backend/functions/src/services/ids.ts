/** Opaque identifiers and one-time codes. Nothing here encodes personal or health data. */
import { createHash, randomBytes } from "node:crypto";

/** No 0/O/1/I to avoid misreading printed codes. 32 symbols → unbiased with byte % 32. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

export const DEVICE_ID_PATTERN = /^[A-Z0-9_-]{3,32}$/;
export const PARTICIPANT_ID_PATTERN = /^P-[A-Z0-9]{8}$/;
export const ASSIGNMENT_ID_PATTERN = /^A-[A-Z0-9-]{6,32}$/;
export const EVENT_ID_PATTERN = /^[a-z0-9-]{3,40}$/;
export const ALERT_ID_PATTERN = /^[A-Za-z0-9_-]{6,40}$/;

/** Pseudonymous attendee id, e.g. P-7K3QX9AB. Not derived from any personal data. */
export const newParticipantId = () => `P-${randomCode(8)}`;

/** Assignment session id, time-sortable, e.g. A-LZ3K9Q2A-7KQX. */
export const newAssignmentId = (now: number) => `A-${now.toString(36).toUpperCase()}-${randomCode(4)}`;

export function newEventId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return `${slug || "event"}-${randomCode(4).toLowerCase()}`;
}

/** 8-character one-time claim code shown to the attendee (QR + text). */
export const newClaimCode = () => randomCode(8);

/** Claim codes are stored only as SHA-256 hashes. */
export function normalizeClaimCode(input: string): string {
  return input.trim().toUpperCase().replace(/^FESTNET-CLAIM:/, "").replace(/[^A-Z0-9]/g, "");
}

export function hashClaimCode(code: string): string {
  return createHash("sha256").update(`festnet-claim:${normalizeClaimCode(code)}`).digest("hex");
}

/** Database-key-safe idempotency key. */
export function safeKey(key: string): string {
  return key.replace(/[.#$/[\]]/g, "_").slice(0, 200);
}
