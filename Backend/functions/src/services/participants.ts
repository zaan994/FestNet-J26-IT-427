/**
 * Pseudonymous participants. No names, phone numbers or other personal data are collected:
 * the record is an opaque id, its event, and a research-consent flag recorded by staff.
 */
import { paths, type Participant } from "../shared";
import { requireEventAccess, requireEventExists } from "./access";
import { audit } from "./audit";
import { clean, conflict, type ServiceContext } from "./context";
import { EVENT_ID_PATTERN, newParticipantId } from "./ids";
import { allowOnly, bool, str, type Payload } from "./validate";

export async function createParticipant(ctx: ServiceContext, uid: string, p: Payload) {
  allowOnly(p, ["eventId", "researchConsent"]);
  const eventId = str(p, "eventId", { pattern: EVENT_ID_PATTERN });
  await requireEventAccess(ctx, uid, eventId, ["eventOperator"]);
  const event = await requireEventExists(ctx, eventId);
  if (event.status === "closed") throw conflict("The event is closed.");
  const researchConsent = bool(p, "researchConsent", false);

  const participantId = newParticipantId();
  const participant: Participant = {
    participantId,
    eventId,
    createdAt: ctx.now(),
    createdBy: uid,
    demo: event.demo,
    researchConsent,
    consentRecordedAt: researchConsent ? ctx.now() : null,
    attendeeUid: null,
    activeAssignmentId: null,
  };
  await ctx.db.ref(paths.participant(eventId, participantId)).set(clean(participant));
  await audit(ctx, eventId, "participant_created", uid, participantId, { researchConsent });
  return { participantId, qrPayload: `FESTNET-PARTICIPANT:${participantId}` };
}
