export const UNAVAILABLE = "Unavailable";

/** Formats a possibly-missing number: formatNumber(36.456, 1, " °C") -> "36.5 °C", null -> fallback. */
export function formatNumber(value: number | null | undefined, decimals = 0, unit = "", fallback = "—"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return `${value.toFixed(decimals)}${unit}`;
}

/** "just now", "12 s ago", "3 min ago", "2 h ago", "3 d ago". */
export function timeAgo(timestamp: number | null | undefined, now = Date.now()): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "never";
  const sec = Math.max(0, Math.round((now - timestamp) / 1000));
  if (sec < 3) return "just now";
  if (sec < 60) return `${sec} s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatClock(ts: number | null | undefined): string {
  return ts && Number.isFinite(ts) ? clock.format(ts) : "—";
}

export function formatDateTime(ts: number | null | undefined): string {
  return ts && Number.isFinite(ts) ? dateTime.format(ts) : "—";
}

export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)} %` : "—";
}

/** CSV download (browser) for de-identified exports. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
