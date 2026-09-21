import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { VitalChart } from "@/components/charts/VitalChart";
import { Icon } from "@/components/common/Icon";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { VitalTile } from "@/components/common/VitalTile";
import { ANOMALY_LABELS, MOTION_LABELS, STRESS_LABELS } from "@/constants/health";
import { useBandAlerts, useBandHistory } from "@/hooks/useBandDetail";
import { useBands } from "@/hooks/useBands";
import { useNow } from "@/hooks/useNow";
import type { HistoryPoint, SensorStatus } from "@/types";
import { formatDuration, formatNumber, timeAgo } from "@/utils/format";
import { DEFAULT_THRESHOLDS as T } from "@shared/thresholds";

// C1 — Real-Time Health Monitoring (Rizvi M.Z.M.)

const RANGES = [
  { label: "10 min", points: 60 },
  { label: "1 hour", points: 360 },
  { label: "6 hours", points: 2160 },
] as const;

const SENSORS: [keyof SensorStatus, string][] = [
  ["max30102", "Pulse · MAX30102"],
  ["mlx90614", "Temperature · MLX90614"],
  ["mpu6050", "Motion · MPU6050"],
  ["gps", "GPS · NEO-6M"],
  ["oled", "Display"],
];

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });
const timeOnly = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" });

