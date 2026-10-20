/**
 * The ONLY place health numbers are turned into text. Display rules (C1 requirements):
 *  - BPM is shown only when its backend quality is "valid"; otherwise "Unavailable".
 *  - SpO2 is never shown unless the backend explicitly enables display (it is unvalidated).
 *  - MLX90614 object temperature is labelled SURFACE temperature, never body/core temperature.
 *  - Raw red/IR counts are labelled raw ADC counts, never BPM/SpO2.
 *  - Missing values render "Unavailable" — never 0 and never a fabricated value.
 */
import { InfoTip } from "@/components/common/InfoTip";
import { ACTIVITY_LABELS, FLAG_LABELS, TIPS } from "@/constants/explanations";
import type { DataQualityFlag, DeviceHealth } from "@/types";
import { formatNumber, UNAVAILABLE } from "@/utils/format";

export function bpmText(health: DeviceHealth | null | undefined): string {
  if (!health || !health.worn || health.heartRate.quality !== "valid") return UNAVAILABLE;
  return formatNumber(health.heartRate.bpm, 0, " bpm", UNAVAILABLE);
}

export function spo2Text(health: DeviceHealth | null | undefined): string {
  if (!health) return UNAVAILABLE;
  if (!health.spo2.displayEnabled) return "Not validated";
  // Display was switched on for research (config/hri.spo2.displayEnabled). The backend grades it
  // "low_quality" because the curve is uncalibrated, so it is always labelled unvalidated.
  if (!health.worn || health.heartRate.quality !== "valid") return UNAVAILABLE;
  return formatNumber(health.spo2.value, 0, " % (unvalidated)", UNAVAILABLE);
}

export function hrvText(health: DeviceHealth | null | undefined): string {
  if (!health || health.hrv.quality !== "valid") return UNAVAILABLE;
  return formatNumber(health.hrv.rmssdMs, 0, " ms RMSSD", UNAVAILABLE);
}

export function surfaceTempText(value: number | null | undefined): string {
  return formatNumber(value, 1, " °C", UNAVAILABLE);
}

export function activityText(health: DeviceHealth | null | undefined): string {
  return health ? ACTIVITY_LABELS[health.activity.level] : UNAVAILABLE;
}

/** Labelled metric block for detail views. */
export function Metric({ label, value, tip, sub }: { label: string; value: string; tip?: string; sub?: string }) {
  const unavailable = value === UNAVAILABLE || value === "Not validated";
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <p className="eyebrow flex items-center">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${unavailable ? "text-muted" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function FlagList({ flags, empty = "No data-quality problems in the latest chunk." }: { flags: DataQualityFlag[] | undefined; empty?: string }) {
  if (!flags?.length) return <p className="text-sm text-muted">✓ {empty}</p>;
  return (
    <ul className="space-y-1.5">
      {flags.map((f) => (
        <li key={f} className="flex gap-2 text-sm">
          <span aria-hidden="true" className="text-status-warning">
            !
          </span>
          <span>
            <b>{FLAG_LABELS[f]?.label ?? f}</b>
            <span className="text-muted"> — {FLAG_LABELS[f]?.detail ?? ""}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export const METRIC_TIPS = {
  bpm: TIPS.bpm,
  spo2: TIPS.spo2,
  hrv: TIPS.hrv,
  surface: TIPS.surfaceTemp,
  ambient: TIPS.ambientTemp,
  raw: TIPS.rawPpg,
} as const;
