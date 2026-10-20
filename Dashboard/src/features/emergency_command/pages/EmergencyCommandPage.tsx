import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AlertStatusBadge, Badge, ConfidenceBadge, DemoBadge, PriorityBadge } from "@/components/common/Badges";
import { InfoTip } from "@/components/common/InfoTip";
import { PageHeader } from "@/components/common/PageHeader";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { CommandFeedback, EmptyState, ErrorState, SkeletonRows } from "@/components/common/States";
import { HRI_STATUS_LABELS, TIPS } from "@/constants/explanations";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useEventContext } from "@/hooks/useEventContext";
import { useEmergencies, useEmergencyAudit } from "@/hooks/useEventData";
import { useNow } from "@/hooks/useNow";
import { useRealtimeValue } from "@/hooks/useRealtimeValue";
import type { CommandType, Emergency, EventRole } from "@/types";
import { formatDateTime, timeAgo } from "@/utils/format";
import { paths } from "@shared/paths";
import { UNASSIGNED_EVENT } from "@shared/schema";

// C1 automated HRI alerts + manual SOS lifecycle (shared with C2 — Manubasha K.D.C.)

const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2 } as const;
const STATUS_RANK = { open: 0, acknowledged: 1, in_progress: 2, resolved: 3 } as const;

/** Unresolved first, then P1 (manual SOS) before P2 (HRI), then newest. */
function sortAlerts(list: Emergency[]) {
  return [...list].sort(
    (a, b) =>
      Number(a.status === "resolved") - Number(b.status === "resolved") ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.createdAt - a.createdAt,
  );
}

const SOURCE_LABEL = { device_button: "Band SOS button", attendee_app: "Attendee app SOS", hri_engine: "HRI engine (automated)" } as const;

