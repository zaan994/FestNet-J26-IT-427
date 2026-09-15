/** Formats a possibly-missing number: formatNumber(36.456, 1, "°C") -> "36.5°C", null -> "—". */
export function formatNumber(value: number | null | undefined, decimals = 0, unit = ""): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}${unit}`;
}

/** "just now", "12 s ago", "3 min ago", "2 h ago". */
export function timeAgo(timestamp: number | null | undefined, now = Date.now()): string {
  if (!timestamp) return "never";
  const sec = Math.max(0, Math.round((now - timestamp) / 1000));
  if (sec < 3) return "just now";
  if (sec < 60) return `${sec} s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
