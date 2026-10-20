import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/common/Badges";
import { Pagination, usePagination } from "@/components/common/Pagination";
import { QrImage } from "@/components/common/Qr";
import { CommandFeedback, EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/common/States";
import { usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useEventAssignments, type EventAssignmentRow } from "@/hooks/useEventData";
import { formatClock, formatDateTime, timeAgo } from "@/utils/format";

import { ScanField } from "./ScanField";

/** Shows a one-time attendee claim code as QR + text, with its expiry. */
function ClaimCode({ assignmentId }: { assignmentId: string }) {
  const cmd = useCommand<{ code: string; expiresAt: number; qrPayload: string }>("issueClaimCode");
  return (
    <div className="space-y-2">
      <button type="button" className="btn-outline btn-sm" disabled={cmd.pending} onClick={() => void cmd.run({ assignmentId })}>
        {cmd.result ? "Issue a new claim code" : "Issue attendee claim code"}
      </button>
      <CommandFeedback pending={cmd.pending} error={cmd.error} />
      {cmd.result && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-3">
          <QrImage value={cmd.result.qrPayload} label={cmd.result.code} size={150} />
          <div className="text-sm">
            <p>
              The attendee scans this in the FestNet app (or types <b className="font-mono">{cmd.result.code}</b>).
            </p>
            <p className="text-muted">One-time use · expires {formatClock(cmd.result.expiresAt)}. Issuing a new code revokes the previous one.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EndAssignment({ row }: { row: EventAssignmentRow }) {
  const ret = useCommand("returnDevice");
  const cancel = useCommand("cancelAssignment");
  const [condition, setCondition] = useState<"ok" | "maintenance">("ok");
  const [note, setNote] = useState("");
  const payload = { assignmentId: row.assignmentId, ...(note.trim() ? { note: note.trim() } : {}) };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto py-1.5 text-sm" value={condition} onChange={(e) => setCondition(e.target.value as "ok" | "maintenance")} aria-label="Device condition">
          <option value="ok">Band OK → available</option>
          <option value="maintenance">Band needs maintenance</option>
        </select>
        <input className="input min-w-[10rem] flex-1 py-1.5 text-sm" placeholder="Note (optional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Return note" />
        <button type="button" className="btn-primary btn-sm" disabled={ret.pending} onClick={() => void ret.run({ ...payload, condition })}>
          Return band
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm text-status-critical"
          disabled={cancel.pending}
          onClick={() => {
            if (window.confirm(`Cancel assignment ${row.assignmentId}? Use this only for assignments made by mistake.`)) void cancel.run(payload);
          }}
        >
          Cancel (mistake)
        </button>
      </div>
      <CommandFeedback pending={ret.pending || cancel.pending} error={ret.error ?? cancel.error} success={ret.result ? "Band returned" : cancel.result ? "Assignment cancelled" : null} />
    </div>
  );
}

function AssignForm({ eventId }: { eventId: string }) {
  const cmd = useCommand<{ assignmentId: string; deviceId: string; participantId: string }>("assignDevice");
  const [participantId, setParticipantId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [zone, setZone] = useState("");
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-bold">Assign a band</h2>
        <p className="text-sm text-muted">
          Scan the participant QR, then the band QR. The backend checks that the band is available, not assigned elsewhere, and that the participant
          has no other active band — concurrent attempts cannot double-assign.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ScanField kind="participant" label="1 · Participant" value={participantId} onChange={setParticipantId} placeholder="P-XXXXXXXX" />
        <ScanField kind="device" label="2 · Band" value={deviceId} onChange={setDeviceId} placeholder="FESTNET_001" />
      </div>
      <label className="block max-w-xs text-sm">
        <span className="eyebrow">Zone (optional)</span>
        <input className="input mt-1" value={zone} maxLength={40} onChange={(e) => setZone(e.target.value)} />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={!participantId || !deviceId || cmd.pending}
          onClick={() =>
            void cmd.run({ eventId, participantId: participantId.toUpperCase(), deviceId: deviceId.toUpperCase(), ...(zone.trim() ? { zone: zone.trim() } : {}) }).then((r) => {
              if (r) {
                setParticipantId("");
                setDeviceId("");
              }
            })
          }
        >
          Assign
        </button>
        <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? `${cmd.result.deviceId} assigned to ${cmd.result.participantId}` : null} />
      </div>
      {cmd.result && <ClaimCode assignmentId={cmd.result.assignmentId} />}
    </section>
  );
}

export function AssignmentPanel({ eventId }: { eventId: string }) {
  const { isOperator, isDeviceAdmin } = usePermissions(eventId);
  const [mode, setMode] = useState<"active" | "recent">("active");
  const assignments = useEventAssignments(eventId, mode);
  const pager = usePagination(assignments.data, 25);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {isOperator ? <AssignForm eventId={eventId} /> : <Notice>Only an event operator of this event can assign bands.</Notice>}

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{mode === "active" ? "Active assignments" : "Recent assignments"}</h2>
          <select className="input w-auto py-1.5 text-sm" value={mode} onChange={(e) => setMode(e.target.value as "active" | "recent")} aria-label="Assignment list">
            <option value="active">Active only</option>
            <option value="recent">Recent 300 (all statuses)</option>
          </select>
        </div>
        {assignments.error && <ErrorState message={assignments.error} />}
        {assignments.loading ? (
          <SkeletonRows rows={4} cols={5} />
        ) : assignments.data.length === 0 ? (
          <EmptyState title="No assignments" />
        ) : (
          <ul className="divide-y divide-line">
            {pager.slice.map((a) => (
              <li key={a.assignmentId} className="py-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link to={`/devices/${encodeURIComponent(a.deviceId)}`} className="font-semibold text-brand hover:underline">
                    {a.deviceId}
                  </Link>
                  <span className="font-mono text-muted">{a.participantId}</span>
                  <Badge tone={a.status === "active" ? "normal" : "neutral"}>{a.status}</Badge>
                  <span className="text-xs text-muted" title={formatDateTime(a.startedAt)}>
                    started {timeAgo(a.startedAt)}
                    {a.endedAt ? ` · ended ${timeAgo(a.endedAt)}` : ""}
                  </span>
                  {a.status === "active" && (isOperator || isDeviceAdmin) && (
                    <button type="button" className="btn-ghost btn-sm ml-auto" onClick={() => setOpen(open === a.assignmentId ? null : a.assignmentId)}>
                      {open === a.assignmentId ? "Close" : "Manage"}
                    </button>
                  )}
                </div>
                {open === a.assignmentId && (
                  <div className="mt-3 space-y-3 rounded-xl bg-surface-2/60 p-3">
                    {isOperator && <ClaimCode assignmentId={a.assignmentId} />}
                    <EndAssignment row={a} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination {...pager} />
      </section>
    </div>
  );
}
