export interface GeoPoint {
  lat: number;
  lng: number;
}

export type GPSFixQuality = 'Valid' | 'Invalid';

export interface DeviceTelemetry {
  deviceId: string;
  attendeeId?: string;
  latitude: number;
  longitude: number;
  altitude?: number; // in meters
  speed: number; // in km/h
  heading: number; // in degrees (0 - 360, clockwise from North)
  satellites: number;
  fixQuality: GPSFixQuality;
  timestamp: string; // ISO 8601 string
  battery?: number; // 0 - 100 percentage
  currentZoneId?: string | null;
  // Wellness / biometric sensor fields
  bpm?: number;              // Heart rate in beats per minute
  bodyTemperature?: number;  // Body temperature in Celsius
  spO2?: number;             // Blood oxygen saturation percentage (0-100)
}

export interface IngestTelemetryDTO {
  deviceId: string;
  attendeeId?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  satellites?: number;
  fixQuality?: string;
  timestamp?: string;
  battery?: number;
  // Wellness / biometric sensor fields
  bpm?: number;
  bodyTemperature?: number;
  spO2?: number;
}
