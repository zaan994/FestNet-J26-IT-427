/**
 * Server-side role checks. The security rules enforce reads; these checks guard every
 * privileged write executed by the backend. Never rely on the UI hiding a button.
 */
import { paths, type EventRole, type GlobalRole } from "../shared";
import { denied, notFound, type ServiceContext } from "./context";

export async function getGlobalRoles(ctx: ServiceContext, uid: string): Promise<Set<GlobalRole>> {
  const snap = await ctx.db.ref(paths.roles(uid)).get();
  const value = (snap.val() as Partial<Record<GlobalRole, boolean>> | null) ?? {};
  return new Set((Object.keys(value) as GlobalRole[]).filter((r) => value[r] === true));
}

export async function getEventRole(ctx: ServiceContext, eventId: string, uid: string): Promise<EventRole | null> {
  const snap = await ctx.db.ref(`${paths.eventStaff(eventId)}/${uid}`).get();
  const v = snap.val();
  return v === "eventOperator" || v === "medicalResponder" || v === "secondaryResponder" ? v : null;
}

export async function requireGlobalRole(ctx: ServiceContext, uid: string, role: GlobalRole): Promise<void> {
  if (!(await getGlobalRoles(ctx, uid)).has(role)) throw denied(`Requires the ${role} role.`);
}

/**
 * Requires one of `eventRoles` on the event, or one of `globalRoles`.
 * Returns the matched role for auditing.
 */
export async function requireEventAccess(
  ctx: ServiceContext,
  uid: string,
  eventId: string,
  eventRoles: EventRole[],
  globalRoles: GlobalRole[] = [],
): Promise<EventRole | GlobalRole> {
  const [eventRole, global] = await Promise.all([getEventRole(ctx, eventId, uid), getGlobalRoles(ctx, uid)]);
  if (eventRole && eventRoles.includes(eventRole)) return eventRole;
  const g = globalRoles.find((r) => global.has(r));
  if (g) return g;
  throw denied(`Requires ${[...eventRoles, ...globalRoles].join(" or ")} for this event.`);
}

export async function requireEventExists(ctx: ServiceContext, eventId: string) {
  const snap = await ctx.db.ref(paths.event(eventId)).get();
  if (!snap.exists()) throw notFound("Event not found.");
  return snap.val() as import("../shared").FestEvent;
}
