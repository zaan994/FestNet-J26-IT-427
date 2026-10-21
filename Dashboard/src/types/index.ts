export interface VitalReading {
  attendeeId: string;
  name: string;
  bandId: string;
  heartRate: number; // bpm
  spo2: number; // percentage
  temperature: number; // Celsius
  status: 'normal' | 'warning' | 'critical';
  zone: string;
  battery: number;
  lastUpdated: string;
}

export interface ZoneData {
  id: string;
  name: string;
  currentCount: number;
  capacity: number;
  density: 'low' | 'moderate' | 'high' | 'overcrowded';
  temperature: number;
  humidity: number;
  heatIndex: number;
  status: 'safe' | 'alert' | 'danger';
}

export interface EmergencyAlert {
  id: string;
  timestamp: string;
  type: 'SOS_BUTTON' | 'CRITICAL_VITALS' | 'OVERCROWDING' | 'HEAT_STROKE';
  attendeeId?: string;
  attendeeName?: string;
  zone: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'dispatched' | 'resolved';
  assignedResponder?: string;
  details: string;
}

export interface Responder {
  id: string;
  name: string;
  role: 'Paramedic' | 'Security Officer' | 'Crowd Marshal' | 'Tech Support';
  status: 'available' | 'dispatched' | 'on_break';
  currentZone: string;
  contactNumber: string;
  assignedIncidentId?: string;
}

// ==========================================
// Location & Crowd Tracking Component Types
// ==========================================

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type ZoneCategory = 'STAGE' | 'EXIT' | 'FIRST_AID' | 'RESTROOM' | 'FOOD_BEVERAGE' | 'CAMPING' | 'SECURITY';

export interface EventZone {
  id: string;
  name: string;
  type: ZoneCategory;
  polygon: GeoPoint[];
  capacity: number;
  surgeSpeedThresholdKmH: number;
  densityWarningThreshold?: number;
  color?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CrowdFlowStatus = 
  | 'NORMAL_STATIC'
  | 'NORMAL_DISPERSED'
  | 'COORDINATED_FLOW'
  | 'ELEVATED_FLOW'
  | 'CRITICAL_SURGE'
  | 'BOTTLENECK';

export interface Vector2D {
  x: number;
  y: number;
}

export interface CrowdMetric {
  zoneId: string;
  zoneName: string;
  deviceCount: number;
  sampleSize: number;
  averageSpeedKmH: number;
  dominantHeadingDeg: number;
  dominantDirectionCardinal: string;
  coherenceScore: number;
  flowVector: Vector2D;
  occupancyPercentage: number;
  status: CrowdFlowStatus;
  surgeDetected: boolean;
  lastCalculated: string;
}

export interface DeviceLocation {
  deviceId: string;
  attendeeId?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number;
  heading: number;
  satellites: number;
  fixQuality: 'Valid' | 'Invalid';
  timestamp: string;
  battery?: number;
  currentZoneId?: string | null;
}

export interface SurgeAlert {
  id: string;
  zoneId: string;
  zoneName: string;
  type: 'CROWD_SURGE' | 'BOTTLENECK' | 'OVERCROWDING';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  averageSpeedKmH: number;
  speedThresholdKmH: number;
  dominantHeadingDeg: number;
  dominantDirectionCardinal: string;
  coherenceScore: number;
  deviceCount: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  timestamp: string;
}

// ==========================================
// Hydration & Wellness Management Types
// ==========================================

export type HeatStressLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface HeatStressReading {
  id: string;
  deviceId: string;
  attendeeId?: string;
  bpm: number;
  bodyTemperature: number;
  wbgtIndex: number;
  level: HeatStressLevel;
  timestamp: string;
}

export interface HydrationLogEntry {
  id: string;
  deviceId: string;
  attendeeId?: string;
  amountMl: number;
  timestamp: string;
  note?: string;
}

export interface HydrationReminder {
  deviceId: string;
  nextReminderAt: string;
  intervalMinutes: number;
  bpmGradient: number;
  lastUpdated: string;
}

export interface HourlyWellnessSnapshot {
  deviceId: string;
  hour: string;
  avgBpm: number;
  peakBpm: number;
  avgSpO2: number;
  avgHeatStressIndex: number;
  dominantLevel: HeatStressLevel;
  hydrationMl: number;
}

export interface WellnessDashboard {
  deviceId: string;
  generatedAt: string;
  hourlySnapshots: HourlyWellnessSnapshot[];
  hydrationComplianceScore: number;
  totalHydrationMl: number;
  dailyTargetMl: number;
  currentHeatStressLevel: HeatStressLevel;
  currentWbgtIndex: number;
  latestBpm: number;
  latestSpO2: number;
  reminderState: HydrationReminder | null;
}

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
  hydrationScore: number;
  totalHydrationMl: number;
  hydrationLogs: HydrationLogEntry[];
  alertHistory: string[];
  averageBpm: number;
  averageSpO2: number;
  maxHeatStressLevel: HeatStressLevel;
}

// Attendee wellness state used in live simulation
export interface AttendeeWellnessState {
  deviceId: string;
  attendeeId: string;
  name: string;
  zone: string;
  bpm: number;
  bodyTemperature: number;
  spO2: number;
  wbgtIndex: number;
  heatStressLevel: HeatStressLevel;
  bpmHistory: number[];      // last 10 readings for gradient
  hydrationMl: number;       // today's total
  lastReminder: string;      // ISO time
  nextReminderAt: string;    // ISO time
  reminderInterval: number;  // minutes
  battery: number;
}

