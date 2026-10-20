/**
 * Bounded, event-scoped subscriptions. Nothing here reads all events, all devices, raw PPG/IMU
 * chunks, or unbounded history: lists are limited and history is time-windowed + capped.
 */
import { endAt, equalTo, limitToLast, onValue, orderByChild, query, ref, startAt, type Query } from "firebase/database";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/config/firebase";
import type {
  Assignment,
  AssignmentStats,
  AuditEntry,
  DeviceLive,
  DeviceRecord,
  Emergency,
  EmergencyAuditEntry,
  EventPublicInfo,
  HistoryPoint,
  Participant,
  ResearchExport,
} from "@/types";
import { normalizeHealth } from "@/utils/deviceRow";
import { paths } from "@shared/paths";
import { parseLatest } from "@shared/telemetry";

export interface Loadable<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

const permissionMessage = (err: Error) =>
  /permission/i.test(err.message) ? "You do not have permission to view this data." : "Could not load data. Check your connection and retry.";

/** Generic live query → Loadable. Pass null to skip. */
function useLive<T>(q: Query | null, map: (val: unknown) => T, empty: T, deps: unknown[]): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ data: empty, loading: q !== null, error: null });
  useEffect(() => {
    if (!q) {
      setState({ data: empty, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onValue(
      q,
      (snap) => setState({ data: map(snap.val()), loading: false, error: null }),
      (err) => setState({ data: empty, loading: false, error: permissionMessage(err) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

const toRecord = <T,>(v: unknown) => (v && typeof v === "object" ? (v as Record<string, T>) : {});

export interface EventAssignmentRow {
  assignmentId: string;
  deviceId: string;
  participantId: string;
  status: Assignment["status"];
  startedAt: number;
  endedAt?: number | null;
}

/** eventAssignments/{eventId}: active only (default) or the most recent N. */
export function useEventAssignments(eventId: string | null, mode: "active" | "recent" = "active") {
  const q = eventId
    ? mode === "active"
      ? query(ref(db, paths.eventAssignments(eventId)), orderByChild("status"), equalTo("active"))
      : query(ref(db, paths.eventAssignments(eventId)), orderByChild("startedAt"), limitToLast(300))
    : null;
  return useLive<EventAssignmentRow[]>(
    q,
    (v) =>
      Object.entries(toRecord<Omit<EventAssignmentRow, "assignmentId">>(v))
        .map(([assignmentId, row]) => ({ assignmentId, ...row }))
        .sort((a, b) => b.startedAt - a.startedAt),
    [],
    [eventId, mode],
  );
}

export function useAssignment(assignmentId: string | null) {
  return useLive<Assignment | null>(assignmentId ? ref(db, paths.assignment(assignmentId)) : null, (v) => (v as Assignment) ?? null, null, [assignmentId]);
}

export function useParticipants(eventId: string | null) {
  return useLive<Participant[]>(
    eventId ? query(ref(db, paths.participants(eventId)), orderByChild("createdAt"), limitToLast(500)) : null,
    (v) => Object.values(toRecord<Participant>(v)).sort((a, b) => b.createdAt - a.createdAt),
    [],
    [eventId],
  );
}

export function useEventPublic(eventId: string | null) {
  return useLive<EventPublicInfo | null>(eventId ? ref(db, paths.eventPublic(eventId)) : null, (v) => (v as EventPublicInfo) ?? null, null, [eventId]);
}

/** Most recent emergencies of an event (bounded). */
export function useEmergencies(eventId: string | null, limit = 200) {
  return useLive<Emergency[]>(
    eventId ? query(ref(db, paths.emergencies(eventId)), orderByChild("createdAt"), limitToLast(limit)) : null,
    // RTDB drops empty arrays: restore `reasons` so the UI can rely on it.
    (v) =>
      Object.values(toRecord<Emergency>(v))
        .map((e) => ({ ...e, reasons: Array.isArray(e.reasons) ? e.reasons : Object.values(e.reasons ?? {}) }))
        .sort((a, b) => b.createdAt - a.createdAt),
    [],
    [eventId, limit],
  );
}

export function useEmergencyAudit(eventId: string | null, alertId: string | null) {
  return useLive<EmergencyAuditEntry[]>(
    eventId && alertId ? query(ref(db, paths.emergencyAudit(eventId, alertId)), limitToLast(100)) : null,
    (v) => Object.values(toRecord<EmergencyAuditEntry>(v)).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)),
    [],
    [eventId, alertId],
  );
}

export function useAuditLog(scope: string | null, limit = 100) {
  return useLive<(AuditEntry & { id: string })[]>(
    scope ? query(ref(db, paths.auditLog(scope)), limitToLast(limit)) : null,
    (v) =>
      Object.entries(toRecord<AuditEntry>(v))
        .map(([id, e]) => ({ id, ...e }))
        .sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    [],
    [scope, limit],
  );
}

/** Device inventory — deviceAdmin only (rules). */
export function useInventory(enabled: boolean) {
  return useLive<(DeviceRecord & { deviceId: string })[]>(
    enabled ? ref(db, paths.deviceIndex()) : null,
    (v) =>
      Object.entries(toRecord<DeviceRecord>(v))
        .map(([deviceId, d]) => ({ deviceId, ...d }))
        .sort((a, b) => a.deviceId.localeCompare(b.deviceId)),
    [],
    [enabled],
  );
}

export function useAssignmentStats(assignmentId: string | null) {
  return useLive<AssignmentStats | null>(assignmentId ? ref(db, paths.assignmentStats(assignmentId)) : null, (v) => (v as AssignmentStats) ?? null, null, [assignmentId]);
}

export function useResearchExports(enabled: boolean) {
  return useLive<ResearchExport[]>(
    enabled ? query(ref(db, paths.researchExports()), limitToLast(20)) : null,
    (v) => Object.values(toRecord<ResearchExport>(v)).sort((a, b) => b.createdAt - a.createdAt),
    [],
    [enabled],
  );
}

/**
 * Per-assignment history in a TIME WINDOW, capped at `maxPoints` (10 s resolution:
 * 1 h = 360 points). The window start is fixed when the window changes, not on every render.
 */
export function useHistory(assignmentId: string | null, windowMs: number, maxPoints = 2_200) {
  const from = useMemo(() => Date.now() - windowMs, [windowMs, assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps
  return useLive<HistoryPoint[]>(
    assignmentId ? query(ref(db, paths.healthHistory(assignmentId)), orderByChild("ts"), startAt(from), endAt(Number.MAX_SAFE_INTEGER), limitToLast(maxPoints)) : null,
    (v) => Object.values(toRecord<HistoryPoint>(v)).sort((a, b) => a.ts - b.ts),
    [],
    [assignmentId, from, maxPoints],
  );
}

/**
 * Live latest telemetry + derived health for a BOUNDED set of devices (the event's assigned bands).
 * receivedAt is the client time the telemetry last changed — the first cached value does not count,
 * so a band is never shown "live" just because an old record exists.
 */
export function useDevicesLive(deviceIds: string[]): Record<string, DeviceLive> {
  const key = [...deviceIds].sort().join(",");
  const [state, setState] = useState<Record<string, DeviceLive>>({});
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    setState(Object.fromEntries(ids.map((id) => [id, { deviceId: id, latest: null, health: null, receivedAt: null, error: null }])));
    const patch = (id: string, p: Partial<DeviceLive>) =>
      setState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { deviceId: id, latest: null, health: null, receivedAt: null, error: null }), ...p } }));
    const unsubs = ids.flatMap((id) => {
      let first = true;
      return [
        onValue(
          ref(db, paths.deviceLatest(id)),
          (snap) => {
            const parsed = parseLatest(snap.val());
            patch(id, { latest: parsed, ...(first ? {} : { receivedAt: Date.now() }) });
            first = false;
          },
          (err) => patch(id, { error: permissionMessage(err) }),
        ),
        onValue(
          ref(db, paths.deviceHealth(id)),
          (snap) => patch(id, { health: normalizeHealth(snap.val()) }),
          (err) => patch(id, { error: permissionMessage(err) }),
        ),
      ];
    });
    return () => unsubs.forEach((u) => u());
  }, [key]);
  return state;
}
