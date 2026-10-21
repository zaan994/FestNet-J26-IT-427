import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { VitalChart } from "@/components/charts/VitalChart";
import { Badge, FreshnessBadge, QualityBadge } from "@/components/common/Badges";
import { Icon } from "@/components/common/Icon";
import { InfoTip } from "@/components/common/InfoTip";
import { PageHeader } from "@/components/common/PageHeader";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/common/States";
import { HriPanel } from "@/components/health/HriPanel";
import { activityText, bpmText, FlagList, hrvText, Metric, METRIC_TIPS, spo2Text, surfaceTempText } from "@/components/health/Metrics";
import { TIPS } from "@/constants/explanations";
import { useEventContext } from "@/hooks/useEventContext";
import { toDeviceRow, useHriConfig, useThresholds } from "@/hooks/useEventDevices";
import { useDevicesLive, useEventAssignments, useHistory } from "@/hooks/useEventData";
import { useNow } from "@/hooks/useNow";
import { formatClock, formatDuration, formatNumber, percent, timeAgo, UNAVAILABLE } from "@/utils/format";

// C1 — per-band detail (Rizvi M.Z.M.)

const WINDOWS = [
  { label: "10 min", ms: 10 * 60_000 },
  { label: "1 h", ms: 3_600_000 },
  { label: "6 h", ms: 6 * 3_600_000 },
] as const;

function SensorRow({ name, detected, valid }: { name: string; detected: boolean | null; valid: string }) {
  return (
    <tr className="border-t border-line">
      <td className="td font-medium">{name}</td>
      <td className="td">{detected === null ? <Badge>Unknown</Badge> : detected ? <Badge tone="normal">Detected</Badge> : <Badge tone="danger">Not detected</Badge>}</td>
      <td className="td text-xs text-muted">{valid}</td>
    </tr>
  );
}

