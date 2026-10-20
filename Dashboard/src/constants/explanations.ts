/** Plain-language labels and tooltip texts used across the dashboard. */
import type { ActivityLevel, ConfidenceLevel, DataQualityFlag, HriInput, HriStatus, MetricQuality } from "@/types";
import type { Freshness } from "@shared/telemetry";

export const TIPS = {
  hri:
    "HRI (Health Risk Indicator) is an EXPERIMENTAL, unvalidated research score (0–100) built from transparent rules. " +
    "It is not a diagnosis and must never replace assessment by medical staff. A missing score means not enough valid data — not low risk.",
  confidence:
    "Confidence reflects DATA QUALITY (skin contact, sample counts, motion, FIFO overflow, dropped chunks, clock sync, baseline). " +
    "It is separate from the risk score: a low-confidence score should not be trusted.",
  freshness:
    "Freshness is based on when this dashboard last RECEIVED new telemetry from the band, not on the band's online flag.",
  surfaceTemp:
    "MLX90614 object temperature measured at the band: a SURFACE/skin reading influenced by sun, sweat and fit. It is NOT core body temperature.",
  ambientTemp: "MLX90614 ambient (sensor body) temperature near the band.",
  rawPpg: "Raw MAX30102 red/IR ADC counts. These are NOT a heart rate or SpO2 — they only show that the optical sensor produces a signal.",
  bpm: "Derived by the backend from quality-checked pulse peaks. Shown only when its quality is 'valid'; it is a prototype measurement, not medical-grade.",
  spo2: "SpO2 uses an uncalibrated estimate that has not been validated against a reference pulse oximeter, so it is not shown.",
  hrv: "RMSSD from accepted, consecutive beat intervals over the last 60 s (needs ≥10 intervals spanning ≥30 s).",
  dataQuality: "Problems detected in the latest 2-second signal chunk. Each one lowers HRI confidence.",
  sensorDetected: "'Detected' means the sensor answered at boot. It does not mean its current measurement is valid.",
  gps: "A location is shown only with a current GPS fix. Old positions are marked stale and must not be treated as the current location.",
  battery: "The prototype band has no battery gauge, so battery level is unavailable.",
  live: "Live: updates in real time from the database.",
  historical: "Historical: counted from stored records.",
} as const;

export const HRI_STATUS_LABELS: Record<HriStatus, string> = {
  insufficient_data: "Insufficient data",
  low: "Low",
  elevated: "Elevated",
  high: "High",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = { none: "None", low: "Low", medium: "Medium", high: "High" };

export const QUALITY_LABELS: Record<MetricQuality, string> = { valid: "Valid", low_quality: "Low quality", unavailable: "Unavailable" };

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = { unknown: "Unknown", rest: "Rest", light: "Light", moderate: "Moderate", vigorous: "Vigorous" };

export const FRESHNESS_LABELS: Record<Freshness, string> = { live: "Live", stale: "Stale", offline: "Offline", unknown: "No recent data" };

export const INPUT_LABELS: Record<HriInput, string> = {
  heart_rate: "Heart rate",
  hrv: "HRV",
  spo2: "SpO2",
  surface_temperature: "Surface temperature",
  ambient_temperature: "Ambient temperature",
  activity: "Activity (motion)",
  personal_baseline: "Personal baseline",
};

export const FLAG_LABELS: Record<DataQualityFlag, { label: string; detail: string }> = {
  not_worn: { label: "Not worn", detail: "No skin contact on the optical sensor." },
  sensor_missing_ppg: { label: "No PPG data", detail: "The chunk contained no optical samples." },
  sensor_missing_imu: { label: "No motion data", detail: "The chunk contained no accelerometer samples — exertion cannot be separated from risk." },
  sensor_missing_temperature: { label: "No temperature", detail: "No valid MLX90614 reading in the chunk." },
  ppg_samples_low: { label: "Too few PPG samples", detail: "Fewer than 90 % of the expected 100 Hz samples arrived." },
  imu_samples_low: { label: "Too few IMU samples", detail: "Fewer than 90 % of the expected 50 Hz samples arrived." },
  ppg_fifo_overflow: { label: "PPG FIFO overflow", detail: "Samples were lost inside the MAX30102 buffer; intervals across the gap are discarded." },
  chunk_gap: { label: "Missing chunk", detail: "A raw chunk sequence number was skipped." },
  dropped_chunks_increased: { label: "Chunks dropped", detail: "The band dropped buffered chunks (offline too long)." },
  low_perfusion: { label: "Weak pulse signal", detail: "Perfusion index is low (loose band, cold skin, poor placement)." },
  beat_detection_unstable: { label: "Unstable beats", detail: "Many beat intervals were rejected as artefacts." },
  motion_artifact_risk: { label: "Motion artefacts", detail: "Moderate/vigorous movement makes optical readings unreliable." },
  clock_not_synced: { label: "Clock not synced", detail: "The band has no NTP time; measurement times are approximate (server receipt time used)." },
  delayed_chunk: { label: "Delayed upload", detail: "The chunk reached the server more than 10 s after it was measured." },
  ppg_saturation: { label: "Sensor saturated", detail: "Optical counts at full scale (pressure or ambient light) — no beats extracted." },
};
