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
