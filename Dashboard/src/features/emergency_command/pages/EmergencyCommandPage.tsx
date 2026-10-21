import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AlertStatusBadge, Badge, ConfidenceBadge, SeverityBadge } from "@/components/common/Badges";
import { InfoTip } from "@/components/common/InfoTip";
import { PageHeader } from "@/components/common/PageHeader";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { CommandFeedback, EmptyState, ErrorState, SkeletonRows } from "@/components/common/States";
import { StatTile } from "@/components/common/StatTile";
import { HRI_STATUS_LABELS, TIPS } from "@/constants/explanations";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useEventContext } from "@/hooks/useEventContext";
import { useDispatchLog, useEmergencies, useEmergencyAudit, useWatchList } from "@/hooks/useEventData";
import { useNow } from "@/hooks/useNow";
import { useRealtimeValue } from "@/hooks/useRealtimeValue";
import type { AlertSeverity, CommandType, Emergency, EventRole, ResponderRole } from "@/types";
import { formatClock, formatDateTime, timeAgo } from "@/utils/format";
import { paths } from "@shared/paths";
import { SEVERITY_RANK, UNASSIGNED_EVENT } from "@shared/schema";

// Components 1 + 2 — Emergency Command Centre: manual SOS and health alerts (C2 lifecycle).

type StatusFilter = "unresolved" | "all" | "open" | "escalated" | "acknowledged" | "in_progress" | "resolved";

/** Unresolved first, then severity (critical → warning), SOS before health at equal severity, newest first. */
export function sortAlerts(list: Emergency[]): Emergency[] {
  const sev = (e: Emergency) => SEVERITY_RANK[e.severity ?? "critical"];
  return [...list].sort(
    (a, b) =>
      Number(a.status === "resolved") - Number(b.status === "resolved") ||
      sev(b) - sev(a) ||
      Number(b.type === "sos") - Number(a.type === "sos") ||
      b.createdAt - a.createdAt,
  );
}

function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
}

const ROLE_LABEL: Record<ResponderRole, string> = { medical: "Medical", operator: "Operators", secondary: "Secondary", volunteer: "Volunteers" };
const SOURCE_LABEL: Record<string, string> = {
  device_button: "Band SOS button",
  attendee_app: "SOS from the app",
  hri_engine: "Health Risk Indicator",
  heart_rate: "Heart rate",
};

function ActionButton({ type, label, payload, needsNote, tone = "btn-outline" }: { type: CommandType; label: string; payload: Record<string, unknown>; needsNote?: boolean; tone?: string }) {
  const cmd = useCommand(type);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {needsNote && (
          <input className="input min-w-[12rem] flex-1 py-1.5 text-sm" placeholder="Note (required)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} aria-label={`${label} note`} />
        )}
        <button
          type="button"
          className={`${tone} btn-sm`}
          disabled={cmd.pending || (needsNote && !note.trim())}
          onClick={() => void cmd.run(needsNote ? { ...payload, note: note.trim() } : payload).then((r) => r && setNote(""))}
        >
          {label}
        </button>
      </div>
      <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? `${label}: done` : null} />
    </div>
  );
}

function ResponderAssign({ alert, staff }: { alert: Emergency; staff: Record<string, EventRole> }) {
  const { user, profile } = useAuth();
  const cmd = useCommand("assignResponder");
  const [target, setTarget] = useState("");
  const current = alert.responder?.uid ?? null;
  // Only offer people who are not already the assigned responder.
  const responders = Object.entries(staff).filter(([uid, r]) => (r === "medicalResponder" || r === "secondaryResponder") && uid !== current);
  const base = { eventId: alert.eventId, alertId: alert.alertId };
  const myName = profile?.displayName || user?.email || "Me";
  const assignedToMe = !!user && current === user.uid;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {assignedToMe ? (
          <Badge tone="normal">Assigned to you</Badge>
        ) : (
          <button type="button" className="btn-outline btn-sm" disabled={cmd.pending} onClick={() => void cmd.run({ ...base, responderUid: user!.uid, responderName: myName.slice(0, 80) })}>
            {current ? "Take over (assign to me)" : "Assign to me"}
          </button>
        )}
        {responders.length > 0 && (
          <>
            <select className="input w-auto py-1.5 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Responder">
              <option value="">Choose responder…</option>
              {responders.map(([uid, r]) => (
                <option key={uid} value={uid}>
                  {r === "secondaryResponder" ? "Secondary" : "Medical"} {uid.slice(0, 6)}
                </option>
              ))}
            </select>
            <button type="button" className="btn-outline btn-sm" disabled={!target || cmd.pending} onClick={() => void cmd.run({ ...base, responderUid: target, responderName: `Responder ${target.slice(0, 6)}` }).then(() => setTarget(""))}>
              {current ? "Reassign" : "Assign"}
            </button>
          </>
        )}
      </div>
      <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? "Responder assigned" : null} />
    </div>
  );
}

