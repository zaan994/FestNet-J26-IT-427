/** Status chips — every chip carries an icon/text, never colour alone. */
import type { ReactNode } from "react";

import { CONFIDENCE_LABELS, FRESHNESS_LABELS, HRI_STATUS_LABELS, QUALITY_LABELS } from "@/constants/explanations";
import type { AlertSeverity, ConfidenceLevel, EmergencyPriority, EmergencyStatus, Freshness, HriResult, HriStatus, MetricQuality } from "@/types";

type Tone = "neutral" | "normal" | "warning" | "danger" | "critical" | "brand";

const TONE: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-muted",
  normal: "border-status-normal/30 bg-status-normal/10 text-ink",
  warning: "border-status-warning/40 bg-status-warning/10 text-ink",
  danger: "border-status-danger/40 bg-status-danger/10 text-ink",
  critical: "border-status-critical bg-status-critical text-white dark:text-slate-900",
  brand: "border-brand/30 bg-brand/10 text-ink",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-muted/50",
  normal: "bg-status-normal",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
  critical: "bg-white dark:bg-slate-900",
  brand: "bg-brand",
};

export function Badge({ tone = "neutral", icon, children, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      {icon ?? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  );
}

const HRI_TONE: Record<HriStatus, Tone> = { insufficient_data: "neutral", low: "normal", elevated: "warning", high: "danger" };
const HRI_ICON: Record<HriStatus, string> = { insufficient_data: "?", low: "✓", elevated: "!", high: "⚠" };

/** HRI status + score; low-confidence results are visibly faded and labelled. */
export function HriBadge({ hri }: { hri: HriResult | null | undefined }) {
  if (!hri) return <Badge>No HRI yet</Badge>;
  const lowConfidence = hri.confidence.level === "low" || hri.confidence.level === "none";
  return (
    <span className={`inline-flex items-center gap-1 ${lowConfidence ? "opacity-60" : ""}`} title={lowConfidence ? "Low confidence — do not rely on this" : undefined}>
      <Badge tone={HRI_TONE[hri.status]} icon={<span aria-hidden="true">{HRI_ICON[hri.status]}</span>}>
        {HRI_STATUS_LABELS[hri.status]}
        {hri.hriScore !== null && <span className="tabular-nums">· {hri.hriScore}</span>}
      </Badge>
    </span>
  );
}

const CONF_TONE: Record<ConfidenceLevel, Tone> = { none: "neutral", low: "warning", medium: "brand", high: "normal" };
export function ConfidenceBadge({ level, value }: { level: ConfidenceLevel; value?: number }) {
  return (
    <Badge tone={CONF_TONE[level]} title={value !== undefined ? `Confidence ${Math.round(value * 100)} %` : undefined}>
      {CONFIDENCE_LABELS[level]} conf.
    </Badge>
  );
}

const FRESH_TONE: Record<Freshness, Tone> = { live: "normal", stale: "warning", offline: "neutral", unknown: "neutral" };
const FRESH_ICON: Record<Freshness, string> = { live: "●", stale: "◐", offline: "○", unknown: "○" };
export function FreshnessBadge({ freshness, age }: { freshness: Freshness; age?: string }) {
  return (
    <Badge tone={FRESH_TONE[freshness]} icon={<span aria-hidden="true">{FRESH_ICON[freshness]}</span>}>
      {FRESHNESS_LABELS[freshness]}
      {age && freshness !== "unknown" ? ` · ${age}` : ""}
    </Badge>
  );
}

const Q_TONE: Record<MetricQuality, Tone> = { valid: "normal", low_quality: "warning", unavailable: "neutral" };
export function QualityBadge({ quality }: { quality: MetricQuality }) {
  return <Badge tone={Q_TONE[quality]}>{QUALITY_LABELS[quality]}</Badge>;
}

const PRIORITY_TONE: Record<EmergencyPriority, Tone> = { P1: "critical", P2: "danger", P3: "warning" };
export function PriorityBadge({ priority }: { priority: EmergencyPriority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority]} icon={<span aria-hidden="true">⚠</span>}>
      {priority}
    </Badge>
  );
}

const STATUS_TONE: Record<EmergencyStatus, Tone> = { open: "danger", escalated: "critical", acknowledged: "warning", in_progress: "brand", resolved: "normal" };
export const STATUS_LABEL: Record<EmergencyStatus, string> = {
  open: "Open",
  escalated: "Escalated",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
};
export function AlertStatusBadge({ status }: { status: EmergencyStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

const SEVERITY_TONE: Record<AlertSeverity, Tone> = { warning: "warning", danger: "danger", critical: "critical" };
const SEVERITY_ICON: Record<AlertSeverity, string> = { warning: "!", danger: "⚠", critical: "⚠" };
export function SeverityBadge({ severity }: { severity: AlertSeverity | undefined }) {
  const s = severity ?? "critical";
  return (
    <Badge tone={SEVERITY_TONE[s]} icon={<span aria-hidden="true">{SEVERITY_ICON[s]}</span>}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </Badge>
  );
}
