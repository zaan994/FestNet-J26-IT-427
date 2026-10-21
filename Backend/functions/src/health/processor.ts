/**
 * C1 health processor v2 — one raw chunk in, derived health + explainable HRI out.
 *
 * Pure function of (previous state, chunk, assignment context, HRI config): no Firebase access,
 * so it runs in the Cloud Function, in the local worker, and in unit tests with synthetic signals.
 *
 * Guarantees (C1 requirements):
 *  - Raw optical counts are never reported as BPM/SpO2; BPM only from quality-checked beats.
 *  - SpO2 is uncalibrated: hidden unless config/hri.spo2.displayEnabled.
 *  - MLX90614 object temperature is reported as SURFACE temperature; no core estimate exists.
 *  - HRV only from accepted, consecutive intervals over an adequate window (see heart.ts).
 *  - State resets when the band's assignment changes (no data leaks between attendees).
 *  - Every quality problem is a data-quality flag that lowers HRI confidence.
 */
import type {
  AssignmentStats,
  ConfidenceLevel,
  DataQualityFlag,
  DeviceHealth,
  HistoryPoint,
  MetricQuality,
  RawChunk,
} from "../shared/schema";
import type { HriConfig } from "../shared/hriConfig";
import { num, validEpoch } from "../shared/telemetry";
import { computeHri } from "../hri/engine";
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import { beatAcceptance, computeHrv, currentBpm, lastIbiMs, registerBeats } from "./heart";
import { analyzeImu } from "./motion";
import { analyzePpg } from "./ppg";
import { roundOrNull, smooth, toNumberArray } from "./signal";
import { initialState, type ProcessorState } from "./state";

export const HR_METHOD = "ppg-peak-median-v1";

export interface AssignmentContext {
  assignmentId: string;
  eventId: string;
  participantId: string;
  demo: boolean;
}

export interface HriAlertDraft {
  idempotencyKey: string;
  deviceId: string;
  assignmentId: string;
  eventId: string;
  participantId: string;
  demo: boolean;
  measuredAt: number | null;
  score: number | null;
  status: "high";
  confidence: ConfidenceLevel;
  reasons: string[];
}

export interface ProcessInput {
  deviceId: string;
  chunk: RawChunk;
  hriConfig: HriConfig;
  /** Active assignment of the band at processing time (server-side lookup), or null. */
  assignment: AssignmentContext | null;
  /** latest.raw.droppedChunks, if known, to detect drops between chunks. */
  droppedChunks?: number | null;
  /** Server time "now" (ms). */
  nowMs: number;
}

export interface ProcessResult {
  state: ProcessorState;
  skipped?: "duplicate";
  health?: DeviceHealth;
  history?: HistoryPoint;
  stats?: AssignmentStats;
  hriAlert?: HriAlertDraft;
  pruneRaw?: boolean;
}

const CONF_RANK: Record<ConfidenceLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
const HR_QUALITY_BLOCKERS: DataQualityFlag[] = [
  "beat_detection_unstable",
  "low_perfusion",
  "motion_artifact_risk",
  "ppg_samples_low",
  "ppg_fifo_overflow",
  "ppg_saturation",
];