function ReviewForm({ alert }: { alert: Emergency }) {
  const cmd = useCommand("reviewAlert");
  const [label, setLabel] = useState<"true_positive" | "false_positive" | "uncertain">("uncertain");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="eyebrow">Outcome review</p>
      <p className="text-xs text-muted">Record whether this health alert reflected a real concern once the situation is assessed.</p>
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto py-1.5 text-sm" value={label} onChange={(e) => setLabel(e.target.value as typeof label)} aria-label="Review label">
          <option value="true_positive">Real concern</option>
          <option value="false_positive">No concern (false alarm)</option>
          <option value="uncertain">Uncertain</option>
        </select>
        <input className="input min-w-[10rem] flex-1 py-1.5 text-sm" placeholder="Optional note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} aria-label="Review note" />
        <button type="button" className="btn-outline btn-sm" disabled={cmd.pending} onClick={() => void cmd.run({ eventId: alert.eventId, alertId: alert.alertId, label, ...(note.trim() ? { note: note.trim() } : {}) })}>
          Save review
        </button>
      </div>
      {alert.review && (
        <p className="text-xs">
          Current: <b>{alert.review.label.replace("_", " ")}</b> {alert.review.note ? `— ${alert.review.note}` : ""} ({timeAgo(alert.review.at)})
        </p>
      )}
      <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? "Review saved" : null} />
    </div>
  );
}

