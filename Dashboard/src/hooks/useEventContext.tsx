import { onValue, ref } from "firebase/database";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { db } from "@/config/firebase";
import type { FestEvent } from "@/types";
import { paths } from "@shared/paths";

import { useAuth } from "./useAuth";

interface EventContextState {
  /** Events this user may see (staff events; deviceAdmin / researchAdmin: all). */
  events: FestEvent[];
  selectedEventId: string | null;
  selectedEvent: FestEvent | null;
  setSelectedEventId: (id: string) => void;
  loading: boolean;
}

const EventContext = createContext<EventContextState>({
  events: [],
  selectedEventId: null,
  selectedEvent: null,
  setSelectedEventId: () => {},
  loading: true,
});

const STORAGE_KEY = "festnet-selected-event";

/** The RTDB key is the event id; older records (foundation build) may lack eventId / status. */
function normalizeEvent(key: string, raw: unknown): FestEvent {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<FestEvent>;
  return { ...v, eventId: key, name: v.name || key, status: v.status ?? "planned", demo: v.demo === true, createdAt: v.createdAt ?? 0, createdBy: v.createdBy ?? "" };
}

/**
 * The dashboard is always scoped to ONE event: every subscription below this provider is
 * event-specific (no cross-event data in the browser).
 */
export function EventProvider({ children }: { children: ReactNode }) {
  const { user, eventRoles, globalRoles } = useAuth();
  const [events, setEvents] = useState<Record<string, FestEvent>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // deviceAdmin and researchAdmin may list all events (event metadata only — no health data).
  const isDeviceAdmin = globalRoles.has("deviceAdmin") || globalRoles.has("researchAdmin");
  const staffEventIds = useMemo(() => Object.keys(eventRoles).sort(), [eventRoles]);

  useEffect(() => {
    setEvents({});
    if (!user) return;
    setLoading(true);
    if (isDeviceAdmin) {
      return onValue(
        ref(db, paths.events()),
        (s) => {
          const raw = (s.val() as Record<string, unknown> | null) ?? {};
          setEvents(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, normalizeEvent(k, v)])));
          setLoading(false);
        },
        () => setLoading(false),
      );
    }
    if (!staffEventIds.length) {
      setLoading(false);
      return;
    }
    let pending = staffEventIds.length;
    const unsubs = staffEventIds.map((id) =>
      onValue(
        ref(db, paths.event(id)),
        (s) => {
          setEvents((prev) => ({ ...prev, ...(s.exists() ? { [id]: normalizeEvent(id, s.val()) } : {}) }));
          if (--pending <= 0) setLoading(false);
        },
        () => {
          if (--pending <= 0) setLoading(false);
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [user, isDeviceAdmin, staffEventIds]);

  const list = useMemo(
    () => Object.values(events).sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [events],
  );
  const selectedEventId = selected && events[selected] ? selected : (list[0]?.eventId ?? null);

  const value = useMemo<EventContextState>(
    () => ({
      events: list,
      selectedEventId,
      selectedEvent: selectedEventId ? (events[selectedEventId] ?? null) : null,
      setSelectedEventId: (id) => {
        setSelected(id);
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {
          /* per-viewer convenience only */
        }
      },
      loading,
    }),
    [list, selectedEventId, events, loading],
  );
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEventContext() {
  return useContext(EventContext);
}
