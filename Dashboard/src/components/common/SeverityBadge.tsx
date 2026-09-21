import type { Severity } from "@/types";

const STYLES: Record<Severity, { dot: string; chip: string; label: string; icon: string }> = {
  none: { dot: "bg-severity-none", chip: "border-severity-none/30 bg-severity-none/10 text-ink", label: "Normal", icon: "✓" },
  warning: { dot: "bg-severity-warning", chip: "border-severity-warning/40 bg-severity-warning/15 text-ink", label: "Warning", icon: "!" },
  danger: { dot: "bg-severity-danger", chip: "border-severity-danger/40 bg-severity-danger/15 text-ink", label: "Danger", icon: "⚠" },
  critical: { dot: "bg-white", chip: "border-severity-critical bg-severity-critical text-white animate-pulse", label: "Critical", icon: "⚠" },
};

/** Severity chip: colour + icon + text (never colour alone). */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = STYLES[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${s.chip}`}>
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}

/** Small coloured dot for dense lists. */
export function SeverityDot({ severity }: { severity: Severity }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${severity === "critical" ? "bg-severity-critical" : STYLES[severity].dot}`} />;
}