export function BandDetailPage() {
  const { deviceId = "" } = useParams();
  const { bands, loading } = useBands();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const [showTable, setShowTable] = useState(false);
  const history = useBandHistory(deviceId, range.points);
  const alerts = useBandAlerts(deviceId, 20);
  const now = useNow(1000);

  if (loading) return <LoadingScreen />;
  const band = bands.find((b) => b.deviceId === deviceId);
  if (!band) {
    return (
      <div className="card">
        <p className="text-sm">Band “{deviceId}” is not registered.</p>
        <Link to="/health" className="btn-outline mt-4">
          <Icon name="back" className="h-4 w-4" /> Back to Live Health
        </Link>
      </div>
    );
  }

  const { health, latest, online, lastSeenAt } = band;
  const v = health?.vitals;
  const types = health?.anomaly.types ?? [];
  const active = online && health?.anomaly.active;
  const points: HistoryPoint[] = history ?? [];

  return (
    <>
      <Link to="/health" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <Icon name="back" className="h-4 w-4" /> Live Health
      </Link>

      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white shadow-glow">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Component 1 · Live health</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{deviceId}</h1>
            <p className="mt-1 text-sm text-white/85">
              {band.index?.label && band.index.label !== deviceId ? `${band.index.label} · ` : ""}
              {online ? (health?.worn ? "Online · on the wrist" : "Online · not worn") : "Offline"} · updated {timeAgo(lastSeenAt, now)}
              {latest?.fwVersion ? ` · fw ${latest.fwVersion}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-white/80">Heart rate</p>
              <p className="text-5xl font-extrabold tabular-nums leading-none">
                {formatNumber(v?.bpm)}
                <span className="ml-1 text-lg font-semibold text-white/80">bpm</span>
              </p>
            </div>
            {health && (
              <span className="rounded-2xl bg-white/15 p-1.5 backdrop-blur">
                <SeverityBadge severity={online ? health.anomaly.severity : "none"} />
              </span>
            )}
          </div>
        </div>
      </section>

      {active && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-severity-critical/50 bg-severity-critical/10 p-4">
          <Icon name="alert" className="mt-0.5 h-6 w-6 shrink-0 text-severity-critical" />
          <div>
            <p className="font-bold">
              {health!.anomaly.severity.toUpperCase()}: {types.map((t) => ANOMALY_LABELS[t]).join(" · ")}
            </p>
            {health!.anomaly.since && (
              <p className="text-sm text-muted">
                since {timeOnly.format(health!.anomaly.since)} ({formatDuration(now - health!.anomaly.since)})
              </p>
            )}
          </div>
        </div>
      )}

      {!health && (
        <div className="card mb-6 text-sm text-muted">
          No computed health data yet. The C1 processor must be running — deploy the Cloud Functions or run{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink">npm run process</code> in <code>Backend/scripts</code>.
        </div>
      )}

      {/* Live vitals */}
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <VitalTile
          icon="heart"
          label="Heart rate"
          value={formatNumber(v?.bpm)}
          unit="bpm"
          detail={health?.signal.beatsInChunk ? `${health.signal.beatsInChunk} beats in last 2 s` : "—"}
          alert={types.includes("bpm_spike")}
        />
        <VitalTile
          icon="droplet"
          label="SpO2"
          value={formatNumber(v?.spo2)}
          unit="%"
          detail={`alert below ${T.spo2Low} %`}
          alert={types.includes("low_spo2")}
        />
        <VitalTile
          icon="thermometer"
          label="Body temp (est. core)"
          value={formatNumber(health?.temperature.coreEstC, 1)}
          unit="°C"
          detail={`skin ${formatNumber(health?.temperature.skinC, 1, " °C")} · air ${formatNumber(health?.temperature.ambientC, 1, " °C")}`}
          alert={types.includes("high_temp")}
        />
        <VitalTile
          icon="activity"
          label="HRV (RMSSD)"
          value={formatNumber(v?.hrv.rmssdMs)}
          unit="ms"
          detail={`SDNN ${formatNumber(v?.hrv.sdnnMs, 0, " ms")} · ${v?.hrv.ibiCount ?? 0} beats / 60 s`}
        />
        <VitalTile
          icon="brain"
          label="Stress"
          value={v ? STRESS_LABELS[v.stress.level] : "—"}
          detail={v ? `score ${formatNumber(v.stress.score)} / 100 · ${v.stress.baselineReady ? "personal baseline" : "learning baseline"}` : "—"}
        />
        <VitalTile
          icon="move"
          label="Motion"
          value={health ? MOTION_LABELS[health.motion.state] : "—"}
          detail={health?.motion.stillSec ? `no movement for ${health.motion.stillSec} s` : formatNumber(health?.motion.magG, 2, " g")}
          alert={types.includes("fall") || types.includes("stillness")}
        />
        <VitalTile
          icon="signal"
          label="Signal quality"
          value={formatNumber(health?.signal.perfusionIndex, 2)}
          unit="% PI"
          detail={health?.worn ? "sensor on skin" : "no skin contact"}
        />
        <VitalTile
          icon="timer"
          label="Processing latency"
          value={formatNumber(health?.latency.processingMs)}
          unit="ms"
          detail={`band → computed: ${formatNumber(health?.latency.endToEndMs, 0, " ms")}`}
        />
      </section>

      {/* History */}
      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">History</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Time range"
              options={RANGES.map((r) => ({ value: r.label, label: r.label }))}
              value={range.label}
              onChange={(label) => setRange(RANGES.find((r) => r.label === label) ?? RANGES[0])}
            />
            <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setShowTable((s) => !s)}>
              {showTable ? "Show charts" : "Show table"}
            </button>
          </div>
        </div>

        {history === null ? (
          <LoadingScreen message="Loading history…" />
        ) : showTable ? (
          <HistoryTable points={points} />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <VitalChart title="Heart rate" unit="bpm" points={points} value={(p) => p.bpm} />
            <VitalChart
              title="SpO2"
              unit="%"
              points={points}
              value={(p) => p.spo2}
              domain={[80, 100]}
              thresholds={[{ value: T.spo2Low, label: `alert < ${T.spo2Low} %` }]}
            />
            <VitalChart
              title="Estimated core temperature"
              unit="°C"
              points={points}
              value={(p) => p.coreEstC}
              decimals={1}
              thresholds={[{ value: T.coreTempHighC, label: `alert > ${T.coreTempHighC} °C` }]}
            />
            <VitalChart title="HRV (RMSSD)" unit="ms" points={points} value={(p) => p.rmssdMs} />
            <VitalChart title="Stress score" unit="/ 100" points={points} value={(p) => p.stressScore} domain={[0, 100]} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Alerts */}
        <section className="card">
          <h2 className="mb-4 text-lg font-bold">Anomaly alerts</h2>
          {alerts === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">No alerts for this band. ✓</p>
          ) : (
            <ol className="relative space-y-4 border-l-2 border-line pl-5">
              {alerts.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand-gradient ring-4 ring-surface" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {a.source === "sos" ? "SOS" : (a.types ?? []).map((t) => ANOMALY_LABELS[t]).join(" · ")}
                      </p>
                      <p className="text-xs text-muted">
                        {a.serverCreatedAt ? dateTime.format(a.serverCreatedAt) : "—"} · {a.status}
                      </p>
                      <p className="text-xs text-muted">
                        HR {formatNumber(a.vitals?.bpm)} · SpO2 {formatNumber(a.vitals?.spo2, 0, "%")} ·{" "}
                        {formatNumber(a.vitals?.coreEstC, 1, " °C")}
                      </p>
                    </div>
                    <SeverityBadge severity={a.severity} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Device & data quality */}
        <section className="card">
          <h2 className="mb-4 text-lg font-bold">Band &amp; data quality</h2>
          <div className="mb-5 flex flex-wrap gap-2">
            {SENSORS.map(([key, label]) => {
              const ok = Boolean(latest?.sensors?.[key]);
              return (
                <span
                  key={key}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    ok ? "border-severity-none/30 bg-severity-none/10 text-ink" : "border-line bg-surface-2 text-muted"
                  }`}
                >
                  {ok ? "✓" : "✕"} {label}
                </span>
              );
            })}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ["Wi-Fi signal", formatNumber(latest?.net?.rssi, 0, " dBm")],
              ["Raw chunk #", String(latest?.raw?.lastSeq ?? "—")],
              ["Chunks waiting / dropped", `${latest?.raw?.pendingChunks ?? "—"} / ${latest?.raw?.droppedChunks ?? "—"}`],
              ["PPG samples lost", String(latest?.raw?.ppgOverflowTotal ?? "—")],
              ["Uptime", formatDuration(latest?.uptimeMs)],
              ["SOS presses", String(latest?.sosPressCount ?? 0)],
            ].map(([k, val]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-3 py-2">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-semibold tabular-nums">{val}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

function HistoryTable({ points }: { points: HistoryPoint[] }) {
  const rows = [...points].reverse();
  if (rows.length === 0) return <p className="card text-sm text-muted">No data in this range.</p>;
  return (
    <div className="card max-h-[28rem] overflow-auto p-0">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line">
            {["Time", "HR (bpm)", "SpO2 (%)", "Core (°C)", "RMSSD (ms)", "Stress", "Motion", "Severity"].map((h) => (
              <th key={h} className="eyebrow px-4 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((p) => (
            <tr key={p.ts} className="hover:bg-surface-2/60">
              <td className="px-4 py-1.5">{timeOnly.format(p.ts)}</td>
              <td className="px-4 py-1.5">{formatNumber(p.bpm)}</td>
              <td className="px-4 py-1.5">{formatNumber(p.spo2)}</td>
              <td className="px-4 py-1.5">{formatNumber(p.coreEstC, 1)}</td>
              <td className="px-4 py-1.5">{formatNumber(p.rmssdMs)}</td>
              <td className="px-4 py-1.5">{formatNumber(p.stressScore)}</td>
              <td className="px-4 py-1.5">{MOTION_LABELS[p.motionState]}</td>
              <td className="px-4 py-1.5 capitalize">{p.severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
