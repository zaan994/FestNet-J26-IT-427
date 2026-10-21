import type { ReactNode } from "react";

import { TIPS } from "@/constants/explanations";

import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";

interface Props {
  label: string;
  value: ReactNode;
  icon: IconName;
  hint?: ReactNode;
  /** Whether the number updates live or is counted from stored records. */
  kind: "live" | "historical";
  tone?: "neutral" | "attention" | "critical";
}

const TONE = {
  neutral: "bg-brand/10 text-brand",
  attention: "bg-status-warning/15 text-status-warning",
  critical: "bg-status-critical/15 text-status-critical",
} as const;

export function StatTile({ label, value, icon, hint, kind, tone = "neutral" }: Props) {
  return (
    <div className="card flex items-start gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="eyebrow flex items-center">
          {label}
          <span className={`ml-2 rounded px-1.5 py-px text-[9px] ${kind === "live" ? "bg-status-normal/15 text-status-normal" : "bg-surface-2 text-muted"}`}>
            {kind === "live" ? "LIVE" : "HISTORICAL"}
          </span>
          <InfoTip text={kind === "live" ? TIPS.live : TIPS.historical} />
        </p>
        <p className="mt-1 text-3xl font-extrabold leading-tight tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
