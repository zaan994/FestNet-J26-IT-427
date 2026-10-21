/**
 * C2 — predictive watch (pure). Least-squares line through recent C1 HRI scores; a device is put on
 * the watch list when the score is still below the warning cut-off but the trend projects above it
 * within the horizon. The watch list is a pre-alert for staff attention; it never notifies anyone.
 *
 * Research note: a linear trend over a few minutes is a simple baseline predictor; its usefulness
 * is part of the evaluation, not an assumption.
 */
import type { C2Config } from "../shared/c2Config";

export interface TrendResult {
  watch: boolean;
  reason: "insufficient" | "short_span" | "not_rising" | "noisy" | "already_alerting" | "below_threshold" | "rising";
  currentScore: number | null;
  projectedScore: number | null;
  slopePerMin: number | null;
  points: number;
}

export function predictTrend(series: { t: number; s: number }[] | undefined, nowMs: number, cfg: C2Config): TrendResult {
  const pts = (series ?? []).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.s));
  const base = { currentScore: pts.length ? pts[pts.length - 1].s : null, projectedScore: null, slopePerMin: null, points: pts.length };
  if (pts.length < cfg.watch.minPoints) return { ...base, watch: false, reason: "insufficient" };
  const span = (pts[pts.length - 1].t - pts[0].t) / 1000;
  if (span < cfg.watch.minSpanSec) return { ...base, watch: false, reason: "short_span" };

  const t0 = pts[0].t;
  const xs = pts.map((p) => (p.t - t0) / 1000);
  const ys = pts.map((p) => p.s);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  if (sxx === 0) return { ...base, watch: false, reason: "short_span" };
  const slope = sxy / sxx; // points per second
  const intercept = my - slope * mx;
  const residual = Math.sqrt(xs.reduce((acc, x, i) => acc + (ys[i] - (intercept + slope * x)) ** 2, 0) / n);
  const nowX = (nowMs - t0) / 1000;
  const fitted = intercept + slope * nowX;
  const projected = Math.min(100, Math.max(0, intercept + slope * (nowX + cfg.watch.horizonSec)));
  const result = { ...base, projectedScore: Math.round(projected), slopePerMin: Math.round(slope * 60 * 10) / 10 };

  if (slope <= 0) return { ...result, watch: false, reason: "not_rising" };
  if (residual > cfg.watch.maxResidual) return { ...result, watch: false, reason: "noisy" };
  if ((base.currentScore ?? fitted) >= cfg.hri.warning) return { ...result, watch: false, reason: "already_alerting" };
  if (projected < cfg.hri.warning) return { ...result, watch: false, reason: "below_threshold" };
  return { ...result, watch: true, reason: "rising" };
}
