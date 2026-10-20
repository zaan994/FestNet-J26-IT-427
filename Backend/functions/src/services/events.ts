/** Events and event staff. */
import { paths, type EventPublicInfo, type EventRole, type EventStatus, type FestEvent, type Zone } from "../shared";
import { requireEventAccess, requireEventExists, requireGlobalRole } from "./access";
import { audit } from "./audit";
import { clean, invalid, notFound, type ServiceContext } from "./context";
import { EVENT_ID_PATTERN, newEventId } from "./ids";
import { allowOnly, bool, epoch, oneOf, str, stringList, type Payload } from "./validate";

const STATUSES: readonly EventStatus[] = ["planned", "active", "closed"];
const ZONE_TYPES: readonly Zone["type"][] = ["gate", "stage", "medical", "help_point", "water", "other"];

/** deviceAdmin creates an event; the creator becomes its first eventOperator. */
export async function createEvent(ctx: ServiceContext, uid: string, p: Payload) {
  await requireGlobalRole(ctx, uid, "deviceAdmin");
  allowOnly(p, ["name", "venue", "startTs", "endTs", "demo"]);
  const name = str(p, "name", { max: 80 });
  const demo = bool(p, "demo", false);
  const eventId = newEventId(name);
  const event: FestEvent = {
    eventId,
    name: demo && !name.startsWith("DEMO") ? `DEMO ONLY — ${name}` : name,
    status: "planned",
    venue: str(p, "venue", { max: 120, optional: true }) ?? undefined,
    startTs: epoch(p, "startTs"),
    endTs: epoch(p, "endTs"),
    demo,
    createdAt: ctx.now(),
    createdBy: uid,
  };
  const publicInfo: EventPublicInfo = { name: event.name, status: event.status, demo };
  await ctx.db.ref().update(
    clean({
      [paths.event(eventId)]: event,
      [paths.eventPublic(eventId)]: publicInfo,
      [`${paths.eventStaff(eventId)}/${uid}`]: "eventOperator",
      [`${paths.staffEvents(uid)}/${eventId}`]: "eventOperator",
    }),
  );
  await audit(ctx, eventId, "event_created", uid, eventId, { demo });
  await audit(ctx, "global", "event_created", uid, eventId, { demo });
  return { eventId };
}

/** eventOperator of the event (or deviceAdmin) edits details, status, zones and public safety info. */
export async function updateEvent(ctx: ServiceContext, uid: string, p: Payload) {
  allowOnly(p, ["eventId", "name", "status", "venue", "zones", "helpPoints", "safetyInfo", "contact", "privacyContact", "dataRetention"]);
  const eventId = str(p, "eventId", { pattern: EVENT_ID_PATTERN });
  const role = await requireEventAccess(ctx, uid, eventId, ["eventOperator"], ["deviceAdmin"]);
  const event = await requireEventExists(ctx, eventId);

  const updates: Record<string, unknown> = {};
  const pub: Record<string, unknown> = {};
  const name = str(p, "name", { max: 80, optional: true });
  if (name) updates.name = pub.name = name;
  const status = oneOf(p, "status", STATUSES, true);
  if (status) {
    if (event.status === "closed" && status !== "closed" && role !== "deviceAdmin") {
      throw invalid("Only a deviceAdmin can reopen a closed event.");
    }
    updates.status = pub.status = status;
  }
  const venue = str(p, "venue", { max: 120, optional: true });
  if (venue) updates.venue = venue;

  if (p.zones !== undefined) {
    if (!p.zones || typeof p.zones !== "object" || Array.isArray(p.zones)) throw invalid('"zones" must be an object.');
    const zones: Record<string, Zone> = {};
    for (const [id, z] of Object.entries(p.zones as Record<string, unknown>).slice(0, 50)) {
      if (!/^[a-z0-9-]{1,30}$/.test(id) || !z || typeof z !== "object") throw invalid(`Invalid zone "${id}".`);
      const zp = z as Payload;
      zones[id] = { name: str(zp, "name", { max: 60 }), type: oneOf(zp, "type", ZONE_TYPES)! };
    }
    updates.zones = zones;
  }

  if (p.helpPoints !== undefined) {
    const list = Array.isArray(p.helpPoints) ? (p.helpPoints as Payload[]) : [];
    if (list.length > 30) throw invalid("At most 30 help points.");
    pub.helpPoints = Object.fromEntries(
      list.map((h, i) => [`h${i}`, { name: str(h, "name", { max: 60 }), description: str(h, "description", { max: 200, optional: true }), zone: str(h, "zone", { max: 30, optional: true }) }]),
    );
  }
  const safety = stringList(p, "safetyInfo");
  if (safety) pub.safetyInfo = safety;
  for (const k of ["contact", "privacyContact", "dataRetention"] as const) {
    const v = str(p, k, { max: 300, optional: true });
    if (v) pub[k] = v;
  }

  const multi: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) multi[`${paths.event(eventId)}/${k}`] = v;
  for (const [k, v] of Object.entries(pub)) multi[`${paths.eventPublic(eventId)}/${k}`] = v;
  if (!Object.keys(multi).length) throw invalid("Nothing to update.");
  await ctx.db.ref().update(clean(multi));
  await audit(ctx, eventId, "event_updated", uid, eventId, { fields: Object.keys({ ...updates, ...pub }).join(",") });
  return { eventId };
}

/** Grants or removes an event role. deviceAdmin, or an eventOperator of that event. */
export async function setEventStaff(ctx: ServiceContext, uid: string, p: Payload) {
  allowOnly(p, ["eventId", "targetUid", "email", "role"]);
  const eventId = str(p, "eventId", { pattern: EVENT_ID_PATTERN });
  await requireEventAccess(ctx, uid, eventId, ["eventOperator"], ["deviceAdmin"]);
  await requireEventExists(ctx, eventId);
  // "none" removes the role (RTDB drops null values, so a queued command cannot carry role: null).
  const role = p.role === null || p.role === "none" ? null : (oneOf(p, "role", ["eventOperator", "medicalResponder"] as const) as EventRole);

  let target = str(p, "targetUid", { max: 128, optional: true });
  const email = str(p, "email", { max: 200, optional: true });
  if (!target && email) {
    if (!ctx.lookupUid) throw invalid("E-mail lookup is not available here; pass targetUid.");
    target = await ctx.lookupUid(email);
    if (!target) throw notFound("No account with that e-mail. Ask them to sign in once first.");
  }
  if (!target) throw invalid("targetUid or email is required.");
  if (target === uid && role === null) throw invalid("You cannot remove your own event role.");

  await ctx.db.ref().update({
    [`${paths.eventStaff(eventId)}/${target}`]: role,
    [`${paths.staffEvents(target)}/${eventId}`]: role,
  });
  await audit(ctx, eventId, role ? "staff_role_set" : "staff_role_removed", uid, target, { role });
  return { eventId, targetUid: target, role };
}