export function processChunk(previous: ProcessorState, input: ProcessInput, cfg: HealthConfig = HEALTH_CONFIG): ProcessResult {
  const { chunk, deviceId, hriConfig, assignment } = input;
  // The state is plain JSON (it round-trips through RTDB), so a JSON copy is a deep clone.
  let state: ProcessorState = JSON.parse(JSON.stringify(previous)) as ProcessorState;
  const assignmentId = assignment?.assignmentId ?? null;
  if (state.assignmentId !== assignmentId) state = initialState(assignmentId);

  const flags = new Set<DataQualityFlag>();

  // ---- ordering / continuity ----
  if (state.lastSeq !== null && state.lastT0UptimeMs !== null) {
    if (chunk.t0UptimeMs < state.lastT0UptimeMs) {
      breakContinuity(state); // band rebooted: keep baseline/timers, drop signal continuity
    } else if (chunk.seq <= state.lastSeq) {
      return { state: previous, skipped: "duplicate" };
    } else if (chunk.seq !== state.lastSeq + 1) {
      breakContinuity(state);
      flags.add("chunk_gap");
    }
  }
  state.lastSeq = chunk.seq;
  state.lastT0UptimeMs = chunk.t0UptimeMs;
  state.processed++;

  if (typeof input.droppedChunks === "number") {
    if (state.lastDroppedChunks !== null && input.droppedChunks > state.lastDroppedChunks) flags.add("dropped_chunks_increased");
    state.lastDroppedChunks = input.droppedChunks;
  }

  // ---- time: measurement vs receipt vs uptime ----
  const durationMs = num(chunk.durationMs, 1, 60_000) ?? 2000;
  const tEnd = chunk.t0UptimeMs + durationMs;
  const t0Epoch = validEpoch(chunk.t0, input.nowMs);
  const measuredAt = t0Epoch !== null ? t0Epoch + durationMs : null;
  const receivedAt = validEpoch(chunk.serverTs, input.nowMs);
  const clockSynced = measuredAt !== null;
  if (!clockSynced) flags.add("clock_not_synced");
  if (measuredAt !== null && receivedAt !== null && receivedAt - measuredAt > cfg.delayedChunkMs) flags.add("delayed_chunk");
  const endEpoch = measuredAt ?? receivedAt ?? input.nowMs;

  // ---- PPG ----
  const ppgFs = num(chunk.ppg?.fs, 1, 1000) ?? cfg.ppgFsHz;
  const red = toNumberArray(chunk.ppg?.red);
  const ir = toNumberArray(chunk.ppg?.ir);
  const ppgExpected = Math.round((durationMs / 1000) * ppgFs);
  const ppgOverflow = num(chunk.ppg?.overflow, 0) ?? 0;
  if (ir.length === 0) flags.add("sensor_missing_ppg");
  else if (ir.length < cfg.minSampleCompleteness * ppgExpected) flags.add("ppg_samples_low");
  if (ppgOverflow > 0) {
    flags.add("ppg_fifo_overflow");
    breakBeatContinuity(state); // samples missing inside the chunk: intervals across them are invalid
  }

  const ppg = analyzePpg(
    { tailRed: state.ppgTailRed, tailIr: state.ppgTailIr, red, ir, fs: ppgFs, t0UptimeMs: chunk.t0UptimeMs, lastBeatT: state.lastBeatT, lastIbiMs: lastIbiMs(state) },
    cfg,
  );
  const worn = ppg.contact;
  if (!worn && ir.length > 0) flags.add("not_worn");
  if (ppg.saturated) flags.add("ppg_saturation");

  let beatsThisChunk = 0;
  if (worn && state.prevContact && !ppg.saturated) {
    beatsThisChunk = registerBeats(state, ppg.beats, cfg).accepted;
  } else {
    breakBeatContinuity(state); // first chunk on skin, no contact, or saturated
  }
  state.prevContact = worn;
  const tailLength = Math.round(cfg.ppgTailSec * ppgFs);
  state.ppgTailRed = red.slice(-tailLength);
  state.ppgTailIr = ir.slice(-tailLength);

  const acceptance = beatAcceptance(state);
  if (worn && acceptance !== null && acceptance < cfg.minBeatAcceptance) flags.add("beat_detection_unstable");
  if (worn && ppg.perfusionIndex !== null && ppg.perfusionIndex < cfg.minPerfusionIndex) flags.add("low_perfusion");

  // ---- IMU / activity ----
  const imuFs = num(chunk.imu?.fs, 1, 1000) ?? cfg.imuFsHz;
  const imuExpected = Math.round((durationMs / 1000) * imuFs);
  const imuRaw = {
    fs: imuFs,
    ax: chunk.imu?.ax ?? [],
    ay: chunk.imu?.ay ?? [],
    az: chunk.imu?.az ?? [],
    gx: chunk.imu?.gx ?? [],
    gy: chunk.imu?.gy ?? [],
    gz: chunk.imu?.gz ?? [],
  };
  const imu = analyzeImu(state, imuRaw, chunk.t0UptimeMs, cfg);
  if (imu.samples === 0) flags.add("sensor_missing_imu");
  else if (imu.samples < cfg.minSampleCompleteness * imuExpected) flags.add("imu_samples_low");
  if (worn && (imu.level === "moderate" || imu.level === "vigorous")) flags.add("motion_artifact_risk");

  if (imu.level === "rest") state.stillSinceT ??= chunk.t0UptimeMs;
  else if (imu.level !== "unknown") state.stillSinceT = null;
  const stillSec = state.stillSinceT !== null ? Math.max(0, Math.round((tEnd - state.stillSinceT) / 1000)) : 0;

  if (imu.impactAtT !== null) state.impactAtT = imu.impactAtT;
  if (state.impactAtT !== null && imu.level !== "rest" && imu.level !== "unknown" && tEnd - state.impactAtT > cfg.impactHoldMs) {
    state.impactAtT = null; // moving again well after the impact
  }
  const impactThenStillSec =
    state.impactAtT !== null && state.stillSinceT !== null && state.stillSinceT <= state.impactAtT + 3000
      ? Math.max(0, Math.round((tEnd - Math.max(state.stillSinceT, state.impactAtT)) / 1000))
      : null;

  // ---- heart rate (quality graded) ----
  const bpm = worn ? currentBpm(state, tEnd, cfg) : null;
  const hrQuality: MetricQuality = bpm === null ? "unavailable" : HR_QUALITY_BLOCKERS.some((f) => flags.has(f)) ? "low_quality" : "valid";
  const riseWindowMs = (hriConfig.rules.hrRiseAtLowActivity.param ?? 90) * 1000;
  if (hrQuality === "valid" && bpm !== null) state.bpmWindow.push({ t: tEnd, v: bpm });
  state.bpmWindow = state.bpmWindow.filter((p) => tEnd - p.t <= riseWindowMs);
  const riseInWindow =
    hrQuality === "valid" && bpm !== null && state.bpmWindow.length >= 5 ? bpm - Math.min(...state.bpmWindow.map((p) => p.v)) : null;

  // ---- SpO2 (experimental, uncalibrated) ----
  if (!worn) state.spo2 = null;
  else if (hrQuality === "valid" && ppg.spo2Raw !== null) state.spo2 = smooth(state.spo2, ppg.spo2Raw, cfg.spo2Smoothing);
  const spo2Threshold = hriConfig.rules.lowSpo2.threshold;
  state.spo2BelowSinceT = state.spo2 !== null && state.spo2 < spo2Threshold ? (state.spo2BelowSinceT ?? tEnd) : null;
  const spo2ForHriQuality: MetricQuality = hriConfig.spo2.useInHri && hrQuality === "valid" && state.spo2 !== null ? "valid" : "unavailable";

  // ---- HRV (guarded) ----
  const hrv = worn ? computeHrv(state.ibis, tEnd, cfg) : { rmssdMs: null, sdnnMs: null, count: 0, pairs: 0, spanMs: 0 };
  const hrvQuality: MetricQuality =
    hrv.rmssdMs === null ? "unavailable" : flags.has("motion_artifact_risk") || flags.has("beat_detection_unstable") ? "low_quality" : "valid";

  // ---- temperature (surface/object, NOT core) ----
  const objectC = num(chunk.temperature?.objectC, -20, 80);
  const ambientC = num(chunk.temperature?.ambientC, -40, 85);
  if (chunk.temperature?.objectC === undefined || chunk.temperature?.objectC === null) flags.add("sensor_missing_temperature");
  if (objectC !== null) state.surfaceC = smooth(state.surfaceC, objectC, cfg.tempSmoothing);

  // ---- personal baseline (quality-controlled, low activity only) ----
  const qualifies =
    !state.baselineReady && worn && (imu.level === "rest" || imu.level === "light") && hrQuality === "valid" && bpm !== null;
  if (qualifies && bpm !== null) {
    state.baselineQualifiedSec += durationMs / 1000;
    state.baselineBpmSum += bpm;
    state.baselineBpmN++;
    if (hrvQuality === "valid" && hrv.rmssdMs !== null) {
      state.baselineRmssdSum += hrv.rmssdMs;
      state.baselineRmssdN++;
    }
    if (state.surfaceC !== null) {
      state.baselineSurfaceSum += state.surfaceC;
      state.baselineSurfaceN++;
    }
    if (state.baselineQualifiedSec >= hriConfig.baseline.minQualifiedSeconds && state.baselineBpmN >= 10) state.baselineReady = true;
  }
  const baseline = {
    available: state.baselineReady,
    restingBpm: state.baselineReady && state.baselineBpmN ? state.baselineBpmSum / state.baselineBpmN : null,
    rmssdMs: state.baselineReady && state.baselineRmssdN >= 5 ? state.baselineRmssdSum / state.baselineRmssdN : null,
    surfaceC: state.baselineReady && state.baselineSurfaceN ? state.baselineSurfaceSum / state.baselineSurfaceN : null,
  };

  // ---- HRI ----
  const flagList = [...flags];
  const hri = computeHri(
    {
      nowMs: input.nowMs,
      window: { fromMs: endEpoch - cfg.hrvWindowMs, toMs: endEpoch, seconds: cfg.hrvWindowMs / 1000 },
      worn,
      heartRate: { bpm, quality: hrQuality, riseInWindow },
      hrv: { rmssdMs: hrv.rmssdMs, quality: hrvQuality },
      spo2: {
        value: state.spo2,
        quality: spo2ForHriQuality,
        belowThresholdSec: state.spo2BelowSinceT !== null ? Math.round((tEnd - state.spo2BelowSinceT) / 1000) : 0,
      },
      temperature: { surfaceC: worn ? state.surfaceC : null, ambientC, surfaceBaselineC: baseline.surfaceC },
      activity: { level: imu.level, available: imu.samples > 0, stillSec, impactThenStillSec },
      baseline: { available: baseline.available, restingBpm: baseline.restingBpm, rmssdMs: baseline.rmssdMs },
      flags: flagList,
    },
    hriConfig,
  );

  // ---- outputs ----
  const health: DeviceHealth = {
    deviceId,
    assignmentId,
    eventId: assignment?.eventId ?? null,
    participantId: assignment?.participantId ?? null,
    seq: chunk.seq,
    measuredAt,
    receivedAt,
    computedAt: input.nowMs,
    worn,
    heartRate: { bpm: hrQuality === "unavailable" ? null : roundOrNull(bpm), quality: hrQuality, beats: beatsThisChunk, method: HR_METHOD },
    spo2: {
      value: hriConfig.spo2.displayEnabled ? roundOrNull(state.spo2) : null,
      quality: hriConfig.spo2.displayEnabled && state.spo2 !== null ? "low_quality" : "unavailable",
      validated: false,
      displayEnabled: hriConfig.spo2.displayEnabled,
      note: "SpO2 uses an uncalibrated ratio-of-ratios estimate and is not validated against a reference oximeter.",
    },
    hrv: {
      rmssdMs: roundOrNull(hrv.rmssdMs, 1),
      sdnnMs: roundOrNull(hrv.sdnnMs, 1),
      ibiCount: hrv.count,
      windowSec: cfg.hrvWindowMs / 1000,
      quality: hrvQuality,
    },
    temperature: { surfaceC: roundOrNull(state.surfaceC, 2), ambientC: roundOrNull(ambientC, 2), surfaceBaselineC: roundOrNull(baseline.surfaceC, 2) },
    activity: { level: imu.level, magG: roundOrNull(imu.magG, 3), stillSec, impactDetected: state.impactAtT !== null },
    signal: {
      perfusionIndex: roundOrNull(ppg.perfusionIndex, 2),
      ppgSamples: ir.length,
      ppgExpected,
      imuSamples: imu.samples,
      imuExpected,
      ppgOverflow,
      flags: flagList,
      clockSynced,
    },
    hri,
    latency: {
      processingMs: receivedAt !== null ? Math.max(0, input.nowMs - receivedAt) : null,
      endToEndMs: measuredAt !== null ? Math.max(0, input.nowMs - measuredAt) : null,
    },
  };

  const result: ProcessResult = { state, health };

  if (assignment) {
    // running stats
    const s = state.stats;
    s.chunks++;
    if (worn) s.wornChunks++;
    if (hrQuality === "valid") s.validHrChunks++;
    if (hri.hriScore !== null) s.hriScoredChunks++;
    s.hriStatusCounts[hri.status]++;
    s.confidenceCounts[hri.confidence.level]++;
    for (const f of flagList) s.flagCounts[f] = (s.flagCounts[f] ?? 0) + 1;
    s.firstAt ??= endEpoch;
    s.lastAt = endEpoch;

    // automated HRI alert: sustained "high" with enough confidence, cooldown + idempotency key
    const alertCfg = hriConfig.alerts;
    const strongEnough = hri.status === "high" && CONF_RANK[hri.confidence.level] >= CONF_RANK[alertCfg.minConfidence];
    state.hriHighStreak = strongEnough ? state.hriHighStreak + 1 : 0;
    const cooledDown = state.lastHriAlertEpoch === null || endEpoch - state.lastHriAlertEpoch >= alertCfg.cooldownSec * 1000;
    if (alertCfg.enabled && state.hriHighStreak >= alertCfg.consecutiveChunks && cooledDown) {
      state.lastHriAlertEpoch = endEpoch;
      s.hriAlerts++;
      result.hriAlert = {
        idempotencyKey: `hri-${assignment.assignmentId}-${Math.floor(endEpoch / (alertCfg.cooldownSec * 1000))}`,
        deviceId,
        assignmentId: assignment.assignmentId,
        eventId: assignment.eventId,
        participantId: assignment.participantId,
        demo: assignment.demo,
        measuredAt,
        score: hri.hriScore,
        status: "high",
        confidence: hri.confidence.level,
        reasons: hri.contributingFactors.map((f) => f.detail),
      };
    }

    if (state.lastHistoryT === null || tEnd - state.lastHistoryT >= cfg.historyIntervalMs) {
      state.lastHistoryT = tEnd;
      result.history = {
        ts: endEpoch,
        deviceId,
        eventId: assignment.eventId,
        worn,
        bpm: health.heartRate.bpm ?? null,
        bpmQuality: hrQuality,
        rmssdMs: health.hrv.rmssdMs ?? null,
        surfaceC: health.temperature.surfaceC ?? null,
        ambientC: health.temperature.ambientC ?? null,
        activity: imu.level,
        hriScore: hri.hriScore,
        hriStatus: hri.status,
        confidence: hri.confidence.level,
        flagCount: flagList.length,
      };
      result.stats = { assignmentId: assignment.assignmentId, eventId: assignment.eventId, ...s };
    }
  }

  if (state.processed % cfg.rawPruneEvery === 0) result.pruneRaw = true;
  return result;
}

/** Lost chunk / reboot: the signals before and after cannot be joined. */
function breakContinuity(state: ProcessorState) {
  state.ppgTailRed = [];
  state.ppgTailIr = [];
  state.freefallRunMs = 0;
  breakBeatContinuity(state);
}

/** The next beat must not form an interval with the last one. */
function breakBeatContinuity(state: ProcessorState) {
  state.lastBeatT = null;
  state.lastIbiAccepted = false;
}
