/** Append-only audit log: auditLog/{eventId | "global"}/{pushId}. No health values, no credentials. */
import { paths, type AuditEntry } from "../shared";
import { clean, SERVER_TIMESTAMP, type ServiceContext } from "./context";

export async function audit(
  ctx: ServiceContext,
  scope: string,
  action: string,
  by: string,
  target?: string | null,
  details?: AuditEntry["details"],
): Promise<void> {
  await ctx.db.ref(paths.auditLog(scope)).push(clean({ action, by, at: SERVER_TIMESTAMP, target: target ?? null, details: details ?? null }));
}
