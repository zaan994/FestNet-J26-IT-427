import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { HistoryPoint } from "@/types";

/** Chart colours follow the active theme through CSS variables (src/styles/index.css). */
const SERIES = "rgb(var(--brand))";
const GRID = "rgb(var(--chart-grid))";
const AXIS = "rgb(var(--chart-axis))";
const SURFACE = "rgb(var(--surface))";
const THRESHOLD = "#E11D48"; // status: critical

export interface Threshold {
  value: number;
  label: string;
}

interface Props {
  title: string;
  unit: string;
  points: HistoryPoint[];
  value: (p: HistoryPoint) => number | null | undefined;
  decimals?: number;
  /** Fixed y-domain, e.g. [80, 100] for SpO2. Defaults to the data range. */
  domain?: [number | "auto", number | "auto"];
  thresholds?: Threshold[];
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const timeFormatLong = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * Single-series chart of one vital over time: 2px line with a soft area wash,
 * one y-axis, no legend (the title names the series), crosshair + tooltip on hover,
 * thresholds as dashed reference lines with a text label.
 */
export function VitalChart({ title, unit, points, value, decimals = 0, domain, thresholds = [] }: Props) {
  const gradientId = useId();
  const data = points.map((p) => ({ ts: p.ts, v: value(p) ?? null }));
  const values = data.map((d) => d.v).filter((v): v is number => v !== null);
  const latest = values.length ? values[values.length - 1] : null;

  return (
    <figure className="card p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs text-muted">
          {latest !== null && <b className="mr-1 text-base text-ink">{latest.toFixed(decimals)}</b>}
          {unit}
        </span>
      </figcaption>
      {values.length ? (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => timeFormat.format(t)}
                tick={{ fill: AXIS, fontSize: 11 }}
                axisLine={{ stroke: GRID }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={domain ?? ["auto", "auto"]}
                tick={{ fill: AXIS, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                allowDecimals={decimals > 0}
              />
              {thresholds.map((t) => (
                <ReferenceLine
                  key={t.label}
                  y={t.value}
                  stroke={THRESHOLD}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: t.label, position: "insideTopRight", fill: AXIS, fontSize: 10 }}
                />
              ))}
              <Tooltip
                cursor={{ stroke: AXIS, strokeWidth: 1, strokeDasharray: "3 3" }}
                content={(props: TooltipProps<number, string>) => <ChartTooltip {...props} unit={unit} decimals={decimals} />}
              />
              <Area type="monotone" dataKey="v" stroke="none" fill={`url(#${gradientId})`} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={SERIES}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2, fill: SERIES }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="flex h-52 items-center justify-center rounded-xl bg-surface-2 text-sm text-muted">No data in this range</p>
      )}
    </figure>
  );
}

function ChartTooltip({ active, payload, unit, decimals }: TooltipProps<number, string> & { unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as { ts: number; v: number | null };
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card">
      <p className="text-muted">{timeFormatLong.format(point.ts)}</p>
      <p className="mt-0.5 text-sm font-bold text-ink">{point.v === null ? "no reading" : `${point.v.toFixed(decimals)} ${unit}`}</p>
    </div>
  );
}
