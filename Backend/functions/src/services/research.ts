/**
 * De-identified research export (Module D evaluation support).
 *  - Only participants with researchConsent = true.
 *  - Participant ids are re-pseudonymised per export (R001, R002 …) so exports cannot be joined
 *    to live records; no device ids, no GPS, no absolute timestamps (time is relative to the
 *    start of each assignment).
 *  - Bounded: at most MAX_ROWS_PER_ASSIGNMENT history points per assignment.
 *  - Audited.
 */
import { paths, type Assignment, type HistoryPoint, type Participant, type ResearchExport, type ResearchRow } from "../shared";
import { requireGlobalRole } from "./access";
import { audit } from "./audit";
import { clean, type ServiceContext } from "./context";
import { EVENT_ID_PATTERN } from "./ids";
import { allowOnly, str, type Payload } from "./validate";

export const MAX_ROWS_PER_ASSIGNMENT = 5_000;
export const MAX_ROWS_PER_EXPORT = 50_000;

export async function exportResearch(ctx: ServiceContext, uid: string, p: Payload) {
  await requireGlobalRole(ctx, uid, "researchAdmin");
  allowOnly(p, ["eventId"]);
  const eventId = str(p, "eventId", { pattern: EVENT_ID_PATTERN });

  const index = ((await ctx.db.ref(paths.eventAssignments(eventId)).get()).val() as Record<string, { participantId: string }> | null) ?? {};
  const rows: Record<string, ResearchRow> = {};
  const pseudonyms = new Map<string, string>();
  let rowCount = 0;

  for (const assignmentId of Object.keys(index)) {
    if (rowCount >= MAX_ROWS_PER_EXPORT) break;
    const assignment = (await ctx.db.ref(paths.assignment(assignmentId)).get()).val() as Assignment | null;
    if (!assignment) continue;
    const participant = (await ctx.db.ref(paths.participant(eventId, assignment.participantId)).get()).val() as Participant | null;
    if (!participant?.researchConsent) continue;

    if (!pseudonyms.has(assignment.participantId)) pseudonyms.set(assignment.participantId, `R${String(pseudonyms.size + 1).padStart(3, "0")}`);
    const label = pseudonyms.get(assignment.participantId)!;

    const snap = await ctx.db.ref(paths.healthHistory(assignmentId)).orderByChild("ts").limitToFirst(MAX_ROWS_PER_ASSIGNMENT).get();
    snap.forEach((child) => {
      if (rowCount >= MAX_ROWS_PER_EXPORT) return true;
      const h = child.val() as HistoryPoint;
      rows[`r${rowCount++}`] = {
        participant: label,
        tRelSec: Math.round((h.ts - assignment.startedAt) / 1000),
        bpm: h.bpm ?? null,
        bpmQuality: h.bpmQuality,
        rmssdMs: h.rmssdMs ?? null,
        surfaceC: h.surfaceC ?? null,
        ambientC: h.ambientC ?? null,
        activity: h.activity,
        hriScore: h.hriScore ?? null,
        hriStatus: h.hriStatus,
        confidence: h.confidence,
      };
      return false;
    });
  }

  const exportId = ctx.db.ref(paths.researchExports()).push().key as string;
  const record: ResearchExport = {
    exportId,
    eventId,
    createdAt: ctx.now(),
    createdBy: uid,
    status: "ready",
    participantCount: pseudonyms.size,
    recordCount: rowCount,
    rows,
  };
  await ctx.db.ref(paths.researchExport(exportId)).set(clean(record));
  await audit(ctx, "global", "research_export", uid, exportId, { eventId, participants: pseudonyms.size, rows: rowCount });
  return { exportId, participantCount: pseudonyms.size, recordCount: rowCount };
}
