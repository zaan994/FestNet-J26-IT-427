import type { AnomalyType, MotionState, StressLevel } from "@/types";

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  bpm_spike: "Heart-rate spike",
  low_spo2: "Low SpO2",
  high_temp: "High body temperature",
  stillness: "No movement",
  fall: "Fall detected",
  sos: "SOS pressed",
};

export const MOTION_LABELS: Record<MotionState, string> = {
  unknown: "Unknown",
  active: "Moving",
  still: "Still",
  fall: "Fall",
};

export const STRESS_LABELS: Record<StressLevel, string> = {
  unknown: "—",
  low: "Low",
  medium: "Medium",
  high: "High",
};
