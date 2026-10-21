/** Global roles (deviceAdmin, researchAdmin). Bootstrap the first deviceAdmin with the admin script. */
import { GLOBAL_ROLES, paths, type GlobalRole } from "../shared";
import { requireGlobalRole } from "./access";
import { audit } from "./audit";
import { invalid, notFound, type ServiceContext } from "./context";
import { allowOnly, bool, oneOf, str, type Payload } from "./validate";

export async function setGlobalRole(ctx: ServiceContext, uid: string, p: Payload) {
  await requireGlobalRole(ctx, uid, "deviceAdmin");
  allowOnly(p, ["targetUid", "email", "role", "enabled"]);
  const role = oneOf(p, "role", GLOBAL_ROLES) as GlobalRole;
  const enabled = bool(p, "enabled");
  let target = str(p, "targetUid", { max: 128, optional: true });
  const email = str(p, "email", { max: 200, optional: true });
  if (!target && email) {
    if (!ctx.lookupUid) throw invalid("E-mail lookup is not available here; pass targetUid.");
    target = await ctx.lookupUid(email);
    if (!target) throw notFound("No account with that e-mail.");
  }
  if (!target) throw invalid("targetUid or email is required.");
  if (target === uid && role === "deviceAdmin" && !enabled) throw invalid("You cannot remove your own deviceAdmin role.");

  await ctx.db.ref(`${paths.roles(target)}/${role}`).set(enabled ? true : null);
  await audit(ctx, "global", enabled ? "global_role_granted" : "global_role_revoked", uid, target, { role });
  return { targetUid: target, role, enabled };
}
