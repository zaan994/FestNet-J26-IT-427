import { SeverityBadge } from "@/components/common/SeverityBadge";
import { StatusDot } from "@/components/common/StatusDot";
import { useNow } from "@/hooks/useNow";
import type { BandView, SensorStatus } from "@/types";
import { formatNumber, timeAgo } from "@/utils/format";

const SENSOR_LABELS: [keyof SensorStatus, string][] = [
  ["max30102", "PPG"],
  ["mlx90614", "Temp"],
  ["mpu6050", "IMU"],
  ["oled", "OLED"],
];

/** Foundation view of every band: proves the band -> Firebase -> dashboard pipeline end to end. */
export function BandTable({ bands }: { bands: BandView[] }) {
  const now = useNow(1000);

  if (bands.length === 0) {
    return <p className="text-sm text-slate-500">No bands registered yet. Add one above (e.g. FESTNET_001).</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-4">Band</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Last update</th>
            <th className="py-2 pr-4">Sensors</th>
            <th className="py-2 pr-4">Skin temp</th>
            <th className="py-2 pr-4">GPS</th>
            <th className="py-2 pr-4">SOS</th>
            <th className="py-2 pr-4">Anomaly</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bands.map(({ deviceId, index, latest, lastSeenAt, online }) => (
            <tr key={deviceId} className={latest?.sosActive ? "bg-red-50" : undefined}>
              <td className="py-3 pr-4">
                <p className="font-medium">{deviceId}</p>
                {index?.label && index.label !== deviceId && <p className="text-xs text-slate-500">{index.label}</p>}
              </td>
              <td className="py-3 pr-4">
                <StatusDot online={online} label={!latest ? "No data" : lastSeenAt === null ? "Waiting…" : undefined} />
              </td>
              <td className="py-3 pr-4 text-slate-600">{lastSeenAt ? timeAgo(lastSeenAt, now) : "—"}</td>
              <td className="py-3 pr-4">
                <div className="flex gap-1">
                  {SENSOR_LABELS.map(([key, label]) => (
                    <span
                      key={key}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        latest?.sensors?.[key] ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-3 pr-4">{formatNumber(latest?.temperature?.objectC, 1, " °C")}</td>
              <td className="py-3 pr-4 text-slate-600">
                {latest?.gps?.fix
                  ? `${formatNumber(latest.gps.latitude, 5)}, ${formatNumber(latest.gps.longitude, 5)}`
                  : latest
                    ? `searching (${latest.gps?.satellites ?? 0} sat)`
                    : "—"}
              </td>
              <td className="py-3 pr-4">
                {latest?.sosActive ? <span className="font-bold text-red-600">SOS</span> : <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3 pr-4">
                {latest?.anomaly ? <SeverityBadge severity={latest.anomaly.severity} /> : <span className="text-xs text-slate-400">n/a</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
