/** Small numeric helpers for the C1 signal processing (no dependencies). */

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/** Sample standard deviation. */
export function std(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / (xs.length - 1));
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Linear-interpolated percentile, p in [0, 100]. */
export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/** Centred moving average (window shrinks at the edges). O(n) via prefix sums. */
export function movingAverage(xs: readonly number[], window: number): number[] {
  const n = xs.length;
  const half = Math.max(0, Math.floor(window / 2));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + xs[i];
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    out[i] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
  }
  return out;
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Exponential smoothing; returns `next` when there is no previous value. */
export function smooth(prev: number | null, next: number, alpha: number): number {
  return prev === null ? next : prev + alpha * (next - prev);
}

/** Rounds, or returns null for NaN / Infinity / null / undefined. */
export function roundOrNull(x: number | null | undefined, decimals = 0): number | null {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

/** RTDB returns arrays as arrays, or as {0:..,1:..} objects when sparse; normalise both. */
export function toNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.filter((v): v is number => typeof v === "number");
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (value as Record<string, unknown>)[k])
      .filter((v): v is number => typeof v === "number");
  }
  return [];
}