function Notifications({ alert }: { alert: Emergency }) {
  const log = useDispatchLog(alert.eventId, alert.alertId);
  const notified = Object.entries(alert.notified ?? {}) as [ResponderRole, { recipients: number; attempted: number; accepted: number; failed: number }][];
  return (
    <div className="space-y-2">
      <h3 className="eyebrow flex items-center">
        Notifications
        <InfoTip text={TIPS.latency} />
      </h3>
      {notified.length === 0 ? (
        <p className="text-sm text-muted">No responders were notified yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Role</th>
              <th className="th">People</th>
              <th className="th">Push sent</th>
              <th className="th">Accepted</th>
              <th className="th">Failed</th>
            </tr>
          </thead>
          <tbody>
            {notified.map(([role, c]) => (
              <tr key={role} className="border-t border-line">
                <td className="td">{ROLE_LABEL[role] ?? role}</td>
                <td className="td tabular-nums">{c.recipients}</td>
                <td className="td tabular-nums">{c.attempted}</td>
                <td className="td tabular-nums">{c.accepted}</td>
                <td className={`td tabular-nums ${c.failed ? "font-semibold text-status-critical" : ""}`}>{c.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {log.data.length > 0 && (
        <ul className="space-y-1 text-xs text-muted">
          {log.data.map((d) => (
            <li key={d.id}>
              {formatClock(d.startedAt)} · <b className="text-ink">{d.phase}</b> ({d.severity}) · {d.finishedAt - d.startedAt} ms
              {d.retried ? ` · ${d.retried} retried` : ""}
              {d.invalidTokensRemoved ? ` · ${d.invalidTokensRemoved} expired device token(s) removed` : ""}
              {d.note ? ` · ${d.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertDetail({ alert, canAct, staff }: { alert: Emergency; canAct: boolean; staff: Record<string, EventRole> }) {
  const audit = useEmergencyAudit(alert.eventId, alert.alertId);
  const now = useNow(5000);
  const base = { eventId: alert.eventId, alertId: alert.alertId };
  const locationAge = alert.location ? now - alert.location.fixAt : null;
  const unacked = alert.status === "open" || alert.status === "escalated";
  const c = alert.contributing;

  return (
    <section className={`card space-y-4 ${alert.type === "sos" && alert.status !== "resolved" ? "border-2 border-status-critical" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <AlertStatusBadge status={alert.status} />
        {(alert.escalationLevel ?? 0) > 0 && <Badge tone="critical">Escalated {alert.escalatedAt ? timeAgo(alert.escalatedAt, now) : ""}</Badge>}
        {alert.upgradedFrom && <Badge tone="warning">Upgraded from {alert.upgradedFrom}</Badge>}
        {alert.requiresHumanReview && <Badge>Needs review</Badge>}
      </div>
      <div>
        <h2 className="text-xl font-bold">{alert.type === "sos" ? "SOS" : "Health alert"}</h2>
        <p className="text-sm text-muted">
          {SOURCE_LABEL[alert.source] ?? alert.source} · created {formatDateTime(alert.createdAt)} ({timeAgo(alert.createdAt, now)})
          {alert.repeatCount ? ` · pressed again ${alert.repeatCount}×` : ""}
        </p>
      </div>

      {unacked && (
        <p role="alert" className="rounded-xl bg-status-critical/10 p-3 text-sm font-semibold">
          Not acknowledged yet
          {alert.escalationDueAt && alert.status === "open"
            ? alert.escalationDueAt - now > 0
              ? ` — escalates in about ${Math.round((alert.escalationDueAt - now) / 1000)} s`
              : now - alert.escalationDueAt > 90_000
                ? ` — escalation is overdue by ${Math.round((now - alert.escalationDueAt) / 60_000)} min. Check that the FestNet backend (worker / Cloud Functions) is running.`
                : " — escalating now"
            : ""}
          .
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Band</dt>
        <dd>{alert.deviceId ? <Link className="font-semibold text-brand hover:underline" to={`/devices/${encodeURIComponent(alert.deviceId)}`}>{alert.deviceId}</Link> : "— (app)"}</dd>
        <dt className="text-muted">Participant</dt>
        <dd className="font-mono">{alert.participantId ?? "unknown"}</dd>
        <dt className="flex items-center text-muted">
          Last GPS fix
          <InfoTip text={TIPS.gps} />
        </dt>
        <dd>
          {alert.location ? (
            <>
              <a className="text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${alert.location.latitude},${alert.location.longitude}`}>
                {alert.location.latitude.toFixed(5)}, {alert.location.longitude.toFixed(5)}
              </a>{" "}
              <span className={locationAge !== null && locationAge > 60_000 ? "font-semibold text-status-warning" : "text-muted"}>
                (fix {timeAgo(alert.location.fixAt, now)}
                {locationAge !== null && locationAge > 60_000 ? " — may be outdated" : ""})
              </span>
            </>
          ) : (
            <span className="text-muted">No GPS fix available</span>
          )}
        </dd>
        {c && (c.hriScore != null || c.bpm != null) && (
          <>
            <dt className="text-muted">Trigger values</dt>
            <dd className="flex flex-wrap items-center gap-1">
              {c.hriScore != null && (
                <span>
                  Indicator {c.hriScore} {c.hriStatus ? `(${HRI_STATUS_LABELS[c.hriStatus]})` : ""}
                </span>
              )}
              {c.hriConfidence && <ConfidenceBadge level={c.hriConfidence} />}
              {c.bpm != null && <span>· {Math.round(c.bpm)} bpm</span>}
              {c.activity && <span className="text-muted">· {c.activity}</span>}
              {c.measuredAt && <span className="text-xs text-muted">· measured {formatClock(c.measuredAt)}</span>}
            </dd>
          </>
        )}
        <dt className="text-muted">Timing</dt>
        <dd className="text-xs">
          received {formatClock(alert.receivedAt)} · notified {formatClock(alert.dispatchedAt)}
          {alert.latencyFromReceiptMs != null && <b className="ml-1">({alert.latencyFromReceiptMs} ms)</b>}
        </dd>
        {alert.responder && (
          <>
            <dt className="text-muted">Responder</dt>
            <dd>
              {alert.responder.name} <span className="text-xs text-muted">({timeAgo(alert.responder.assignedAt, now)})</span>
            </dd>
          </>
        )}
        {alert.acknowledgedAt && (
          <>
            <dt className="text-muted">Acknowledged</dt>
            <dd>
              {alert.acknowledgedBy && alert.acknowledgedBy.length > 12 ? `${alert.acknowledgedBy.slice(0, 6)}…` : alert.acknowledgedBy} · {timeAgo(alert.acknowledgedAt, now)}
            </dd>
          </>
        )}
        {alert.resolution && (
          <>
            <dt className="text-muted">Resolution</dt>
            <dd>{alert.resolution.note}</dd>
          </>
        )}
      </dl>

      {alert.reasons.length > 0 && (
        <div>
          <h3 className="eyebrow mb-1">Reasons</h3>
          <ul className="list-disc pl-5 text-sm">
            {alert.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {(alert.reasonCodes?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {alert.reasonCodes!.map((code) => (
                <span key={code} className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs">
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <Notifications alert={alert} />

      {canAct ? (
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="eyebrow">Actions</h3>
          {unacked && <ActionButton type="acknowledgeAlert" label="Acknowledge" payload={base} tone="btn-primary" />}
          {alert.status !== "resolved" && <ResponderAssign alert={alert} staff={staff} />}
          {(unacked || alert.status === "acknowledged") && <ActionButton type="markAlertInProgress" label="Mark in progress" payload={base} />}
          {(alert.status === "acknowledged" || alert.status === "in_progress") && <ActionButton type="resolveAlert" label="Resolve" payload={base} needsNote />}
          {alert.status === "resolved" && <ActionButton type="reopenAlert" label="Reopen" payload={base} needsNote />}
          {alert.type === "hri" && <ReviewForm alert={alert} />}
        </div>
      ) : (
        <p className="text-xs text-muted">You can view this alert but your role cannot change it.</p>
      )}

      <div className="border-t border-line pt-4">
        <h3 className="eyebrow mb-2">Audit trail</h3>
        {audit.error && <ErrorState message={audit.error} />}
        {audit.loading ? (
          <div className="skeleton h-16" />
        ) : audit.data.length === 0 ? (
          <p className="text-sm text-muted">No audit entries.</p>
        ) : (
          <ol className="space-y-1.5 text-sm">
            {audit.data.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="tabular-nums text-muted">{formatDateTime(a.at)}</span>
                <b>{a.action.replace(/_/g, " ")}</b>
                {a.fromStatus && a.toStatus && a.fromStatus !== a.toStatus && (
                  <span className="text-muted">
                    {a.fromStatus} → {a.toStatus}
                  </span>
                )}
                <span className="text-muted">by {a.by.length > 12 ? `${a.by.slice(0, 6)}…` : a.by}</span>
                {a.note && <span>— {a.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function WatchList({ eventId }: { eventId: string }) {
  const watch = useWatchList(eventId);
  const now = useNow(10_000);
  if (watch.loading || watch.data.length === 0) return null;
  return (
    <section className="card mb-5">
      <h2 className="mb-2 flex items-center text-lg font-bold">
        Watch list
        <InfoTip text={TIPS.watch} />
      </h2>
      <ul className="divide-y divide-line text-sm">
        {watch.data.map((w) => (
          <li key={w.deviceId} className="flex flex-wrap items-center gap-3 py-2">
            <Link to={`/devices/${encodeURIComponent(w.deviceId)}`} className="font-semibold text-brand hover:underline">
              {w.deviceId}
            </Link>
            <span>
              Indicator {w.currentScore} → projected <b>{w.projectedScore}</b> in {Math.round(w.horizonSec / 60)} min
            </span>
            <span className="text-muted">+{w.slopePerMin}/min</span>
            <span className="ml-auto text-xs text-muted">{timeAgo(w.at, now)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EmergencyCommandPage() {
  const { selectedEventId } = useEventContext();
  const { isDeviceAdmin } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [bucket, setBucket] = useState<"event" | "unassigned">("event");
  const eventId = bucket === "unassigned" && isDeviceAdmin ? UNASSIGNED_EVENT : selectedEventId;
  const perms = usePermissions(eventId);
  const emergencies = useEmergencies(eventId);
  const staff = useRealtimeValue<Record<string, EventRole>>(eventId && eventId !== UNASSIGNED_EVENT ? paths.eventStaff(eventId) : null);
  const [status, setStatus] = useState<StatusFilter>("unresolved");
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const [source, setSource] = useState<"all" | "sos" | "health">("all");
  const [device, setDevice] = useState("");
  const selectedId = params.get("alert");

  const filtered = useMemo(() => {
    const q = device.trim().toUpperCase();
    return sortAlerts(
      emergencies.data.filter(
        (e) =>
          (status === "all" || (status === "unresolved" ? e.status !== "resolved" : e.status === status)) &&
          (severity === "all" || (e.severity ?? "critical") === severity) &&
          (source === "all" || (source === "sos" ? e.type === "sos" : e.type !== "sos")) &&
          (!q || (e.deviceId ?? "").toUpperCase().includes(q)),
      ),
    );
  }, [emergencies.data, status, severity, source, device]);
  const selected = filtered.find((e) => e.alertId === selectedId) ?? emergencies.data.find((e) => e.alertId === selectedId) ?? filtered[0] ?? null;

  const unacked = emergencies.data.filter((e) => e.status === "open" || e.status === "escalated");
  const latencies = emergencies.data.map((e) => e.latencyFromReceiptMs).filter((v): v is number => typeof v === "number");
  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const pushTotals = emergencies.data.reduce(
    (acc, e) => {
      for (const c of Object.values(e.notified ?? {})) {
        acc.attempted += c?.attempted ?? 0;
        acc.accepted += c?.accepted ?? 0;
      }
      return acc;
    },
    { attempted: 0, accepted: 0 },
  );
  const canAct = eventId === UNASSIGNED_EVENT ? perms.isDeviceAdmin : perms.isEventStaff;

  if (!selectedEventId && !isDeviceAdmin) return <EmptyState title="No event selected" />;

  return (
    <>
      <PageHeader
        eyebrow="Components 1 & 2 · Emergency alerts"
        title="Emergency Command"
        subtitle="SOS and health alerts, most severe first. Every action is recorded in the audit trail."
        actions={
          isDeviceAdmin ? (
            <SegmentedControl
              label="Alert bucket"
              tone="neutral"
              value={bucket}
              onChange={(v) => {
                setBucket(v);
                setParams({});
              }}
              options={[
                { value: "event", label: "This event" },
                { value: "unassigned", label: "Unassigned bands", title: "SOS from bands / accounts without an active assignment" },
              ]}
            />
          ) : undefined
        }
      />

      {unacked.some((e) => e.type === "sos") && (
        <div role="alert" className="mb-5 rounded-2xl border border-status-critical bg-status-critical px-4 py-3 font-semibold text-white dark:text-slate-900">
          ⚠ {unacked.filter((e) => e.type === "sos").length} SOS {unacked.filter((e) => e.type === "sos").length === 1 ? "alert is" : "alerts are"} not acknowledged.
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile kind="live" icon="alert" label="Unacknowledged" value={unacked.length} hint={`${unacked.filter((e) => e.status === "escalated").length} escalated`} tone={unacked.length ? "critical" : "neutral"} />
        <StatTile kind="historical" icon="timer" label="Alert → notified (avg)" value={avg !== null ? `${avg} ms` : "—"} hint={latencies.length ? `p95 ${percentile(latencies, 0.95)} ms · max ${Math.max(...latencies)} ms` : "no measured alerts yet"} />
        <StatTile kind="historical" icon="signal" label="Push accepted" value={`${pushTotals.accepted} / ${pushTotals.attempted}`} hint="accepted by the push service" />
        <StatTile kind="historical" icon="chart" label="Alerts (recent 200)" value={emergencies.data.length} hint={`${emergencies.data.filter((e) => e.type === "sos").length} SOS`} />
      </div>

      {eventId && eventId !== UNASSIGNED_EVENT && <WatchList eventId={eventId} />}
      {emergencies.error && <ErrorState message={emergencies.error} />}

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <select className="input py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status filter">
              <option value="unresolved">Unresolved</option>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="escalated">Escalated</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <select className="input py-1.5 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity | "all")} aria-label="Severity filter">
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="danger">Danger</option>
              <option value="warning">Warning</option>
            </select>
            <select className="input py-1.5 text-sm" value={source} onChange={(e) => setSource(e.target.value as "all" | "sos" | "health")} aria-label="Source filter">
              <option value="all">SOS + health</option>
              <option value="sos">SOS only</option>
              <option value="health">Health only</option>
            </select>
            <input className="input py-1.5 text-sm" placeholder="Band ID" value={device} onChange={(e) => setDevice(e.target.value)} aria-label="Band filter" />
          </div>
          {emergencies.loading ? (
            <SkeletonRows rows={5} cols={2} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No alerts">Nothing matches these filters.</EmptyState>
          ) : (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {filtered.map((e) => (
                <li key={e.alertId}>
                  <button
                    type="button"
                    onClick={() => setParams({ alert: e.alertId })}
                    className={`w-full rounded-xl border p-3 text-left transition ${selected?.alertId === e.alertId ? "border-brand bg-brand/5" : "border-line hover:bg-surface-2"} ${
                      e.type === "sos" && e.status !== "resolved" ? "border-l-4 border-l-status-critical" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={e.severity} />
                      <span className="text-sm font-semibold">{e.type === "sos" ? "SOS" : "Health"}</span>
                      <span className="text-xs text-muted">{e.deviceId ?? "app"}</span>
                      <span className="ml-auto">
                        <AlertStatusBadge status={e.status} />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {timeAgo(e.createdAt)} · {e.reasons[0] ?? ""}
                      {e.responder ? ` · ${e.responder.name}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="lg:col-span-3">
          {selected ? <AlertDetail key={selected.alertId} alert={selected} canAct={canAct} staff={staff.data ?? {}} /> : <EmptyState title="Select an alert" />}
        </div>
      </div>
    </>
  );
}
