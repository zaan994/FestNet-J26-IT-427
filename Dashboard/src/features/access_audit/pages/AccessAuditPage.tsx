import { useState } from "react";

import { Badge } from "@/components/common/Badges";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination, usePagination } from "@/components/common/Pagination";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { CommandFeedback, EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/common/States";
import { usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useEventContext } from "@/hooks/useEventContext";
import { useAuditLog } from "@/hooks/useEventData";
import { useRealtimeValue } from "@/hooks/useRealtimeValue";
import type { GlobalRole, UserProfile } from "@/types";
import { formatDateTime } from "@/utils/format";
import { paths } from "@shared/paths";
import { GLOBAL_ROLES } from "@shared/schema";

const ROLE_HELP: Record<GlobalRole, string> = {
  deviceAdmin: "Inventory, events, staff and global roles. Does NOT grant access to health data.",
  researchAdmin: "De-identified, consented research exports only.",
};

/** Profile of one role holder (per-uid read — the full users list is never subscribed). */
function Account({ uid }: { uid: string }) {
  const { data } = useRealtimeValue<UserProfile>(paths.user(uid));
  return (
    <>
      <p className="font-medium">{data?.displayName ?? "—"}</p>
      <p className="text-xs text-muted">{data?.email ?? uid}</p>
    </>
  );
}

function GlobalRoles() {
  const roles = useRealtimeValue<Record<string, Partial<Record<GlobalRole, boolean>>>>(paths.allRoles());
  const cmd = useCommand("setGlobalRole");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GlobalRole>("researchAdmin");

  const rows = Object.entries(roles.data ?? {}).filter(([, r]) => Object.values(r).some(Boolean));
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-bold">Global roles</h2>
      <ul className="space-y-1 text-sm">
        {GLOBAL_ROLES.map((r) => (
          <li key={r}>
            <b>{r}</b> — <span className="text-muted">{ROLE_HELP[r]}</span>
          </li>
        ))}
      </ul>
      {roles.error && <ErrorState message="Could not load roles (permission or network problem)." />}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="th">Account</th>
            <th className="th">Roles</th>
            <th className="th">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([uid, r]) => (
            <tr key={uid} className="border-t border-line">
              <td className="td">
                <Account uid={uid} />
              </td>
              <td className="td space-x-1">
                {GLOBAL_ROLES.filter((g) => r[g]).map((g) => (
                  <Badge key={g} tone="brand">
                    {g}
                  </Badge>
                ))}
              </td>
              <td className="td text-right">
                {GLOBAL_ROLES.filter((g) => r[g]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={cmd.pending}
                    onClick={() => window.confirm(`Remove ${g} from this account?`) && void cmd.run({ targetUid: uid, role: g, enabled: false })}
                  >
                    Remove {g}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="eyebrow">Account e-mail</span>
          <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} />
        </label>
        <label className="text-sm">
          <span className="eyebrow">Role</span>
          <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as GlobalRole)}>
            {GLOBAL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={!email || cmd.pending} onClick={() => void cmd.run({ email, role, enabled: true }).then((r) => r && setEmail(""))}>
          Grant
        </button>
      </div>
      <CommandFeedback pending={cmd.pending} error={cmd.error} success={cmd.result ? "Roles updated" : null} />
    </section>
  );
}

function AuditTable({ scope }: { scope: string }) {
  const log = useAuditLog(scope, 300);
  const pager = usePagination(log.data, 50);
  if (log.error) return <ErrorState message={log.error} />;
  if (log.loading) return <SkeletonRows rows={5} cols={4} />;
  if (!log.data.length) return <EmptyState title="No audit entries" />;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr>
              <th className="th">When</th>
              <th className="th">Action</th>
              <th className="th">Target</th>
              <th className="th">By</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody>
            {pager.slice.map((e) => (
              <tr key={e.id} className="border-t border-line align-top">
                <td className="td whitespace-nowrap text-xs tabular-nums">{formatDateTime(e.at)}</td>
                <td className="td font-medium">{e.action.replace(/_/g, " ")}</td>
                <td className="td font-mono text-xs">{e.target ?? "—"}</td>
                <td className="td font-mono text-xs">{e.by.length > 14 ? `${e.by.slice(0, 8)}…` : e.by}</td>
                <td className="td text-xs text-muted">
                  {e.details
                    ? Object.entries(e.details)
                        .filter(([, v]) => v !== null && v !== undefined)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(" · ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination {...pager} />
    </>
  );
}

export function AccessAuditPage() {
  const { selectedEventId } = useEventContext();
  const { isDeviceAdmin, isOperator } = usePermissions(selectedEventId);
  const [scope, setScope] = useState<"event" | "global">(isOperator || !isDeviceAdmin ? "event" : "global");
  const canEvent = !!selectedEventId && (isOperator || isDeviceAdmin);

  return (
    <>
      <PageHeader eyebrow="Security" title="Access & Audit" subtitle="Who can do what, and a tamper-evident record of every privileged action (written only by the backend)." />
      <div className="space-y-5">
        {isDeviceAdmin ? <GlobalRoles /> : <Notice>Global roles are managed by device administrators. Event staff are managed under Event &amp; Devices → Event settings.</Notice>}

        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Audit log</h2>
            {isDeviceAdmin && canEvent && (
              <SegmentedControl
                label="Audit scope"
                tone="neutral"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "event", label: "This event" },
                  { value: "global", label: "Global" },
                ]}
              />
            )}
          </div>
          {scope === "global" && isDeviceAdmin ? (
            <AuditTable scope="global" />
          ) : canEvent ? (
            <AuditTable scope={selectedEventId!} />
          ) : (
            <Notice>The audit log is visible to event operators (their event) and device administrators.</Notice>
          )}
        </section>
      </div>
    </>
  );
}
