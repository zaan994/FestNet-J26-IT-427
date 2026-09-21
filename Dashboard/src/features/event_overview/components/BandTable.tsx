import { Link } from "react-router-dom";

import { SeverityBadge } from "@/components/common/SeverityBadge";
import { StatusDot } from "@/components/common/StatusDot";
import { useNow } from "@/hooks/useNow";
import type { BandView, SensorStatus } from "@/types";
import { formatNumber, timeAgo } from "@/utils/format";

const SENSOR_LABELS: [keyof SensorStatus, string][] = [
  ["max30102", "PPG"],
  ["mlx90614", "Temp"],
  ["mpu6050", "IMU"],
  ["gps", "GPS"],
  ["oled", "OLED"],
];

/** Every registered band with its connection, sensors and current state. */
export function BandTable({ bands }: { bands: BandView[] }) {
  const now = useNow(1000);

  if (bands.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">
        No bands registered yet. Add one above (e.g. FESTNET_001).
      </p>
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-y border-line bg-surface-2/60">
            {["Band", "Status", "Last update", "Sensors", "Skin temp", "GPS", "SOS", "Health"].map((h) => (
              <th key={h} className="eyebrow px-5 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {bands.map(({ deviceId, index, latest, health, lastSeenAt, online }) => (
            <tr
              key={deviceId}
              className={`transition hover:bg-surface-2/60 ${latest?.sosActive ? "bg-severity-critical/10" : ""}`}
            >
              <td className="px-5 py-3">
                <Link to={`/health/${deviceId}`} className="font-semibold hover:text-brand">
                  {deviceId}
                </Link>
                {index?.label && index.label !== deviceId && <p className="text-xs text-muted">{index.label}</p>}
              </td>
              <td className="px-5 py-3">
                <StatusDot online={online} label={!latest ? "No data" : lastSeenAt === null ? "Waiting…" : undefined} />
              </td>
              <td className="px-5 py-3 text-muted">{lastSeenAt ? timeAgo(lastSeenAt, now) : "—"}</td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap gap-1">
                  {SENSOR_LABELS.map(([key, label]) => {
                    const ok = Boolean(latest?.sensors?.[key]);
                    return (
                      <span
                        key={key}
                        title={`${label}: ${ok ? "detected" : "not detected"}`}
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          ok ? "bg-severity-none/15 text-ink" : "bg-surface-2 text-muted line-through"
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="px-5 py-3 tabular-nums">{formatNumber(latest?.temperature?.objectC, 1, " °C")}</td>
              <td className="px-5 py-3 tabular-nums text-muted">
                {latest?.gps?.fix
                  ? `${formatNumber(latest.gps.latitude, 5)}, ${formatNumber(latest.gps.longitude, 5)}`
                  : latest
                    ? `searching · ${latest.gps?.satellites ?? 0} sat`
                    : "—"}
              </td>
              <td className="px-5 py-3">
                {latest?.sosActive ? (
                  <span className="rounded-full bg-severity-critical px-2.5 py-0.5 text-xs font-bold text-white">⚠ SOS</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-5 py-3">
                {health && online ? <SeverityBadge severity={health.anomaly.severity} /> : <span className="text-xs text-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
