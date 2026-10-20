/** Payload validation helpers for commands (type, size, allowed field set). */
import { invalid } from "./context";

export type Payload = Record<string, unknown>;

export const MAX_COMMAND_BYTES = 16_000;

export function asPayload(value: unknown): Payload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Payload must be an object.");
  if (JSON.stringify(value).length > MAX_COMMAND_BYTES) throw invalid("Payload is too large.");
  return value as Payload;
}

/** Rejects unknown fields so clients cannot smuggle extra data into records. */
export function allowOnly(payload: Payload, allowed: string[]): void {
  const extra = Object.keys(payload).filter((k) => !allowed.includes(k));
  if (extra.length) throw invalid(`Unknown field(s): ${extra.join(", ")}.`);
}

export function str(payload: Payload, key: string, opts: { max?: number; pattern?: RegExp; optional?: false }): string;
export function str(payload: Payload, key: string, opts: { max?: number; pattern?: RegExp; optional: true }): string | null;
export function str(payload: Payload, key: string, opts: { max?: number; pattern?: RegExp; optional?: boolean } = {}): string | null {
  const v = payload[key];
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return null;
    throw invalid(`"${key}" is required.`);
  }
  if (typeof v !== "string") throw invalid(`"${key}" must be text.`);
  const s = v.trim();
  if (s.length > (opts.max ?? 200)) throw invalid(`"${key}" is too long (max ${opts.max ?? 200}).`);
  if (opts.pattern && !opts.pattern.test(s)) throw invalid(`"${key}" has an invalid format.`);
  return s;
}

export function bool(payload: Payload, key: string, fallback?: boolean): boolean {
  const v = payload[key];
  if (v === undefined || v === null) {
    if (fallback !== undefined) return fallback;
    throw invalid(`"${key}" is required.`);
  }
  if (typeof v !== "boolean") throw invalid(`"${key}" must be true or false.`);
  return v;
}

export function oneOf<T extends string>(payload: Payload, key: string, values: readonly T[], optional = false): T | null {
  const v = payload[key];
  if ((v === undefined || v === null) && optional) return null;
  if (typeof v !== "string" || !values.includes(v as T)) throw invalid(`"${key}" must be one of: ${values.join(", ")}.`);
  return v as T;
}

export function epoch(payload: Payload, key: string): number | null {
  const v = payload[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 1_600_000_000_000 || v > 4_100_000_000_000) {
    throw invalid(`"${key}" must be a valid timestamp.`);
  }
  return v;
}

/** Short free-text list (help points, safety info). */
export function stringList(payload: Payload, key: string, maxItems = 20, maxLen = 300): string[] | null {
  const v = payload[key];
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length > maxItems) throw invalid(`"${key}" must be a list of at most ${maxItems} items.`);
  return v.map((item, i) => {
    if (typeof item !== "string" || item.length > maxLen) throw invalid(`"${key}[${i}]" must be text up to ${maxLen} characters.`);
    return item.trim();
  });
}
