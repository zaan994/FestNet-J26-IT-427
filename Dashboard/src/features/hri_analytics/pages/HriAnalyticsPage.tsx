import { useMemo } from "react";

import { Badge } from "@/components/common/Badges";
import { InfoTip } from "@/components/common/InfoTip";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination, usePagination } from "@/components/common/Pagination";
import { CommandFeedback, EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/common/States";
import { StatTile } from "@/components/common/StatTile";
import { FLAG_LABELS, TIPS } from "@/constants/explanations";
import { usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useEventContext } from "@/hooks/useEventContext";
import { useAssignmentStats, useEmergencies, useEventAssignments, useResearchExports, type EventAssignmentRow } from "@/hooks/useEventData";
import { useHriConfig } from "@/hooks/useEventDevices";
import type { DataQualityFlag } from "@/types";
import { describeRule, HRI_DISCLAIMER } from "@shared/hriConfig";
import { downloadCsv, formatDateTime, percent } from "@/utils/format";

// C1 — HRI research analytics (Rizvi M.Z.M.)

function StatsRow({ row }: { row: EventAssignmentRow }) {
  const { data: s, loading } = useAssignmentStats(row.assignmentId);
  if (loading) {
    return (
      <tr className="border-t border-line">
        <td className="td" colSpan={7}>
          <div className="skeleton h-5" />
        </td>
      </tr>
    );
  }
  const topFlags = s
    ? (Object.entries(s.flagCounts ?? {}) as [DataQualityFlag, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3)
    : [];
  return (
    <tr className="border-t border-line align-top">
      <td className="td">
        <p className="font-semibold">{row.deviceId}</p>
        <p className="font-mono text-xs text-muted">{row.participantId}</p>
        <p className="text-xs text-muted">{row.status}</p>
      </td>
      <td className="td tabular-nums">{s ? s.chunks : "—"}</td>
      <td className="td tabular-nums">{s ? percent(s.wornChunks, s.chunks) : "—"}</td>
      <td className="td tabular-nums">{s ? percent(s.validHrChunks, s.wornChunks) : "—"}</td>
      <td className="td tabular-nums">{s ? percent(s.hriScoredChunks, s.chunks) : "—"}</td>
      <td className="td text-xs">
        {s ? (
          <>
            low {s.hriStatusCounts?.low ?? 0} · elev. {s.hriStatusCounts?.elevated ?? 0} · high {s.hriStatusCounts?.high ?? 0} · insuff. {s.hriStatusCounts?.insufficient_data ?? 0}
            <br />
            <span className="text-muted">alerts {s.hriAlerts}</span>
          </>
        ) : (
          "No processed data"
        )}
      </td>
      <td className="td text-xs">
        {topFlags.length ? topFlags.map(([f, n]) => <p key={f}>{FLAG_LABELS[f]?.label ?? f}: {n}</p>) : <span className="text-muted">—</span>}
      </td>
    </tr>
  );
}

function ResearchExportSection({ eventId }: { eventId: string }) {
  const exports = useResearchExports(true);
  const cmd = useCommand<{ exportId: string; participantCount: number; recordCount: number }>("exportResearch");
  const forEvent = exports.data.filter((e) => e.eventId === eventId);
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">De-identified research export</h2>
      <p className="text-sm text-muted">
        Only participants with recorded research consent. Rows use per-export pseudonyms (R001…), relative time and derived metrics only — no device
        IDs, GPS, account IDs or raw signals.
      </p>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={cmd.pending} onClick={() => void cmd.run({ eventId })}>
          Create export
        </button>
        <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? `${cmd.result.recordCount} rows from ${cmd.result.participantCount} participants` : null} />
      </div>
      {exports.error && <ErrorState message={exports.error} />}
      {forEvent.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {forEvent.map((e) => (
            <li key={e.exportId} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-mono text-xs">{e.exportId}</span>
              <span className="text-muted">{formatDateTime(e.createdAt)}</span>
              <Badge tone={e.status === "ready" ? "normal" : "danger"}>{e.status}</Badge>
              <span>
                {e.recordCount} rows · {e.participantCount} participants
              </span>
              <button
                type="button"
                className="btn-outline btn-sm ml-auto"
                disabled={!e.rows}
                onClick={() => downloadCsv(`festnet-research-${e.exportId}.csv`, Object.values(e.rows ?? {}) as unknown as Record<string, unknown>[])}
              >
                Download CSV
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HriAnalyticsPage() {
  const { selectedEventId } = useEventContext();
  const { isResearchAdmin, isEventStaff, isDeviceAdmin } = usePermissions(selectedEventId);
  const canSeeEvent = isEventStaff || isDeviceAdmin;
  const assignments = useEventAssignments(canSeeEvent ? selectedEventId : null, "recent");
  const emergencies = useEmergencies(canSeeEvent ? selectedEventId : null);
  const config = useHriConfig();
  const pager = usePagination(assignments.data, 25);

  const review = useMemo(() => {
    const hri = emergencies.data.filter((e) => e.type === "hri");
    const tp = hri.filter((e) => e.review?.label === "true_positive").length;
    const fp = hri.filter((e) => e.review?.label === "false_positive").length;
    const unc = hri.filter((e) => e.review?.label === "uncertain").length;
    return { total: hri.length, tp, fp, unc, unreviewed: hri.length - tp - fp - unc };
  }, [emergencies.data]);

  if (!selectedEventId) return <EmptyState title="No event selected" />;

  return (
    <>
      <PageHeader eyebrow="Component 1 · Module D" title="HRI Analytics" subtitle="Evaluation support for the experimental Health Risk Indicator." />
      <Notice tone="warning">{HRI_DISCLAIMER} Numbers on this page describe how the prototype behaved — they are not evidence of clinical accuracy.</Notice>

      {canSeeEvent && (
        <>
          <div className="my-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile kind="historical" icon="alert" label="HRI alerts (recent)" value={review.total} hint={`${review.unreviewed} not yet reviewed`} />
            <StatTile kind="historical" icon="heart" label="Reviewed: true positive" value={review.tp} hint="labelled by staff" />
            <StatTile kind="historical" icon="signal" label="Reviewed: false positive" value={review.fp} hint="labelled by staff" tone={review.fp ? "attention" : "neutral"} />
            <StatTile
              kind="historical"
              icon="chart"
              label="Precision among reviewed"
              value={review.tp + review.fp ? percent(review.tp, review.tp + review.fp) : "—"}
              hint="small-sample, unvalidated — research only"
            />
          </div>

          <section className="card">
            <h2 className="mb-1 flex items-center text-lg font-bold">
              Data quality per assignment
              <InfoTip text={TIPS.dataQuality} />
            </h2>
            <p className="mb-3 text-sm text-muted">Running counters per 2-second chunk. HRI scores are only meaningful where the share of worn, valid-HR chunks is high.</p>
            {assignments.error && <ErrorState message={assignments.error} />}
            {assignments.loading ? (
              <SkeletonRows rows={4} cols={7} />
            ) : assignments.data.length === 0 ? (
              <EmptyState title="No assignments yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr>
                      <th className="th">Band / participant</th>
                      <th className="th">Chunks</th>
                      <th className="th">Worn</th>
                      <th className="th">Valid HR (of worn)</th>
                      <th className="th">HRI scored</th>
                      <th className="th">HRI status counts</th>
                      <th className="th">Top quality flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.slice.map((a) => (
                      <StatsRow key={a.assignmentId} row={a} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination {...pager} />
          </section>
        </>
      )}

      <section className="card mt-5">
        <h2 className="text-lg font-bold">Active rule set</h2>
        <p className="mb-3 text-sm text-muted">
          {config.version} · cut-offs: elevated ≥ {config.statusCutoffs.elevated}, high ≥ {config.statusCutoffs.high} · score withheld below confidence{" "}
          {config.minConfidenceForScore} · SpO2 used in HRI: {config.spo2.useInHri ? "yes" : "no"}. "TAF" values come from the project proposal; engineering
          defaults are placeholders pending evaluation.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr>
                <th className="th">Rule</th>
                <th className="th">Points</th>
                <th className="th">Source</th>
                <th className="th">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.rules).map(([id, r]) => (
                <tr key={id} className="border-t border-line">
                  <td className="td">
                    <p className="font-mono text-xs text-muted">{id}</p>
                    {describeRule(r)}
                  </td>
                  <td className="td tabular-nums">+{r.points}</td>
                  <td className="td">
                    <Badge tone={r.source === "TAF" ? "brand" : "neutral"}>{r.source}</Badge>
                  </td>
                  <td className="td">{r.enabled ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Automated alerts: {config.alerts.enabled ? "on" : "off"} · status "high" with ≥ {config.alerts.minConfidence} confidence for {config.alerts.consecutiveChunks}{" "}
          consecutive chunks · cooldown {config.alerts.cooldownSec / 60} min · always flagged for human review.
        </p>
      </section>

      <div className="mt-5">
        {isResearchAdmin ? <ResearchExportSection eventId={selectedEventId} /> : <Notice>Research exports are available to research administrators only.</Notice>}
      </div>
    </>
  );
}
