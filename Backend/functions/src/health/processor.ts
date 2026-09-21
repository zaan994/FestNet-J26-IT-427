/**
 * C1 health processor — turns one raw chunk into computed health data.
 *
 * Pure function of (previous state, chunk, thresholds): no Firebase access, so the same
 * code runs in the Cloud Function (triggers/health.ts) and the local processor script
 * (Backend/scripts: npm run process), and can be unit-tested with synthetic signals.
 */
import { SEVERITY_ORDER, type AnomalyType, type DeviceHealth, type HistoryPoint, type MotionState, type RawChunk, type Severity, type Thresholds } from "../shared";
import { evaluateAnomalies } from "./anomaly";
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import { computeHrv, currentBpm, lastIbiMs, registerBeats, updateStress } from "./heart";
import { analyzeImu } from "./motion";
import { analyzePpg } from "./ppg";
import { roundOrNull, smooth, toNumberArray } from "./signal";
import { initialState, type ProcessorState } from "./state";

/** Alert payload created on anomaly onset / escalation (location is added by the store). */
export interface AnomalyAlertDraft {
  deviceId: string;
  source: "anomaly";
  types: AnomalyType[];
  severity: Severity;
  status: "open";
  createdAt: number;
  vitals: { bpm: number | null; spo2: number | null; coreEstC: number | null; stressScore: number | null };
}

export interface ProcessResult {
  state: ProcessorState;
  /** Set when the chunk was ignored (duplicate / out of order). Nothing else is set then. */
  skipped?: "duplicate";
  health?: DeviceHealth;
  history?: HistoryPoint;
  alert?: AnomalyAlertDraft;
  /** True when old raw chunks should be pruned now. */
  pruneRaw?: boolean;
}

export interface ProcessInput {
  deviceId: string;
  chunk: RawChunk;
  thresholds: Thresholds;
  /** Server time "now" (ms) — used for latency metrics. */
  nowMs: number;
}

