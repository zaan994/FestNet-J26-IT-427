import { ConfidenceBadge, HriBadge } from "@/components/common/Badges";
import { InfoTip } from "@/components/common/InfoTip";
import { INPUT_LABELS, TIPS } from "@/constants/explanations";
import type { HriResult } from "@/types";
import { formatClock } from "@/utils/format";

import { FlagList } from "./Metrics";

/** Full explanation of one HRI result: why the score is what it is and how far to trust it. */
export function HriPanel({ hri }: { hri: HriResult | null | undefined }) {
  if (!hri) {
    return (
      <section className="card">
        <h2 className="text-lg font-bold">Health Risk Indicator</h2>
        <p className="mt-2 text-sm text-muted">No HRI has been computed for this assignment yet.</p>
      </section>
    );
  }
  const lowConfidence = hri.confidence.level === "low" || hri.confidence.level === "none";
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center text-lg font-bold">
          Health Risk Indicator
          <InfoTip text={TIPS.hri} />
        </h2>
        <span className="rounded-full border border-status-warning/40 bg-status-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          Experimental · not validated
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <HriBadge hri={hri} />
        <ConfidenceBadge level={hri.confidence.level} value={hri.confidence.value} />
        <InfoTip text={TIPS.confidence} />
        <span className="text-xs text-muted">
          at {formatClock(hri.calculatedAt)} · {hri.window.seconds}s window · {hri.baselineAvailable ? "personal baseline available" : "no personal baseline yet"}
        </span>
      </div>

      {hri.hriScore === null && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm">
          No score: there is not enough valid data. <b>This does not mean low risk.</b>
        </p>
      )}
      {lowConfidence && hri.hriScore !== null && (
        <p className="rounded-xl bg-status-warning/10 p-3 text-sm">Low confidence — data quality is poor; do not rely on this score.</p>
      )}

      <div>
        <h3 className="eyebrow mb-2">Contributing factors</h3>
        {hri.contributingFactors.length ? (
          <ul className="space-y-2">
            {hri.contributingFactors.map((f) => (
              <li key={f.ruleId} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                <span>
                  <b>{f.label}</b>
                  <span className="block text-xs text-muted">{f.detail}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums">+{f.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No rule fired in this window.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="eyebrow mb-1">Inputs used</h3>
          <p className="text-sm">{hri.availableInputs.map((i) => INPUT_LABELS[i]).join(", ") || "None"}</p>
        </div>
        <div>
          <h3 className="eyebrow mb-1">Missing inputs</h3>
          <p className="text-sm text-muted">{hri.missingInputs.map((i) => INPUT_LABELS[i]).join(", ") || "None"}</p>
        </div>
      </div>

      <div>
        <h3 className="eyebrow mb-2 flex items-center">
          Data quality
          <InfoTip text={TIPS.dataQuality} />
        </h3>
        <FlagList flags={hri.dataQuality.flags} />
        {hri.dataQuality.notes.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-muted">
            {hri.dataQuality.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted">
        {hri.algorithmVersion} · {hri.configVersion}. Rules-based research indicator; it must never replace assessment by medical staff.
      </p>
    </section>
  );
}
