import { GeoPoint } from './telemetry';

export type ZoneType = 'STAGE' | 'EXIT' | 'FIRST_AID' | 'RESTROOM' | 'FOOD_BEVERAGE' | 'CAMPING' | 'SECURITY';

export interface EventZone {
  id: string;
  name: string;
  type: ZoneType;
  polygon: GeoPoint[]; // Array of vertices (lat, lng) defining the boundary
  capacity: number;
  surgeSpeedThresholdKmH: number; // e.g. 6.0 km/h (walking is ~4 km/h)
  densityWarningThreshold?: number; // occupancy percentage e.g. 80
  color?: string; // Hex color for dashboard rendering
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoneDTO {
  id?: string;
  name: string;
  type: ZoneType;
  polygon: GeoPoint[];
  capacity: number;
  surgeSpeedThresholdKmH?: number;
  densityWarningThreshold?: number;
  color?: string;
  description?: string;
}

export interface UpdateZoneDTO extends Partial<CreateZoneDTO> {}