function ActionButton({ type, label, payload, needsNote, tone = "btn-outline", disabled }: {
  type: CommandType;
  label: string;
  payload: Record<string, unknown>;
  needsNote?: boolean;
  tone?: string;
  disabled?: boolean;
}) {
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
          disabled={disabled || cmd.pending || (needsNote && !note.trim())}
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
  const responders = Object.entries(staff).filter(([, r]) => r === "medicalResponder");
  const base = { eventId: alert.eventId, alertId: alert.alertId };
  const myName = profile?.displayName || user?.email || "Me";
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" disabled={cmd.pending} onClick={() => void cmd.run({ ...base, responderUid: user!.uid, responderName: myName.slice(0, 80) })}>
          Assign to me
        </button>
        {responders.length > 0 && (
          <>
            <select className="input w-auto py-1.5 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Medical responder">
              <option value="">Choose medical responder…</option>
              {responders.map(([uid]) => (
                <option key={uid} value={uid}>
                  Responder {uid.slice(0, 6)}
                </option>
              ))}
            </select>
            <button type="button" className="btn-outline btn-sm" disabled={!target || cmd.pending} onClick={() => void cmd.run({ ...base, responderUid: target, responderName: `Responder ${target.slice(0, 6)}` })}>
              Assign
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
      <p className="eyebrow">Research review label</p>
      <p className="text-xs text-muted">Used to evaluate the experimental HRI. Label after the situation is assessed.</p>
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto py-1.5 text-sm" value={label} onChange={(e) => setLabel(e.target.value as typeof label)} aria-label="Review label">
          <option value="true_positive">True positive (real concern)</option>
          <option value="false_positive">False positive</option>
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

function AlertDetail({ alert, canAct, staff }: { alert: Emergency; canAct: boolean; staff: Record<string, EventRole> }) {
  const audit = useEmergencyAudit(alert.eventId, alert.alertId);
  const now = useNow(5000);
  const base = { eventId: alert.eventId, alertId: alert.alertId };
  const locationAge = alert.location ? now - alert.location.fixAt : null;

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={alert.priority} />
        <AlertStatusBadge status={alert.status} />
        {alert.demo && <DemoBadge />}
        {alert.requiresHumanReview && <Badge tone="warning">Needs human review</Badge>}
      </div>
      <div>
        <h2 className="text-xl font-bold">{alert.type === "sos" ? "Manual SOS" : "Automated HRI alert (experimental)"}</h2>
        <p className="text-sm text-muted">
          {SOURCE_LABEL[alert.source]} · created {formatDateTime(alert.createdAt)} ({timeAgo(alert.createdAt, now)})
          {alert.repeatCount ? ` · pressed again ${alert.repeatCount}×` : ""}
        </p>
      </div>

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
              {alert.location.latitude.toFixed(5)}, {alert.location.longitude.toFixed(5)}{" "}
              <span className={locationAge !== null && locationAge > 60_000 ? "font-semibold text-status-warning" : "text-muted"}>
                (fix {timeAgo(alert.location.fixAt, now)}
                {locationAge !== null && locationAge > 60_000 ? " — may be outdated" : ""})
              </span>
            </>
          ) : (
            <span className="text-muted">No GPS fix available</span>
          )}
        </dd>
        {alert.hri && (
          <>
            <dt className="text-muted">HRI at alert</dt>
            <dd className="flex flex-wrap items-center gap-1">
              {HRI_STATUS_LABELS[alert.hri.status]} {alert.hri.score !== null ? `· ${alert.hri.score}` : ""}
              <ConfidenceBadge level={alert.hri.confidence} />
            </dd>
          </>
        )}
        {alert.responder && (
          <>
            <dt className="text-muted">Responder</dt>
            <dd>
              {alert.responder.name} <span className="text-xs text-muted">({timeAgo(alert.responder.assignedAt, now)})</span>
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
        </div>
      )}
      {alert.type === "hri" && (
        <p className="rounded-xl bg-status-warning/10 p-3 text-xs">
          This alert came from an experimental, unvalidated indicator. Check on the person and use clinical judgement — it is not a diagnosis.
        </p>
      )}

      {canAct ? (
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="eyebrow">Actions</h3>
          {alert.status === "open" && <ActionButton type="acknowledgeAlert" label="Acknowledge" payload={base} tone="btn-primary" />}
          {alert.status !== "resolved" && <ResponderAssign alert={alert} staff={staff} />}
          {(alert.status === "open" || alert.status === "acknowledged") && <ActionButton type="markAlertInProgress" label="Mark in progress" payload={base} />}
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

export function EmergencyCommandPage() {
  const { selectedEventId } = useEventContext();
  const { isDeviceAdmin } = usePermissions();
  const [bucket, setBucket] = useState<"event" | "unassigned">("event");
  const eventId = bucket === "unassigned" && isDeviceAdmin ? UNASSIGNED_EVENT : selectedEventId;
  const perms = usePermissions(eventId);
  const emergencies = useEmergencies(eventId);
  const staff = useRealtimeValue<Record<string, EventRole>>(eventId && eventId !== UNASSIGNED_EVENT ? paths.eventStaff(eventId) : null);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => sortAlerts(emergencies.data.filter((e) => showResolved || e.status !== "resolved")), [emergencies.data, showResolved]);
  const selected = list.find((e) => e.alertId === selectedId) ?? list[0] ?? null;
  const openP1 = emergencies.data.filter((e) => e.priority === "P1" && e.status === "open").length;
  const canAct = eventId === UNASSIGNED_EVENT ? perms.isDeviceAdmin : perms.isEventStaff;

  if (!selectedEventId && !isDeviceAdmin) return <EmptyState title="No event selected" />;

  return (
    <>
      <PageHeader
        eyebrow="Components 1 & 2 · Emergency lifecycle"
        title="Emergency Command"
        subtitle="Manual SOS (P1) always comes before automated HRI alerts (P2). Every action is recorded in the audit trail."
        actions={
          isDeviceAdmin ? (
            <SegmentedControl
              label="Alert bucket"
              tone="neutral"
              value={bucket}
              onChange={(v) => {
                setBucket(v);
                setSelectedId(null);
              }}
              options={[
                { value: "event", label: "This event" },
                { value: "unassigned", label: "Unassigned bands", title: "SOS from bands / accounts without an active assignment" },
              ]}
            />
          ) : undefined
        }
      />

      {openP1 > 0 && (
        <div role="alert" className="mb-5 rounded-2xl border border-status-critical bg-status-critical px-4 py-3 font-semibold text-white dark:text-slate-900">
          ⚠ {openP1} manual SOS {openP1 === 1 ? "alert is" : "alerts are"} OPEN and not yet acknowledged.
        </div>
      )}
      {emergencies.error && <ErrorState message={emergencies.error} />}

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Alerts</h2>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
            </label>
          </div>
          {emergencies.loading ? (
            <SkeletonRows rows={5} cols={2} />
          ) : list.length === 0 ? (
            <EmptyState title="No alerts">{showResolved ? "Nothing recorded for this event." : "No unresolved alerts."}</EmptyState>
          ) : (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {list.map((e) => (
                <li key={e.alertId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(e.alertId)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected?.alertId === e.alertId ? "border-brand bg-brand/5" : "border-line hover:bg-surface-2"
                    } ${e.priority === "P1" && e.status === "open" ? "border-l-4 border-l-status-critical" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={e.priority} />
                      <span className="text-sm font-semibold">{e.type === "sos" ? "SOS" : "HRI"}</span>
                      <span className="text-xs text-muted">{e.deviceId ?? "app"}</span>
                      <span className="ml-auto">
                        <AlertStatusBadge status={e.status} />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {timeAgo(e.createdAt)} · {e.participantId ?? "no participant"}
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
