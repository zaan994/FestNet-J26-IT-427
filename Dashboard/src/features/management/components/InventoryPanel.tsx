import { useMemo, useState } from "react";

import { Badge, DemoBadge } from "@/components/common/Badges";
import { Pagination, usePagination } from "@/components/common/Pagination";
import { qrPayload, QrImage } from "@/components/common/Qr";
import { CommandFeedback, EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/common/States";
import { usePermissions } from "@/hooks/useAuth";
import { useCommand } from "@/hooks/useCommand";
import { useInventory } from "@/hooks/useEventData";
import type { DeviceInventoryStatus, DeviceRecord } from "@/types";
import { timeAgo } from "@/utils/format";

const STATUS_TONE: Record<DeviceInventoryStatus, "normal" | "brand" | "warning" | "neutral"> = {
  available: "normal",
  assigned: "brand",
  maintenance: "warning",
  retired: "neutral",
};

function DeviceActions({ device }: { device: DeviceRecord & { deviceId: string } }) {
  const cmd = useCommand("updateDevice");
  const assigned = !!device.currentAssignmentId;
  const set = (inventoryStatus: DeviceInventoryStatus) => void cmd.run({ deviceId: device.deviceId, inventoryStatus });
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-end gap-1">
        {device.inventoryStatus !== "available" && !assigned && (
          <button type="button" className="btn-ghost btn-sm" disabled={cmd.pending} onClick={() => set("available")}>
            Mark available
          </button>
        )}
        {device.inventoryStatus !== "maintenance" && !assigned && (
          <button type="button" className="btn-ghost btn-sm" disabled={cmd.pending} onClick={() => set("maintenance")}>
            Maintenance
          </button>
        )}
        {device.inventoryStatus !== "retired" && !assigned && (
          <button type="button" className="btn-ghost btn-sm" disabled={cmd.pending} onClick={() => window.confirm(`Retire ${device.deviceId}?`) && set("retired")}>
            Retire
          </button>
        )}
      </div>
      <CommandFeedback pending={cmd.pending} error={cmd.error} />
    </div>
  );
}

/** Device inventory — deviceAdmin only. Inventory access does NOT include any health data. */
export function InventoryPanel() {
  const { isDeviceAdmin } = usePermissions();
  const inventory = useInventory(isDeviceAdmin);
  const register = useCommand<{ deviceId: string }>("registerDevice");
  const [deviceId, setDeviceId] = useState("");
  const [label, setLabel] = useState("");
  const [demo, setDemo] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeviceInventoryStatus | "all">("all");
  const [qrFor, setQrFor] = useState<string | null>(null);
  const list = useMemo(
    () => inventory.data.filter((d) => statusFilter === "all" || (d.inventoryStatus ?? "available") === statusFilter),
    [inventory.data, statusFilter],
  );
  const pager = usePagination(list, 50);

  if (!isDeviceAdmin) return <Notice>Device inventory is managed by device administrators.</Notice>;

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Register a band</h2>
        <p className="text-sm text-muted">
          The device ID must match <code>DEVICE_ID</code> in the band firmware. The band's Firebase account must also be mapped in{" "}
          <code>deviceAuth</code> (admin script) before it can upload.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="eyebrow">Device ID</span>
            <input className="input mt-1 font-mono" placeholder="FESTNET_002" value={deviceId} onChange={(e) => setDeviceId(e.target.value.toUpperCase().trim())} />
          </label>
          <label className="text-sm">
            <span className="eyebrow">Label (optional)</span>
            <input className="input mt-1" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> DEMO band (simulator)
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!deviceId || register.pending}
            onClick={() => void register.run({ deviceId, demo, ...(label.trim() ? { label: label.trim() } : {}) }).then((r) => r && setDeviceId(""))}
          >
            Register
          </button>
        </div>
        <CommandFeedback pending={register.pending} error={register.error} success={register.result ? `${register.result.deviceId} registered` : null} />
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Inventory ({inventory.data.length})</h2>
          <select className="input w-auto py-1.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        {inventory.error && <ErrorState message={inventory.error} />}
        {inventory.loading ? (
          <SkeletonRows rows={4} cols={5} />
        ) : list.length === 0 ? (
          <EmptyState title="No devices" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className="th">Device</th>
                  <th className="th">Status</th>
                  <th className="th">Current event / participant</th>
                  <th className="th">Updated</th>
                  <th className="th">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((d) => {
                  const status = d.inventoryStatus ?? "available";
                  return (
                    <tr key={d.deviceId} className="border-t border-line align-top">
                      <td className="td">
                        <p className="font-mono font-semibold">
                          {d.deviceId} {d.demo && <DemoBadge />}
                        </p>
                        {d.label && d.label !== d.deviceId && <p className="text-xs text-muted">{d.label}</p>}
                        <button type="button" className="mt-1 text-xs text-brand hover:underline" onClick={() => setQrFor(qrFor === d.deviceId ? null : d.deviceId)}>
                          {qrFor === d.deviceId ? "Hide QR" : "Show label QR"}
                        </button>
                        {qrFor === d.deviceId && (
                          <div className="mt-2">
                            <QrImage value={qrPayload("device", d.deviceId)} label={d.deviceId} size={140} />
                          </div>
                        )}
                      </td>
                      <td className="td">
                        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                      </td>
                      <td className="td text-xs">
                        {d.currentEventId ? (
                          <>
                            {d.currentEventId} · <span className="font-mono">{d.currentParticipantId}</span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="td text-xs text-muted">{timeAgo(d.updatedAt ?? d.addedAt)}</td>
                      <td className="td">
                        <DeviceActions device={d} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...pager} />
      </section>
    </div>
  );
}
