import { VitalReading, ZoneData, EmergencyAlert, Responder } from '../types';

export const INITIAL_ZONES: ZoneData[] = [
  {
    id: 'zone-1',
    name: 'Main Stage (Alpha)',
    currentCount: 8420,
    capacity: 10000,
    density: 'high',
    temperature: 31.8,
    humidity: 68,
    heatIndex: 36.2,
    status: 'alert',
  },
  {
    id: 'zone-2',
    name: 'EDM Tent (Bravo)',
    currentCount: 4890,
    capacity: 5000,
    density: 'overcrowded',
    temperature: 34.2,
    humidity: 78,
    heatIndex: 42.1,
    status: 'danger',
  },
  {
    id: 'zone-3',
    name: 'Food & Beverage Haven',
    currentCount: 2150,
    capacity: 4000,
    density: 'moderate',
    temperature: 29.5,
    humidity: 60,
    heatIndex: 32.0,
    status: 'safe',
  },
  {
    id: 'zone-4',
    name: 'Chillout Lawn & First Aid Hub',
    currentCount: 950,
    capacity: 3000,
    density: 'low',
    temperature: 28.2,
    humidity: 55,
    heatIndex: 29.8,
    status: 'safe',
  },
  {
    id: 'zone-5',
    name: 'East Camping Ground',
    currentCount: 3100,
    capacity: 6000,
    density: 'moderate',
    temperature: 27.9,
    humidity: 58,
    heatIndex: 29.1,
    status: 'safe',
  }
];

export const INITIAL_VITALS: VitalReading[] = [
  {
    attendeeId: 'ATT-1029',
    name: 'Kasun Perera',
    bandId: 'FN-BAND-8821',
    heartRate: 142,
    spo2: 91,
    temperature: 38.9,
    status: 'critical',
    zone: 'EDM Tent (Bravo)',
    battery: 64,
    lastUpdated: 'Just now'
  },
  {
    attendeeId: 'ATT-2041',
    name: 'Nadeesha Silva',
    bandId: 'FN-BAND-4412',
    heartRate: 118,
    spo2: 95,
    temperature: 38.1,
    status: 'warning',
    zone: 'EDM Tent (Bravo)',
    battery: 82,
    lastUpdated: '10s ago'
  },
  {
    attendeeId: 'ATT-3088',
    name: 'Liam Chen',
    bandId: 'FN-BAND-9102',
    heartRate: 78,
    spo2: 99,
    temperature: 36.8,
    status: 'normal',
    zone: 'Main Stage (Alpha)',
    battery: 91,
    lastUpdated: '15s ago'
  },
  {
    attendeeId: 'ATT-4192',
    name: 'Anika Fernando',
    bandId: 'FN-BAND-1123',
    heartRate: 72,
    spo2: 98,
    temperature: 37.0,
    status: 'normal',
    zone: 'Food & Beverage Haven',
    battery: 75,
    lastUpdated: '22s ago'
  },
  {
    attendeeId: 'ATT-5501',
    name: 'Marcus Brody',
    bandId: 'FN-BAND-3389',
    heartRate: 135,
    spo2: 93,
    temperature: 38.6,
    status: 'warning',
    zone: 'Main Stage (Alpha)',
    battery: 48,
    lastUpdated: 'Just now'
  },
  {
    attendeeId: 'ATT-6211',
    name: 'Elena Rostova',
    bandId: 'FN-BAND-7741',
    heartRate: 84,
    spo2: 99,
    temperature: 36.6,
    status: 'normal',
    zone: 'Chillout Lawn & First Aid Hub',
    battery: 89,
    lastUpdated: '30s ago'
  }
];

export const INITIAL_ALERTS: EmergencyAlert[] = [
  {
    id: 'EMG-902',
    timestamp: '20:02:15',
    type: 'SOS_BUTTON',
    attendeeId: 'ATT-1029',
    attendeeName: 'Kasun Perera',
    zone: 'EDM Tent (Bravo)',
    priority: 'critical',
    status: 'pending',
    details: 'SOS Manual button pressed on band FN-BAND-8821. Critical SpO2 (91%) & elevated Temp (38.9°C).'
  },
  {
    id: 'EMG-899',
    timestamp: '19:54:30',
    type: 'OVERCROWDING',
    zone: 'EDM Tent (Bravo)',
    priority: 'high',
    status: 'dispatched',
    assignedResponder: 'Security Unit Alpha 2',
    details: 'Density exceeded 97% safe capacity threshold. Potential entrance bottleneck.'
  },
  {
    id: 'EMG-895',
    timestamp: '19:41:10',
    type: 'HEAT_STROKE',
    attendeeId: 'ATT-5501',
    attendeeName: 'Marcus Brody',
    zone: 'Main Stage (Alpha)',
    priority: 'medium',
    status: 'resolved',
    assignedResponder: 'Medic Squad 1',
    details: 'Heat exhaustion risk triggered. Hydration and shade administered.'
  }
];

export const INITIAL_RESPONDERS: Responder[] = [
  {
    id: 'RESP-01',
    name: 'Dr. Rohan Jayasinghe',
    role: 'Paramedic',
    status: 'available',
    currentZone: 'Chillout Lawn & First Aid Hub',
    contactNumber: '+94 77 123 4567'
  },
  {
    id: 'RESP-02',
    name: 'Sgt. Malinda Bandara',
    role: 'Security Officer',
    status: 'dispatched',
    currentZone: 'EDM Tent (Bravo)',
    contactNumber: '+94 71 987 6543',
    assignedIncidentId: 'EMG-899'
  },
  {
    id: 'RESP-03',
    name: 'Nurse Kavindi Wickrama',
    role: 'Paramedic',
    status: 'available',
    currentZone: 'Food & Beverage Haven',
    contactNumber: '+94 76 555 1290'
  },
  {
    id: 'RESP-04',
    name: 'Crowd Marshal Dinesh',
    role: 'Crowd Marshal',
    status: 'available',
    currentZone: 'Main Stage (Alpha)',
    contactNumber: '+94 70 333 8811'
  },
  {
    id: 'RESP-05',
    name: 'Tech Specialist Janaka',
    role: 'Tech Support',
    status: 'on_break',
    currentZone: 'East Camping Ground',
    contactNumber: '+94 75 444 7722'
  }
];
