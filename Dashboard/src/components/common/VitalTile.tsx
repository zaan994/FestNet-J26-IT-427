import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

interface Props {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  /** Secondary line (e.g. "skin 34.2 °C"). */
  detail?: ReactNode;
  /** Highlights the tile when the value breaches a threshold (icon + text + border, never colour alone). */
  alert?: boolean;
}

/** One live vital: icon, label, big value, unit and a detail line. */
export function VitalTile({ label, value, unit, icon, detail, alert }: Props) {
  return (
    <div
      className={`card relative overflow-hidden p-4 transition ${
        alert ? "border-severity-critical/60 ring-2 ring-severity-critical/25" : "hover:shadow-glow"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              alert ? "bg-severity-critical/15 text-severity-critical" : "bg-brand/10 text-brand"
            }`}
          >
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
        <p className="eyebrow flex-1">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">
        {value}
        {unit && value !== "—" && <span className="ml-1 text-sm font-semibold text-muted">{unit}</span>}
      </p>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      {alert && <p className="mt-1 text-xs font-bold text-severity-critical">⚠ Out of range</p>}
    </div>
  );
}