export function DeviceDetailPage() {
  const { deviceId = "" } = useParams();
  const { selectedEventId } = useEventContext();
  const assignments = useEventAssignments(selectedEventId, "active");
  const assignment = assignments.data.find((a) => a.deviceId === deviceId) ?? null;
  const ids = useMemo(() => (assignment ? [deviceId] : []), [assignment, deviceId]);
  const live = useDevicesLive(ids);
  const thresholds = useThresholds();
  const hriConfig = useHriConfig();
  const now = useNow(1000);
  const [windowMs, setWindowMs] = useState<number>(WINDOWS[0].ms);
  const history = useHistory(assignment?.assignmentId ?? null, windowMs);

  if (assignments.loading) return <SkeletonCards count={4} />;
  if (!assignment) {
    return (
      <EmptyState title={`${deviceId} is not assigned in this event`} action={<Link className="btn-outline" to="/health">Back to Live Health</Link>}>
        Health data is only shown for a band with an active assignment in the selected event, so data from different events and wearers is never
        mixed.
      </EmptyState>
    );
  }

  const row = toDeviceRow(assignment, live[deviceId], now, thresholds);
  const { latest, health } = row;
  const sig = health?.signal;

  return (
    <>
      <Link to="/health" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="back" className="h-4 w-4" /> Live Health
      </Link>
      <PageHeader
        eyebrow="Component 1 · Band detail"
        title={deviceId}
        subtitle={
          <>
            Participant <span className="font-mono">{row.participantId}</span> · assigned {timeAgo(assignment.startedAt, now)} · firmware{" "}
            {latest?.fwVersion ?? "unknown"}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {row.sosActive && (
              <Badge tone="critical" icon={<span aria-hidden="true">⚠</span>}>
                SOS ACTIVE
              </Badge>
            )}
            <FreshnessBadge freshness={row.freshness} age={timeAgo(row.lastSeenAt, now)} />
          </div>
        }
      />
      {row.error && <ErrorState message={row.error} />}

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card space-y-4 xl:col-span-2">
          <h2 className="text-lg font-bold">Latest derived values</h2>
          {!health && <p className="text-sm text-muted">The backend has not processed data for this assignment yet (is the worker / Cloud Function running?).</p>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Metric label="Heart rate" value={bpmText(health)} tip={METRIC_TIPS.bpm} sub={health ? `quality: ${health.heartRate.quality.replace("_", " ")}` : undefined} />
            <Metric label="SpO2" value={spo2Text(health)} tip={METRIC_TIPS.spo2} />
            <Metric label="HRV" value={hrvText(health)} tip={METRIC_TIPS.hrv} sub={health ? `${health.hrv.ibiCount} intervals` : undefined} />
            <Metric
              label="Surface temp"
              value={surfaceTempText(health?.temperature.surfaceC ?? latest?.temperature.surfaceC)}
              tip={METRIC_TIPS.surface}
              sub={health?.temperature.surfaceBaselineC != null ? `baseline ${formatNumber(health.temperature.surfaceBaselineC, 1, " °C")}` : "not core body temperature"}
            />
            <Metric label="Ambient temp" value={surfaceTempText(health?.temperature.ambientC ?? latest?.temperature.ambientC)} tip={METRIC_TIPS.ambient} />
            <Metric
              label="Activity"
              value={activityText(health)}
              sub={health ? `still ${health.activity.stillSec}s${health.activity.impactDetected ? " · possible impact" : ""}` : undefined}
            />
          </div>
          {health && (
            <div className="flex flex-wrap gap-2 text-xs">
              <QualityBadge quality={health.heartRate.quality} />
              <Badge>{health.worn ? "Worn (skin contact)" : "Not worn"}</Badge>
              <Badge>measured {health.measuredAt ? formatClock(health.measuredAt) : "— (clock not synced)"}</Badge>
              <Badge>processing {formatNumber(health.latency.processingMs, 0, " ms")}</Badge>
              <Badge>end-to-end {formatNumber(health.latency.endToEndMs, 0, " ms")}</Badge>
            </div>
          )}
        </section>

        <HriPanel hri={health?.hri} />
      </div>

      <section className="card mt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Trends (this assignment only)</h2>
          <SegmentedControl
            label="Time window"
            options={WINDOWS.map((w) => ({ value: String(w.ms), label: w.label }))}
            value={String(windowMs)}
            onChange={(v) => setWindowMs(Number(v))}
          />
        </div>
        {history.error && <ErrorState message={history.error} />}
        {history.loading ? (
          <SkeletonCards count={4} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <VitalChart title="Heart rate (valid only)" unit="bpm" points={history.data} value={(p) => (p.bpmQuality === "valid" ? p.bpm : null)} />
            <VitalChart title="HRI score" unit="/100" points={history.data} value={(p) => p.hriScore} domain={[0, 100]} thresholds={[{ value: hriConfig.statusCutoffs.high, label: "high" }, { value: hriConfig.statusCutoffs.elevated, label: "elevated" }]} />
            <VitalChart title="HRV (RMSSD)" unit="ms" points={history.data} value={(p) => p.rmssdMs} />
            <VitalChart title="Surface temperature" unit="°C" decimals={1} points={history.data} value={(p) => p.surfaceC} />
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 flex items-center text-lg font-bold">
            Sensors
            <InfoTip text={TIPS.sensorDetected} />
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Sensor</th>
                <th className="th">At boot</th>
                <th className="th">Current measurement</th>
              </tr>
            </thead>
            <tbody>
              <SensorRow name="MAX30102 (PPG)" detected={latest?.sensors.ppg ?? null} valid={health ? (health.worn ? `HR ${health.heartRate.quality.replace("_", " ")}` : "no skin contact") : UNAVAILABLE} />
              <SensorRow name="MPU6050 (IMU)" detected={latest?.sensors.imu ?? null} valid={health ? `${health.signal.imuSamples}/${health.signal.imuExpected} samples` : UNAVAILABLE} />
              <SensorRow name="MLX90614 (temp)" detected={latest?.sensors.temperature ?? null} valid={latest?.temperature.surfaceC != null ? "reading present" : "no valid reading"} />
              <SensorRow name="GPS" detected={latest?.sensors.gpsFix ?? null} valid={{ fresh: "current fix", stale: "fix is STALE", no_fix: "no fix", unknown: UNAVAILABLE }[row.gps]} />
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            Battery: {latest?.batteryPct != null ? `${latest.batteryPct} %` : UNAVAILABLE}
            <InfoTip text={TIPS.battery} /> · Wi-Fi RSSI {formatNumber(latest?.net.rssi, 0, " dBm")} · uptime {formatDuration(latest?.uptimeMs)}
          </p>
        </section>

        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Signal &amp; upload counters</h2>
          <FlagList flags={sig?.flags} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">PPG samples (last chunk)</dt>
            <dd className="tabular-nums">{sig ? `${sig.ppgSamples}/${sig.ppgExpected} (${percent(sig.ppgSamples, sig.ppgExpected)})` : UNAVAILABLE}</dd>
            <dt className="text-muted">IMU samples (last chunk)</dt>
            <dd className="tabular-nums">{sig ? `${sig.imuSamples}/${sig.imuExpected} (${percent(sig.imuSamples, sig.imuExpected)})` : UNAVAILABLE}</dd>
            <dt className="text-muted">Perfusion index</dt>
            <dd className="tabular-nums">{formatNumber(sig?.perfusionIndex, 2, " %", UNAVAILABLE)}</dd>
            <dt className="text-muted">PPG FIFO overflow (total)</dt>
            <dd className="tabular-nums">{formatNumber(latest?.raw.ppgOverflowTotal, 0, "", UNAVAILABLE)}</dd>
            <dt className="text-muted">Last raw seq · pending · dropped</dt>
            <dd className="tabular-nums">
              {formatNumber(latest?.raw.lastSeq)} · {formatNumber(latest?.raw.pendingChunks)} · {formatNumber(latest?.raw.droppedChunks)}
            </dd>
            <dt className="text-muted">Clock</dt>
            <dd>{latest?.clockSynced ? "NTP synced" : "not synced"}</dd>
            <dt className="flex items-center text-muted">
              Raw optical counts
              <InfoTip text={TIPS.rawPpg} />
            </dt>
            <dd className="tabular-nums text-xs">
              red {formatNumber(latest?.pulseRaw.red)} · IR {formatNumber(latest?.pulseRaw.ir)} <span className="text-muted">(ADC counts, not BPM)</span>
            </dd>
          </dl>
          {latest?.issues.length ? (
            <ul className="list-disc pl-5 text-xs text-muted">
              {latest.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}
