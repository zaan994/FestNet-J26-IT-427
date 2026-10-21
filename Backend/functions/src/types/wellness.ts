// Heat stress severity tiers (WBGT-inspired 4-level system)
export type HeatStressLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

// A single heat stress reading computed from BPM + body temperature
export interface HeatStressReading {
  id: string;
  deviceId: string;
  attendeeId?: string;
  bpm: number;
  bodyTemperature: number; // Celsius
  wbgtIndex: number;       // WBGT-inspired composite index value
  level: HeatStressLevel;
  timestamp: string;       // ISO 8601
}

// A single hydration log entry (manual or auto-triggered)
export interface HydrationLog {
  id: string;
  deviceId: string;
  attendeeId?: string;
  amountMl: number;        // millilitres consumed
  timestamp: string;       // ISO 8601
  note?: string;           // optional tag (e.g. "after reminder", "manual")
}

// Dynamic reminder state per device
export interface HydrationReminder {
  deviceId: string;
  nextReminderAt: string;   // ISO 8601 — when next reminder fires
  intervalMinutes: number;  // current dynamically-computed interval (10–30 min)
  bpmGradient: number;      // last computed BPM trend gradient (bpm/min)
  lastUpdated: string;      // ISO 8601
}

// Hourly aggregated wellness snapshot for dashboard charting
export interface HourlyWellnessSnapshot {
  deviceId: string;
  hour: string;            // ISO 8601 hour truncated (e.g. "2026-10-21T14:00:00.000Z")
  avgBpm: number;
  peakBpm: number;
  avgSpO2: number;
  avgHeatStressIndex: number;
  dominantLevel: HeatStressLevel;
  hydrationMl: number;     // total ml logged in this hour
}

// Full wellness dashboard data
export interface WellnessDashboard {
  deviceId: string;
  generatedAt: string;
  hourlySnapshots: HourlyWellnessSnapshot[];
  hydrationComplianceScore: number;   // 0–100 percentage
  totalHydrationMl: number;
  dailyTargetMl: number;
  currentHeatStressLevel: HeatStressLevel;
  currentWbgtIndex: number;
  latestBpm: number;
  latestSpO2: number;
  reminderState: HydrationReminder | null;
}

// Post-event wellness report
export interface BpmPeak {
  timestamp: string;
  bpm: number;
  heatStressLevel: HeatStressLevel;
}

export interface HeatStressPeriod {
  startTime: string;
  endTime: string;
  level: HeatStressLevel;
  peakWbgt: number;
}

export interface WellnessReport {
  deviceId: string;
  attendeeId?: string;
  eventStart: string;
  eventEnd: string;
  generatedAt: string;
  bpmPeaks: BpmPeak[];
  heatStressPeriods: HeatStressPeriod[];
  hydrationScore: number;          // 0–100
  totalHydrationMl: number;
  hydrationLogs: HydrationLog[];
  alertHistory: string[];          // free-text alert messages
  averageBpm: number;
  averageSpO2: number;
  maxHeatStressLevel: HeatStressLevel;
}
