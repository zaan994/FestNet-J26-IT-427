import { Link } from "react-router-dom";

import { SeverityBadge } from "@/components/common/SeverityBadge";
import { StatusDot } from "@/components/common/StatusDot";
import { ANOMALY_LABELS, MOTION_LABELS, STRESS_LABELS } from "@/constants/health";
import type { BandView, Severity } from "@/types";
import { formatNumber, timeAgo } from "@/utils/format";

const SEVERITY_FRAME: Record<Severity, string> = {
  none: "",
  warning: "border-severity-warning/60 ring-2 ring-severity-warning/20",
  danger: "border-severity-danger/70 ring-2 ring-severity-danger/25",
  critical: "border-severity-critical ring-4 ring-severity-critical/30",
};

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums">
        {value}
        {unit && value !== "—" && <span className="ml-0.5 text-xs font-medium text-muted">{unit}</span>}
      </p>
    </div>
  );
}

/** Compact live card for one band in the Live Health grid. */
export function BandHealthCard({ band, now }: { band: BandView; now: number }) {
  const { deviceId, index, health, online, lastSeenAt } = band;
  const severity: Severity = online && health ? health.anomaly.severity : "none";
  const v = health?.vitals;
  const worn = health?.worn ?? false;

  return (
    <Link
      to={`/health/${deviceId}`}
      className={`card group block p-5 transition hover:-translate-y-0.5 hover:shadow-glow ${SEVERITY_FRAME[severity]} ${
        online ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-sm font-extrabold text-white shadow-glow">
            {deviceId.replace(/\D/g, "").slice(-3) || "#"}
          </span>
          <div>
            <p className="font-bold group-hover:text-brand">{deviceId}</p>
            <StatusDot
              online={online}
              label={online ? (worn ? "Worn" : "Not worn") : lastSeenAt === null ? "Waiting for data…" : `Offline · ${timeAgo(lastSeenAt, now)}`}
            />
          </div>
        </div>
        {online && health && <SeverityBadge severity={severity} />}
      </div>
      {index?.label && index.label !== deviceId && <p className="mt-2 text-xs text-muted">{index.label}</p>}

      {online && health?.anomaly.active && (health.anomaly.types?.length ?? 0) > 0 && (
        <p className="mt-3 rounded-xl border border-severity-critical/30 bg-severity-critical/10 px-3 py-2 text-xs font-semibold text-ink">
          ⚠ {health.anomaly.types!.map((t) => ANOMALY_LABELS[t]).join(" · ")}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Heart" value={formatNumber(v?.bpm)} unit="bpm" />
        <Metric label="SpO2" value={formatNumber(v?.spo2)} unit="%" />
        <Metric label="Core" value={formatNumber(health?.temperature.coreEstC, 1)} unit="°C" />
        <Metric label="HRV" value={formatNumber(v?.hrv.rmssdMs)} unit="ms" />
        <Metric label="Stress" value={v ? STRESS_LABELS[v.stress.level] : "—"} />
        <Metric label="Motion" value={health ? MOTION_LABELS[health.motion.state] : "—"} />
      </div>
    </Link>
  );
}
