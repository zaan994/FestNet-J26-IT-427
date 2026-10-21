import { AttendeeWellnessState, HydrationLogEntry, HeatStressLevel } from '../types';

// ─── Pure wellness calculation functions (mirrors the backend) ─────────────────

export function calculateWBGT(bpm: number, bodyTemperature: number): number {
  const wetBulbProxy = bodyTemperature;
  const cardioLoadFactor = (bpm / 5) * 0.1;
  const baselineOffset = 3.94;
  const wbgt = 0.7 * wetBulbProxy + cardioLoadFactor + baselineOffset;
  return Math.round(wbgt * 10) / 10;
}

export function classifyHeatStress(wbgtIndex: number): HeatStressLevel {
  if (wbgtIndex < 26) return 'Low';
  if (wbgtIndex < 32) return 'Moderate';
  if (wbgtIndex < 38) return 'High';
  return 'Critical';
}

export function calculateBpmGradient(recentBpms: number[]): number {
  const n = recentBpms.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += recentBpms[i]; sumXY += i * recentBpms[i]; sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return Math.round(((n * sumXY - sumX * sumY) / denom) * 100) / 100;
}

export function computeReminderInterval(gradient: number): number {
  if (gradient <= 0) return 30;
  if (gradient <= 2) return 25;
  if (gradient <= 5) return 20;
  if (gradient <= 10) return 15;
  return 10;
}

export function computeHydrationScore(totalMl: number, targetMl: number = 2500): number {
  return Math.min(100, Math.round((totalMl / targetMl) * 100));
}

