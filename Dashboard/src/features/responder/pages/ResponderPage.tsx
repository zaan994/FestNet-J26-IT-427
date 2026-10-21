import { ref, serverTimestamp, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { AlertStatusBadge, Badge, SeverityBadge } from "@/components/common/Badges";
import { PageHeader } from "@/components/common/PageHeader";
import { CommandFeedback, EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/common/States";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useInbox } from "@/hooks/useEventData";
import { useNow } from "@/hooks/useNow";
import { useRealtimeValue } from "@/hooks/useRealtimeValue";
import { disablePush, enablePush, pushEnabledHere, pushSupported, VAPID_KEY } from "@/services/push";
import type { InboxEntry, ResponderRecord } from "@/types";
import { timeAgo } from "@/utils/format";
import { haversineMeters } from "@shared/geo";
import { paths } from "@shared/paths";

// C2 — a staff member's own response setup: duty, location sharing (for nearby routing), push, inbox.

/** Location is written at most this often while on duty (fresh enough for the 120 s routing limit). */
const LOCATION_WRITE_MS = 20_000;

function useDutyLocation(uid: string | null, onDuty: boolean) {
  const [state, setState] = useState<{ error: string | null; last: GeolocationPosition | null }>({ error: null, last: null });
  const lastWrite = useRef(0);
  useEffect(() => {
    if (!uid || !onDuty) return;
    if (!("geolocation" in navigator)) {
      setState({ error: "This browser cannot share location.", last: null });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({ error: null, last: pos });
        if (Date.now() - lastWrite.current < LOCATION_WRITE_MS) return;
        lastWrite.current = Date.now();
        void update(ref(db, paths.responder(uid)), {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
          locationUpdatedAt: serverTimestamp(),
        }).catch(() => setState((s) => ({ ...s, error: "Could not save your location (permission or connection)." })));
      },
      (err) => setState({ error: err.code === err.PERMISSION_DENIED ? "Location permission denied — nearby alerts need your location." : "Location unavailable.", last: null }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [uid, onDuty]);
  return state;
}

function InboxItem({ item, me }: { item: InboxEntry; me: GeolocationPosition | null }) {
  const ack = useCommand("acknowledgeAlert");
  const go = useCommand("markAlertInProgress");
  const now = useNow(5000);
  const base = { eventId: item.eventId, alertId: item.alertId };
  const distance =
    me && item.location ? Math.round(haversineMeters({ latitude: me.coords.latitude, longitude: me.coords.longitude }, item.location)) : null;
  const unacked = item.status === "open" || item.status === "escalated";
  return (
    <li className={`rounded-xl border p-4 ${unacked ? "border-status-critical/60 bg-status-critical/5" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={item.severity} />
        <b>{item.type === "sos" ? "SOS" : "Health alert"}</b>
        <span className="text-sm text-muted">{item.deviceId ?? "app"}</span>
        <span className="ml-auto">
          <AlertStatusBadge status={item.status} />
        </span>
      </div>
      <p className="mt-2 text-sm">{item.summary}</p>
      <p className="mt-1 text-xs text-muted">
        {timeAgo(item.createdAt, now)} · you were notified as {item.role}
        {item.location ? ` · fix ${timeAgo(item.location.fixAt, now)}` : " · no GPS fix"}
        {distance !== null ? ` · about ${distance} m from you` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.location && (
          <a className="btn-outline btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.latitude},${item.location.longitude}`}>
            Directions
          </a>
        )}
        {unacked && (
          <button type="button" className="btn-primary btn-sm" disabled={ack.pending} onClick={() => void ack.run(base)}>
            Acknowledge
          </button>
        )}
        {(unacked || item.status === "acknowledged") && (
          <button type="button" className="btn-outline btn-sm" disabled={go.pending} onClick={() => void go.run(base)}>
            On my way
          </button>
        )}
        {item.role !== "volunteer" && (
          <Link className="btn-ghost btn-sm" to={`/emergency?alert=${encodeURIComponent(item.alertId)}`}>
            Open in command centre
          </Link>
        )}
      </div>
      <CommandFeedback pending={ack.pending || go.pending} error={ack.error ?? go.error} success={ack.result ? "Acknowledged" : go.result ? "Marked in progress" : null} />
    </li>
  );
}

export function ResponderPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const record = useRealtimeValue<ResponderRecord>(uid ? paths.responder(uid) : null);
  const onDuty = record.data?.onDuty === true;
  const location = useDutyLocation(uid, onDuty);
  const inbox = useInbox(uid);
  const [push, setPush] = useState<{ supported: boolean; enabled: boolean; message: string | null; busy: boolean }>({ supported: false, enabled: false, message: null, busy: false });

  useEffect(() => {
    void pushSupported().then((supported) => setPush((p) => ({ ...p, supported, enabled: pushEnabledHere() })));
  }, []);

  const setDuty = (value: boolean) => uid && void update(ref(db, paths.responder(uid)), { onDuty: value });
  const togglePush = async () => {
    if (!uid) return;
    setPush((p) => ({ ...p, busy: true, message: null }));
    if (push.enabled) {
      await disablePush(uid);
      setPush((p) => ({ ...p, busy: false, enabled: false, message: "Push notifications turned off on this browser." }));
    } else {
      const r = await enablePush(uid);
      setPush((p) => ({ ...p, busy: false, enabled: r.ok, message: r.ok ? "Push notifications are on for this browser." : r.reason }));
    }
  };
  const tokens = Object.keys(record.data?.tokens ?? {}).length;

  return (
    <>
      <PageHeader eyebrow="Component 2 · Responder" title="My response" subtitle="Your duty status, location sharing and the alerts sent to you." />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="text-lg font-bold">On duty</h2>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={onDuty} onChange={(e) => setDuty(e.target.checked)} />
            I am on duty and can respond to nearby alerts
          </label>
          {onDuty ? (
            location.error ? (
              <ErrorState message={location.error} />
            ) : location.last ? (
              <p className="text-sm text-muted">
                Sharing your location (±{Math.round(location.last.coords.accuracy)} m). Saved {record.data?.locationUpdatedAt ? timeAgo(record.data.locationUpdatedAt) : "—"}.
              </p>
            ) : (
              <p className="text-sm text-muted">Waiting for your location…</p>
            )
          ) : (
            <p className="text-sm text-muted">Your location is not shared while you are off duty.</p>
          )}
          <p className="text-xs text-muted">Location is used only to find the responders nearest to an alert, and only while this page is open and you are on duty.</p>
        </section>

        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Notifications</h2>
          {!VAPID_KEY ? (
            <Notice>Push notifications are not configured for this dashboard. Alerts still appear here and in Emergency Command.</Notice>
          ) : !push.supported ? (
            <Notice>This browser does not support push notifications.</Notice>
          ) : (
            <button type="button" className={push.enabled ? "btn-outline" : "btn-primary"} disabled={push.busy} onClick={() => void togglePush()}>
              {push.enabled ? "Turn off push on this browser" : "Turn on push notifications"}
            </button>
          )}
          {push.message && <p className="text-sm">{push.message}</p>}
          <p className="text-xs text-muted">
            Registered devices: <Badge>{tokens}</Badge> (browsers and phones with the FestNet app)
          </p>
        </section>
      </div>

      <section className="card mt-5">
        <h2 className="mb-3 text-lg font-bold">Alerts sent to me</h2>
        {inbox.error && <ErrorState message={inbox.error} />}
        {inbox.loading ? (
          <SkeletonRows rows={3} cols={3} />
        ) : inbox.data.length === 0 ? (
          <EmptyState title="No alerts sent to you" />
        ) : (
          <ul className="space-y-3">
            {inbox.data.map((item) => (
              <InboxItem key={item.alertId} item={item} me={location.last} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
