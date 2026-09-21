import { useId, type ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface Props<T extends string> {
  /** Accessible name of the group, e.g. "Time range". */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** "brand" = gradient for the selected segment, "neutral" = raised surface. */
  tone?: "brand" | "neutral";
}

/**
 * Segmented control built on native radio inputs: keyboard arrows, focus and screen-reader
 * state come from the browser, so no hand-written ARIA roles are needed.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, tone = "brand" }: Props<T>) {
  const name = useId();
  const selected = tone === "brand" ? "bg-brand-gradient text-white shadow-glow" : "bg-surface text-ink shadow-card";

  return (
    <fieldset className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            title={o.title}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/50 ${
              active ? selected : "text-muted hover:text-ink"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.value}
              checked={active}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        );
      })}
    </fieldset>
  );
}
