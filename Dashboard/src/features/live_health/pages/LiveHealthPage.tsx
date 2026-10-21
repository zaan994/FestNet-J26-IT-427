import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge, ConfidenceBadge, FreshnessBadge, HriBadge } from "@/components/common/Badges";
import { InfoTip } from "@/components/common/InfoTip";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination, usePagination } from "@/components/common/Pagination";
import { EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/common/States";
import { activityText, bpmText, spo2Text, surfaceTempText } from "@/components/health/Metrics";
import { TIPS } from "@/constants/explanations";
import { useEventContext } from "@/hooks/useEventContext";
import { useEventDevices, type EventDeviceRow } from "@/hooks/useEventDevices";
import { timeAgo } from "@/utils/format";

// C1 — Real-Time Health Monitoring (Rizvi M.Z.M.)

type Filter = "all" | "sos" | "attention" | "not_live" | "low_confidence";
type Sort = "priority" | "device" | "hri" | "freshness";

const HRI_RANK = { high: 3, elevated: 2, low: 1, insufficient_data: 0 } as const;

/** SOS first (manual SOS is independent of HRI), then HRI status, then freshness. */
function priority(r: EventDeviceRow): number {
  const hri = r.health?.hri;
  const hriRank = hri && hri.confidence.level !== "low" && hri.confidence.level !== "none" ? HRI_RANK[hri.status] : 0;
  return (r.sosActive ? 100 : 0) + hriRank * 10 + (r.freshness === "live" ? 1 : 0);
}

function matches(r: EventDeviceRow, filter: Filter): boolean {
  const hri = r.health?.hri;
  switch (filter) {
    case "sos":
      return r.sosActive;
    case "attention":
      return r.sosActive || hri?.status === "elevated" || hri?.status === "high";
    case "not_live":
      return r.freshness !== "live";
    case "low_confidence":
      return !hri || hri.confidence.level === "low" || hri.confidence.level === "none";
    default:
      return true;
  }
}

const GPS_LABEL = { fresh: "Fix · current", stale: "Fix · STALE", no_fix: "No fix", unknown: "Unknown" } as const;

export function LiveHealthPage() {
  const { selectedEventId, selectedEvent } = useEventContext();
  const { rows, loading, error, now } = useEventDevices(selectedEventId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("priority");

  const visible = useMemo(() => {
    const q = search.trim().toUpperCase();
    const list = rows.filter((r) => matches(r, filter) && (!q || r.deviceId.toUpperCase().includes(q) || r.participantId.toUpperCase().includes(q)));
    return list.sort((a, b) => {
      if (sort === "device") return a.deviceId.localeCompare(b.deviceId);
      if (sort === "hri") return (b.health?.hri.hriScore ?? -1) - (a.health?.hri.hriScore ?? -1);
      if (sort === "freshness") return (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
      return priority(b) - priority(a) || a.deviceId.localeCompare(b.deviceId);
    });
  }, [rows, search, filter, sort]);
  const pager = usePagination(visible, 50);

  const live = rows.filter((r) => r.freshness === "live").length;
  const sos = rows.filter((r) => r.sosActive).length;

  if (!selectedEventId) return <EmptyState title="No event selected">Select an event in the top bar. You only see events you are staff of.</EmptyState>;

  return (
    <>
      <PageHeader
        eyebrow="Component 1 · Real-time health"
        title="Live Health"
        subtitle={
          <>
            {selectedEvent?.name} · <b className="text-ink">{live}</b> of {rows.length} assigned bands live ·{" "}
            <b className={sos ? "text-status-critical" : "text-ink"}>{sos}</b> SOS
          </>
        }
      />

      {/* Research note (not shown): HRI is research-stage and SpO2 is uncalibrated — see docs/research. */}
      <Notice>
        Heart rate is shown only when the signal quality is good. Temperatures are <b>surface</b> readings at the band, not core body temperature.
        The Health Risk Indicator supports staff decisions; it is not a diagnosis.
      </Notice>

      <section className="card mt-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm">
            <span className="eyebrow">Search</span>
            <input className="input mt-1" placeholder="Device or participant ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="eyebrow">Show</span>
            <select className="input mt-1" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All assigned bands</option>
              <option value="attention">Needs attention (SOS / elevated / high)</option>
              <option value="sos">SOS only</option>
              <option value="not_live">Stale / offline</option>
              <option value="low_confidence">Low confidence / no HRI</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="eyebrow">Sort</span>
            <select className="input mt-1" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="priority">Priority (SOS, HRI)</option>
              <option value="hri">HRI score</option>
              <option value="freshness">Last update</option>
              <option value="device">Device ID</option>
            </select>
          </label>
        </div>

        {error && <ErrorState message={error} />}
        {loading ? (
          <SkeletonRows rows={6} cols={8} />
        ) : rows.length === 0 ? (
          <EmptyState title="No bands assigned in this event">Assign a band to a participant on the Event &amp; Devices page.</EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="No bands match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr>
                  <th className="th">Band / participant</th>
                  <th className="th">
                    Freshness
                    <InfoTip text={TIPS.freshness} />
                  </th>
                  <th className="th">
                    Heart rate
                    <InfoTip text={TIPS.bpm} />
                  </th>
                  <th className="th">
                    SpO2
                    <InfoTip text={TIPS.spo2} />
                  </th>
                  <th className="th">
                    Surface temp
                    <InfoTip text={TIPS.surfaceTemp} />
                  </th>
                  <th className="th">Activity</th>
                  <th className="th">
                    HRI
                    <InfoTip text={TIPS.hri} />
                  </th>
                  <th className="th">
                    GPS
                    <InfoTip text={TIPS.gps} />
                  </th>
                  <th className="th">SOS</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => (
                  <tr key={r.assignment.assignmentId} className={`border-t border-line ${r.sosActive ? "bg-status-critical/5" : ""}`}>
                    <td className="td">
                      <Link to={`/devices/${encodeURIComponent(r.deviceId)}`} className="font-semibold text-brand hover:underline">
                        {r.deviceId}
                      </Link>
                      <p className="font-mono text-xs text-muted">{r.participantId}</p>
                    </td>
                    <td className="td">
                      <FreshnessBadge freshness={r.freshness} age={timeAgo(r.lastSeenAt, now)} />
                      {r.error && <p className="mt-1 text-xs text-status-critical">{r.error}</p>}
                    </td>
                    <td className="td tabular-nums">
                      {bpmText(r.health)}
                      {r.health && !r.health.worn && <p className="text-xs text-muted">not worn</p>}
                    </td>
                    <td className="td text-muted">{spo2Text(r.health)}</td>
                    <td className="td tabular-nums">{surfaceTempText(r.health?.temperature.surfaceC ?? r.latest?.temperature.surfaceC)}</td>
                    <td className="td">{activityText(r.health)}</td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1">
                        <HriBadge hri={r.health?.hri} />
                        {r.health && <ConfidenceBadge level={r.health.hri.confidence.level} value={r.health.hri.confidence.value} />}
                      </div>
                    </td>
                    <td className="td text-xs">{GPS_LABEL[r.gps]}</td>
                    <td className="td">
                      {r.sosActive ? (
                        <Badge tone="critical" icon={<span aria-hidden="true">⚠</span>}>
                          SOS
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...pager} />
      </section>
    </>
  );
}
