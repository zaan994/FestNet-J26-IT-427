import { useTheme, type ThemeMode } from "@/hooks/useTheme";

import { SegmentedControl } from "./SegmentedControl";

const OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "light", label: "Light", icon: "☀" },
  { mode: "dark", label: "Night", icon: "☾" },
  { mode: "system", label: "Auto", icon: "◐" },
];

/** Light / Night / Auto switch. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      tone="neutral"
      value={mode}
      onChange={setMode}
      options={OPTIONS.map((o) => ({
        value: o.mode,
        title: `${o.label} theme`,
        label: (
          <>
            <span aria-hidden="true">{o.icon}</span>
            {compact ? <span className="sr-only">{o.label}</span> : o.label}
          </>
        ),
      }))}
    />
  );
}
