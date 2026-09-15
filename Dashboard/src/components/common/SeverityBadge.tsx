import type { Severity } from "@/types";

const STYLES: Record<Severity, string> = {
  none: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-orange-100 text-orange-800",
  critical: "bg-red-600 text-white",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[severity]}`}>
      {severity === "none" ? "normal" : severity}
    </span>
  );
}