export function processChunk(previous: ProcessorState, input: ProcessInput, cfg: HealthConfig = HEALTH_CONFIG): ProcessResult {
  const { chunk, thresholds, deviceId } = input;
  // The state is plain JSON (it round-trips through RTDB), so a JSON copy is a deep clone.
  let state: ProcessorState = JSON.parse(JSON.stringify(previous)) as ProcessorState;

  // ---- ordering / continuity ----
  if (state.lastSeq !== null && state.lastT0UptimeMs !== null) {
    if (chunk.t0UptimeMs < state.lastT0UptimeMs) {
      state = initialState(); // band rebooted (uptime went backwards)
    } else if (chunk.seq <= state.lastSeq) {
      return { state: previous, skipped: "duplicate" };
    } else if (chunk.seq !== state.lastSeq + 1) {
      breakContinuity(state); // chunk(s) lost
    }
  }
  state.lastSeq = chunk.seq;
  state.lastT0UptimeMs = chunk.t0UptimeMs;
  state.processed++;

  const tEnd = chunk.t0UptimeMs + chunk.durationMs;
  const endEpoch = chunk.t0 ? chunk.t0 + chunk.durationMs : (chunk.serverTs ?? input.nowMs);

  // ---- PPG: contact, beats, BPM, SpO2 ----
  const red = toNumberArray(chunk.ppg?.red);
  const ir = toNumberArray(chunk.ppg?.ir);
  const ppgOverflow = chunk.ppg?.overflow ?? 0;
  if (ppgOverflow > 0) breakBeatContinuity(state); // samples missing inside the chunk

  const ppg = analyzePpg(
    {
      tailRed: state.ppgTailRed,
      tailIr: state.ppgTailIr,
      red,
      ir,
      fs: chunk.ppg?.fs ?? 100,
      t0UptimeMs: chunk.t0UptimeMs,
      lastBeatT: state.lastBeatT,
      lastIbiMs: lastIbiMs(state),
    },
    cfg,
  );

  const worn = ppg.contact;
  if (worn && state.prevContact) {
    registerBeats(state, ppg.beats, cfg);
  } else {
    // First chunk on skin (filters settling) or no contact: no beats this time.
    breakBeatContinuity(state);
  }
  state.prevContact = worn;
  const tailLength = Math.round(cfg.ppgTailSec * (chunk.ppg?.fs ?? 100));
  state.ppgTailRed = red.slice(-tailLength);
  state.ppgTailIr = ir.slice(-tailLength);

  const bpm = worn ? currentBpm(state, tEnd, cfg) : null;
  if (bpm !== null) state.bpmWindow.push({ t: tEnd, v: bpm });
  state.bpmWindow = state.bpmWindow.filter((p) => tEnd - p.t <= thresholds.bpmSpikeWindowSec * 1000);

  if (!worn) {
    state.spo2 = null;
  } else if (bpm !== null && ppg.spo2Raw !== null) {
    state.spo2 = smooth(state.spo2, ppg.spo2Raw, cfg.spo2Smoothing);
  }
  const spo2 = worn ? state.spo2 : null;

  // ---- HRV / stress ----
  const hrv = worn ? computeHrv(state.ibis, tEnd, cfg) : { rmssdMs: null, sdnnMs: null, count: 0 };
  const stress = worn
    ? updateStress(state, hrv.rmssdMs, bpm, tEnd, cfg)
    : { score: null, level: "unknown" as const, baselineReady: state.baselineRmssd !== null };

  // ---- temperature ----
  const skinRaw = chunk.temperature?.objectC;
  if (typeof skinRaw === "number" && Number.isFinite(skinRaw)) {
    state.skinC = smooth(state.skinC, skinRaw, cfg.tempSmoothing);
  }
  // Off the wrist the MLX90614 sees air, so a core estimate only makes sense while worn.
  const coreEstC = worn && state.skinC !== null ? state.skinC + thresholds.skinToCoreOffsetC : null;

  // ---- motion ----
  const imu = analyzeImu(
    state,
    {
      fs: chunk.imu?.fs ?? 50,
      ax: toNumberArray(chunk.imu?.ax),
      ay: toNumberArray(chunk.imu?.ay),
      az: toNumberArray(chunk.imu?.az),
      gx: toNumberArray(chunk.imu?.gx),
      gy: toNumberArray(chunk.imu?.gy),
      gz: toNumberArray(chunk.imu?.gz),
    },
    chunk.t0UptimeMs,
    cfg,
  );
  if (imu.fallAtT !== null && !state.fallActive) {
    state.fallActive = true;
    state.fallAtT = imu.fallAtT;
  }
  if (imu.still === true) {
    state.stillSinceT ??= chunk.t0UptimeMs;
  } else if (imu.still === false) {
    state.stillSinceT = null;
  }
  const stillSec = state.stillSinceT !== null ? Math.round((tEnd - state.stillSinceT) / 1000) : 0;
  if (state.fallActive && imu.still === false && state.fallAtT !== null && tEnd - state.fallAtT >= cfg.fallHoldMs) {
    state.fallActive = false; // moving again after the hold time
    state.fallAtT = null;
  }
  const motionState: MotionState =
    imu.magG === null ? "unknown" : state.fallActive ? "fall" : stillSec >= cfg.stillStateAfterSec ? "still" : "active";

  // ---- anomalies ----
  if (worn) state.wornLastT = tEnd;
  const recentlyWorn = state.wornLastT !== null && tEnd - state.wornLastT <= cfg.wornGraceMs;
  const previousSeverity = state.severity;
  const anomaly = evaluateAnomalies(
    state,
    { t: tEnd, worn, recentlyWorn, bpm, spo2, coreTempC: coreEstC, stillSec, fallActive: state.fallActive },
    thresholds,
    cfg,
  );
  state.severity = anomaly.severity;
  if (anomaly.severity === "none") {
    state.anomalySinceEpoch = null;
  } else if (previousSeverity === "none") {
    state.anomalySinceEpoch = endEpoch;
  }

  // ---- outputs ----
  const vitals = {
    bpm: roundOrNull(bpm),
    spo2: roundOrNull(spo2),
    coreEstC: roundOrNull(coreEstC, 2),
    stressScore: roundOrNull(stress.score),
  };

  const health: DeviceHealth = {
    deviceId,
    seq: chunk.seq,
    ts: endEpoch,
    worn,
    signal: {
      perfusionIndex: roundOrNull(ppg.perfusionIndex, 2),
      beatsInChunk: worn ? ppg.beats.length : 0,
      ppgSamples: ir.length,
      ppgOverflow,
    },
    vitals: {
      bpm: vitals.bpm,
      spo2: vitals.spo2,
      hrv: { rmssdMs: roundOrNull(hrv.rmssdMs, 1), sdnnMs: roundOrNull(hrv.sdnnMs, 1), ibiCount: hrv.count },
      stress: { score: vitals.stressScore, level: stress.level, baselineReady: stress.baselineReady },
    },
    temperature: {
      skinC: roundOrNull(state.skinC, 2),
      ambientC: roundOrNull(chunk.temperature?.ambientC ?? null, 2),
      coreEstC: vitals.coreEstC,
    },
    motion: { magG: roundOrNull(imu.magG, 3), state: motionState, stillSec },
    anomaly: {
      active: anomaly.severity !== "none",
      severity: anomaly.severity,
      types: anomaly.types,
      since: state.anomalySinceEpoch,
    },
    latency: {
      processingMs: chunk.serverTs ? Math.max(0, input.nowMs - chunk.serverTs) : null,
      endToEndMs: chunk.t0 ? Math.max(0, input.nowMs - endEpoch) : null,
    },
  };

  const result: ProcessResult = { state, health };

  if (state.lastHistoryT === null || tEnd - state.lastHistoryT >= cfg.historyIntervalMs) {
    state.lastHistoryT = tEnd;
    result.history = {
      ts: endEpoch,
      bpm: vitals.bpm,
      spo2: vitals.spo2,
      rmssdMs: health.vitals.hrv.rmssdMs,
      stressScore: vitals.stressScore,
      skinC: health.temperature.skinC,
      coreEstC: vitals.coreEstC,
      motionState,
      severity: anomaly.severity,
      worn,
    };
  }

  if (SEVERITY_ORDER[anomaly.severity] > SEVERITY_ORDER[previousSeverity]) {
    result.alert = {
      deviceId,
      source: "anomaly",
      types: anomaly.types,
      severity: anomaly.severity,
      status: "open",
      createdAt: endEpoch,
      vitals,
    };
  }

  if (state.processed % cfg.rawPruneEvery === 0) result.pruneRaw = true;
  return result;
}

/** Lost chunk: the signals before and after cannot be joined. */
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
