export type AlertType = 'CROWD_SURGE' | 'BOTTLENECK' | 'OVERCROWDING' | 'RAPID_EVACUATION';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface SurgeAlert {
  id: string;
  zoneId: string;
  zoneName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  averageSpeedKmH: number;
  speedThresholdKmH: number;
  dominantHeadingDeg: number;
  dominantDirectionCardinal: string;
  coherenceScore: number;
  deviceCount: number;
  status: AlertStatus;
  timestamp: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}
