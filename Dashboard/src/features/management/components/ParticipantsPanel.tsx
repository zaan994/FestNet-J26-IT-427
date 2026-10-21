import { useMemo, useState } from "react";

import { Badge } from "@/components/common/Badges";
import { Pagination, usePagination } from "@/components/common/Pagination";
import { qrPayload, QrImage } from "@/components/common/Qr";
import { CommandFeedback, EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/common/States";
import { usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useParticipants } from "@/hooks/useEventData";
import { timeAgo } from "@/utils/format";

/**
 * Pseudonymous participants: FestNet stores only a random ID (P-XXXXXXXX), a research-consent flag
 * and the active assignment — no names, phone numbers or other personal details.
 */
export function ParticipantsPanel({ eventId }: { eventId: string }) {
  const { isOperator } = usePermissions(eventId);
  const participants = useParticipants(eventId);
  const create = useCommand<{ participantId: string; qrPayload: string }>("createParticipant");
  const [consent, setConsent] = useState(false);
  const [search, setSearch] = useState("");
  const [qrFor, setQrFor] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return q ? participants.data.filter((p) => p.participantId.includes(q)) : participants.data;
  }, [participants.data, search]);
  const pager = usePagination(filtered, 50);

  return (
    <div className="space-y-5">
      {isOperator ? (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Register a participant</h2>
          <p className="text-sm text-muted">Creates a pseudonymous ID and a QR wristband/ticket code. Do not record names or contact details here.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Participant gave informed consent for de-identified research use of their data
          </label>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-primary" disabled={create.pending} onClick={() => void create.run({ eventId, researchConsent: consent }).then(() => setConsent(false))}>
              Create participant
            </button>
            <CommandFeedback pending={create.pending} error={create.error} />
          </div>
          {create.result && <QrImage value={create.result.qrPayload} label={create.result.participantId} />}
        </section>
      ) : (
        <Notice>Only an event operator can register participants.</Notice>
      )}

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Participants ({participants.data.length})</h2>
          <input className="input w-56 py-1.5 text-sm" placeholder="Search ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search participants" />
        </div>
        {participants.error && <ErrorState message={participants.error} />}
        {participants.loading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No participants" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Participant</th>
                <th className="th">Band</th>
                <th className="th">Research consent</th>
                <th className="th">App linked</th>
                <th className="th">Created</th>
                <th className="th">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((p) => (
                <tr key={p.participantId} className="border-t border-line align-top">
                  <td className="td font-mono">
                    {p.participantId}
                    {qrFor === p.participantId && (
                      <div className="mt-2">
                        <QrImage value={qrPayload("participant", p.participantId)} label={p.participantId} size={140} />
                      </div>
                    )}
                  </td>
                  <td className="td">{p.activeAssignmentId ? <Badge tone="normal">assigned</Badge> : <span className="text-muted">none</span>}</td>
                  <td className="td">{p.researchConsent ? <Badge tone="normal">yes</Badge> : <Badge>no</Badge>}</td>
                  <td className="td">{p.attendeeUid ? "yes" : "no"}</td>
                  <td className="td text-xs text-muted">{timeAgo(p.createdAt)}</td>
                  <td className="td text-right">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setQrFor(qrFor === p.participantId ? null : p.participantId)}>
                      {qrFor === p.participantId ? "Hide QR" : "QR"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination {...pager} />
      </section>
    </div>
  );
}
