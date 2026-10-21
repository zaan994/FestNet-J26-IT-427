/**
 * C2 — per-device deduplication / cooldown decision (pure; runs inside a transaction on
 * emergency/deviceAlertState/{deviceId}, so concurrent or retried triggers cannot double-create).
 *
 * Policy (documented in docs/c2/contract.md):
 *  - An anomaly must persist for cfg.consecutiveChunks results before it alerts.
 *  - One open anomaly alert per device: a higher severity UPGRADES it (and re-notifies);
 *    same or lower severity is suppressed.
 *  - After acknowledgement, same-or-lower severity is suppressed for cfg.cooldownAfterAckSec.
 *  - Replayed / out-of-order health records (computedAt not newer) are ignored.
 *  - A new assignment resets streaks and trend history (no mixing of wearers).
 *  - Manual SOS never passes through here and is never suppressed.
 */
import { SEVERITY_RANK, type AlertSeverity } from "../shared";
import type { C2Config } from "../shared/c2Config";
import type { Classification } from "./classify";

export interface DeviceAlertState {
  assignmentId?: string | null;
  lastComputedAt?: number | null;
  streakCount?: number;
  openAlertId?: string | null;
  openEventId?: string | null;
  openSeverity?: AlertSeverity | null;
  cooldownUntil?: number | null;
  cooldownSeverity?: AlertSeverity | null;
  /** HRI trend points (C1 score) for the watch list; bounded. */
  series?: { t: number; s: number }[];
}

export type HealthAction =
  | { kind: "none"; reason: "replay" | "no_anomaly" | "building" | "already_open" | "cooldown" }
  | { kind: "create"; alertId: string; severity: AlertSeverity }
  | { kind: "upgrade"; alertId: string; eventId: string; from: AlertSeverity; to: AlertSeverity };

const SERIES_MAX = 40;
const SERIES_WINDOW_MS = 15 * 60_000;

export function decideHealthAction(
  previous: DeviceAlertState | null,
  cls: Classification,
  input: { nowMs: number; assignmentId: string | null; newAlertId: string; cfg: C2Config },
): { state: DeviceAlertState; action: HealthAction } {
  let state: DeviceAlertState = { ...(previous ?? {}) };
  if ((state.assignmentId ?? null) !== input.assignmentId) {
    // New wearer: keep only the open-alert link (it belongs to the device incident), reset the rest.
    state = { openAlertId: state.openAlertId ?? null, openEventId: state.openEventId ?? null, openSeverity: state.openSeverity ?? null, assignmentId: input.assignmentId };
  }

  const computedAt = cls.contributing.computedAt;
  if (computedAt !== null && state.lastComputedAt != null && computedAt <= state.lastComputedAt) {
    return { state: previous ?? state, action: { kind: "none", reason: "replay" } };
  }
  if (computedAt !== null) state.lastComputedAt = computedAt;

  // Trend history for the watch list (usable HRI scores only).
  if (cls.contributing.hriScore !== null && computedAt !== null && cls.skipped === undefined) {
    const series = [...(state.series ?? []), { t: computedAt, s: cls.contributing.hriScore }];
    state.series = series.filter((p) => computedAt - p.t <= SERIES_WINDOW_MS).slice(-SERIES_MAX);
  }

  if (!cls.severity) {
    state.streakCount = 0;
    return { state, action: { kind: "none", reason: "no_anomaly" } };
  }
  state.streakCount = (state.streakCount ?? 0) + 1;
  if (state.streakCount < Math.max(1, input.cfg.consecutiveChunks)) return { state, action: { kind: "none", reason: "building" } };

  const sev = cls.severity;
  if (state.openAlertId && state.openSeverity) {
    if (SEVERITY_RANK[sev] > SEVERITY_RANK[state.openSeverity]) {
      const from = state.openSeverity;
      state.openSeverity = sev;
      return { state, action: { kind: "upgrade", alertId: state.openAlertId, eventId: state.openEventId ?? "", from, to: sev } };
    }
    return { state, action: { kind: "none", reason: "already_open" } };
  }
  if (state.cooldownUntil != null && input.nowMs < state.cooldownUntil && state.cooldownSeverity && SEVERITY_RANK[sev] <= SEVERITY_RANK[state.cooldownSeverity]) {
    return { state, action: { kind: "none", reason: "cooldown" } };
  }
  state.openAlertId = input.newAlertId;
  state.openSeverity = sev;
  return { state, action: { kind: "create", alertId: input.newAlertId, severity: sev } };
}
