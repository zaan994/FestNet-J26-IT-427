import { Link } from "react-router-dom";

import { AlertStatusBadge, Badge, SeverityBadge } from "@/components/common/Badges";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/common/States";
import { StatTile } from "@/components/common/StatTile";
import { useEventContext } from "@/hooks/useEventContext";
import { useEmergencies, useParticipants } from "@/hooks/useEventData";
import { useEventDevices } from "@/hooks/useEventDevices";
import { formatDateTime, timeAgo } from "@/utils/format";

export function EventOverviewPage() {
  const { selectedEventId, selectedEvent, loading: eventsLoading } = useEventContext();
  const devices = useEventDevices(selectedEventId);
  const emergencies = useEmergencies(selectedEventId);
  const participants = useParticipants(selectedEventId);

  if (eventsLoading) return <SkeletonCards />;
  if (!selectedEvent || !selectedEventId)
    return (
      <EmptyState
        title="No event available"
        action={
          <Link className="btn-primary" to="/manage">
            Create or manage events
          </Link>
        }
      >
        You are not staff of any event yet. A device administrator can create an event (Event &amp; Devices → Event settings) and add staff as
        event operator or medical responder.
      </EmptyState>
    );

  const rows = devices.rows;
  const live = rows.filter((r) => r.freshness === "live").length;
  const notLive = rows.length - live;
  const sosLive = rows.filter((r) => r.sosActive).length;
  const unresolved = emergencies.data.filter((e) => e.status !== "resolved");
  const openSos = unresolved.filter((e) => e.type === "sos").length;
  const openHri = unresolved.filter((e) => e.type === "hri").length;
  const escalated = unresolved.filter((e) => e.status === "escalated").length;
  const lowConfidence = rows.filter((r) => !r.health || r.health.hri.confidence.level === "low" || r.health.hri.confidence.level === "none").length;
  const consented = participants.data.filter((p) => p.researchConsent).length;

  return (
    <>
      <PageHeader
        eyebrow={selectedEvent.venue ?? "Event"}
        title={selectedEvent.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={selectedEvent.status === "active" ? "normal" : "neutral"}>{selectedEvent.status}</Badge>
            {selectedEvent.startTs ? `${formatDateTime(selectedEvent.startTs)} – ${formatDateTime(selectedEvent.endTs)}` : null}
          </span>
        }
      />

      {(devices.error || emergencies.error) && <ErrorState message={devices.error ?? emergencies.error ?? ""} />}

      <h2 className="eyebrow mb-3">Right now</h2>
      {devices.loading ? (
        <SkeletonCards />
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile kind="live" icon="watch" label="Bands live" value={`${live} / ${rows.length}`} hint={notLive ? `${notLive} stale or offline` : "all assigned bands reporting"} tone={notLive ? "attention" : "neutral"} />
          <StatTile kind="live" icon="sos" label="Unresolved SOS" value={openSos} hint={sosLive ? `${sosLive} band(s) with SOS flag` : "manual SOS · priority P1"} tone={openSos ? "critical" : "neutral"} />
          <StatTile kind="live" icon="heart" label="Unresolved health alerts" value={openHri} hint={escalated ? `${escalated} escalated` : "need human review"} tone={openHri ? "attention" : "neutral"} />
          <StatTile kind="live" icon="signal" label="Low / no confidence" value={lowConfidence} hint="bands whose HRI should not be relied on" tone={lowConfidence ? "attention" : "neutral"} />
        </div>
      )}

      <h2 className="eyebrow mb-3">Event records</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile kind="historical" icon="users" label="Participants" value={participants.loading ? "…" : participants.data.length} hint={`${consented} with research consent`} />
        <StatTile kind="historical" icon="alert" label="Emergencies (recent 200)" value={emergencies.loading ? "…" : emergencies.data.length} hint={`${emergencies.data.length - unresolved.length} resolved`} />
        <StatTile kind="historical" icon="chart" label="Reviewed health alerts" value={emergencies.data.filter((e) => e.type === "hri" && e.review).length} hint="labelled true / false positive" />
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent emergencies</h2>
          <Link to="/emergency" className="text-sm font-semibold text-brand hover:underline">
            Open command centre →
          </Link>
        </div>
        {emergencies.loading ? (
          <div className="skeleton h-24" />
        ) : emergencies.data.length === 0 ? (
          <p className="text-sm text-muted">No emergencies recorded for this event.</p>
        ) : (
          <ul className="divide-y divide-line">
            {emergencies.data.slice(0, 6).map((e) => (
              <li key={e.alertId} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <SeverityBadge severity={e.severity} />
                <span className="font-semibold">{e.type === "sos" ? "Manual SOS" : "Health alert"}</span>
                <span className="text-muted">{e.deviceId ?? "app"} · {e.participantId ?? "—"}</span>
                <span className="ml-auto flex items-center gap-2">
                  <AlertStatusBadge status={e.status} />
                  <span className="text-xs text-muted">{timeAgo(e.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
