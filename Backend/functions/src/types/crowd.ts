export interface Vector2D {
  x: number; // Easting component (m/s or km/h)
  y: number; // Northing component (m/s or km/h)
}

export type CrowdFlowStatus = 
  | 'NORMAL_STATIC'       // Low movement / stationary crowd
  | 'NORMAL_DISPERSED'    // Devices moving randomly in different directions
  | 'COORDINATED_FLOW'    // Moderate speed, high direction alignment (e.g. migrating to stage)
  | 'ELEVATED_FLOW'       // Faster speed, high alignment approaching safety limit
  | 'CRITICAL_SURGE'      // High speed (> threshold) + high alignment (> 0.75) -> Emergency alert
  | 'BOTTLENECK';         // High density, low speed, high incoming velocity towards exit

export interface CrowdMetric {
  zoneId: string;
  zoneName: string;
  deviceCount: number; // N devices currently inside
  sampleSize: number; // Devices with valid motion (> 0.5 km/h)
  averageSpeedKmH: number;
  dominantHeadingDeg: number; // 0 - 360 degrees
  dominantDirectionCardinal: string; // e.g. "N", "NE", "E", "SE", "S", "SW", "W", "NW"
  coherenceScore: number; // Order parameter R in [0.0, 1.0]
  flowVector: Vector2D; // Average velocity vector
  occupancyPercentage: number;
  status: CrowdFlowStatus;
  surgeDetected: boolean;
  lastCalculated: string;
}