export function getHeatStressConfig(level: HeatStressLevel): {
  hex: string; bg: string; border: string; textColor: string; label: string; emoji: string;
} {
  switch (level) {
    case 'Low':      return { hex: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', textColor: '#34d399', label: 'LOW', emoji: '✅' };
    case 'Moderate': return { hex: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', textColor: '#fbbf24', label: 'MODERATE', emoji: '⚠️' };
    case 'High':     return { hex: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', textColor: '#fb923c', label: 'HIGH', emoji: '🔴' };
    case 'Critical': return { hex: '#ef4444', bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.4)', textColor: '#f87171', label: 'CRITICAL', emoji: '🚨' };
  }
}

// ─── Generate mock attendee wellness states ────────────────────────────────────

function makeHistory(base: number, n: number, trend: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.max(50, Math.min(200, Math.round(base + i * trend + (Math.random() * 6 - 3)))));
}

function isoMinsAgo(mins: number): string {
  return new Date(Date.now() - mins * 60000).toISOString();
}

function isoMinsAhead(mins: number): string {
  return new Date(Date.now() + mins * 60000).toISOString();
}

export function generateInitialWellnessStates(): AttendeeWellnessState[] {
  const base: Omit<AttendeeWellnessState, 'wbgtIndex' | 'heatStressLevel' | 'reminderInterval' | 'nextReminderAt' | 'bpmHistory'>[] = [
    { deviceId: 'DEV-8821', attendeeId: 'ATT-1029', name: 'Kasun Perera',     zone: 'EDM Tent (Bravo)',               bpm: 144, bodyTemperature: 38.9, spO2: 91, hydrationMl: 300,  lastReminder: isoMinsAgo(35), battery: 64 },
    { deviceId: 'DEV-4412', attendeeId: 'ATT-2041', name: 'Nadeesha Silva',   zone: 'EDM Tent (Bravo)',               bpm: 119, bodyTemperature: 38.1, spO2: 95, hydrationMl: 750,  lastReminder: isoMinsAgo(18), battery: 82 },
    { deviceId: 'DEV-9102', attendeeId: 'ATT-3088', name: 'Liam Chen',        zone: 'Main Stage (Alpha)',             bpm: 78,  bodyTemperature: 36.8, spO2: 99, hydrationMl: 1600, lastReminder: isoMinsAgo(22), battery: 91 },
    { deviceId: 'DEV-1123', attendeeId: 'ATT-4192', name: 'Anika Fernando',   zone: 'Food & Beverage Haven',         bpm: 72,  bodyTemperature: 37.0, spO2: 98, hydrationMl: 2100, lastReminder: isoMinsAgo(10), battery: 75 },
    { deviceId: 'DEV-3389', attendeeId: 'ATT-5501', name: 'Marcus Brody',     zone: 'Main Stage (Alpha)',             bpm: 137, bodyTemperature: 38.6, spO2: 93, hydrationMl: 450,  lastReminder: isoMinsAgo(42), battery: 48 },
    { deviceId: 'DEV-7741', attendeeId: 'ATT-6211', name: 'Elena Rostova',    zone: 'Chillout Lawn & First Aid Hub', bpm: 84,  bodyTemperature: 36.6, spO2: 99, hydrationMl: 1850, lastReminder: isoMinsAgo(5),  battery: 89 },
    { deviceId: 'DEV-2290', attendeeId: 'ATT-7340', name: 'Priya Nair',       zone: 'EDM Tent (Bravo)',               bpm: 158, bodyTemperature: 39.2, spO2: 89, hydrationMl: 150,  lastReminder: isoMinsAgo(55), battery: 31 },
    { deviceId: 'DEV-5501', attendeeId: 'ATT-8801', name: 'James Wilkins',    zone: 'East Camping Ground',           bpm: 68,  bodyTemperature: 36.4, spO2: 98, hydrationMl: 2300, lastReminder: isoMinsAgo(8),  battery: 77 },
  ];

  return base.map(a => {
    const trend = a.bpm > 120 ? 1.5 : a.bpm > 90 ? 0.5 : -0.2;
    const bpmHistory = makeHistory(a.bpm - 10, 10, trend);
    const gradient = calculateBpmGradient(bpmHistory);
    const interval = computeReminderInterval(gradient);
    const wbgt = calculateWBGT(a.bpm, a.bodyTemperature);
    const level = classifyHeatStress(wbgt);
    return {
      ...a,
      bpmHistory,
      wbgtIndex: wbgt,
      heatStressLevel: level,
      reminderInterval: interval,
      nextReminderAt: isoMinsAhead(interval),
    };
  });
}

// ─── Generate mock hydration logs ─────────────────────────────────────────────

export function generateHydrationLogs(deviceId: string): HydrationLogEntry[] {
  const entries: HydrationLogEntry[] = [
    { id: `HYD-${deviceId}-1`, deviceId, amountMl: 250, timestamp: isoMinsAgo(180), note: 'Morning entry' },
    { id: `HYD-${deviceId}-2`, deviceId, amountMl: 150, timestamp: isoMinsAgo(120), note: 'After reminder' },
    { id: `HYD-${deviceId}-3`, deviceId, amountMl: 500, timestamp: isoMinsAgo(60),  note: 'Water station' },
    { id: `HYD-${deviceId}-4`, deviceId, amountMl: 350, timestamp: isoMinsAgo(20),  note: 'After reminder' },
  ];
  return entries;
}

// ─── Generate hourly snapshots for dashboard charts ───────────────────────────

export interface HourlyChartPoint {
  hour: string;         // "13:00"
  avgBpm: number;
  peakBpm: number;
  avgSpO2: number;
  avgWbgt: number;
  hydrationMl: number;
  level: HeatStressLevel;
}

export function generateHourlyChartData(): HourlyChartPoint[] {
  const hours = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  const bpmBase =    [75, 82, 90, 105, 118, 130, 142, 128];
  const spO2Base =   [99, 98, 97, 96,  95,  93,  91,  94 ];
  const wbgtBase =   [25, 27, 29, 31,  34,  37,  40,  38 ];
  const hydration =  [400, 350, 300, 250, 200, 150, 100, 200];

  return hours.map((h, i) => ({
    hour: h,
    avgBpm: bpmBase[i] + Math.round(Math.random() * 5 - 2),
    peakBpm: bpmBase[i] + 20 + Math.round(Math.random() * 10),
    avgSpO2: spO2Base[i],
    avgWbgt: wbgtBase[i] + Math.round(Math.random() * 2 - 1) / 10,
    hydrationMl: hydration[i],
    level: classifyHeatStress(wbgtBase[i]),
  }));
}
