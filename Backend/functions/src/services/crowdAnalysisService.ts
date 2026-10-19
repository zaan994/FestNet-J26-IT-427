import { CrowdMetric, CrowdFlowStatus, Vector2D } from '../types/crowd';
import { SurgeAlert } from '../types/alert';
import { DeviceTelemetry } from '../types/telemetry';
import { EventZone } from '../types/zone';
import { CONFIG } from '../config/constants';
import {
  speedAndHeadingToVector,
  calculateMeanVelocityVector,
  calculateDirectionalCoherence,
  degreesToCardinal,
  isPointInPolygon,
} from '../utils/geoMath';
import { zoneRepository } from '../repositories/zoneRepository';
import { telemetryRepository } from '../repositories/telemetryRepository';
import { crowdMetricRepository } from '../repositories/crowdMetricRepository';
import { alertRepository } from '../repositories/alertRepository';

class CrowdAnalysisService {
  /**
   * Evaluates crowd flow and surge dynamics across all configured event zones.
   */
  async analyzeCrowdFlow(): Promise<{
    metrics: CrowdMetric[];
    newAlerts: SurgeAlert[];
  }> {
    const zones = await zoneRepository.getAllZones();
    const activeDevices = await telemetryRepository.getAllActiveDevices(CONFIG.DATA_STALENESS_SECONDS);

    const metrics: CrowdMetric[] = [];
    const newAlerts: SurgeAlert[] = [];

    for (const zone of zones) {
      // 1. Group devices located within the zone polygon
      const devicesInZone = activeDevices.filter((d) =>
        isPointInPolygon({ lat: d.latitude, lng: d.longitude }, zone.polygon)
      );

      const metric = this.computeMetricForZone(zone, devicesInZone);
      metrics.push(metric);
      await crowdMetricRepository.saveMetric(metric);

      // 2. Check surge and bottleneck conditions
      if (metric.surgeDetected) {
        const alert = await this.evaluateAndTriggerSurgeAlert(zone, metric);
        if (alert) {
          newAlerts.push(alert);
        }
      }
    }

    return { metrics, newAlerts };
  }

  /**
   * Computes the average velocity vector and directional coherence for a specific zone.
   */
  computeMetricForZone(zone: EventZone, devices: DeviceTelemetry[]): CrowdMetric {
    const deviceCount = devices.length;
    const occupancyPercentage = Math.round((deviceCount / zone.capacity) * 100);

    // Filter devices with valid movement (speed >= MIN_MOTION_SPEED_KMH)
    const movingDevices = devices.filter((d) => d.speed >= CONFIG.MIN_MOTION_SPEED_KMH);
    const sampleSize = movingDevices.length;

    // Default static metric if not enough moving devices (< MIN_DEVICES_FOR_FLOW_ANALYSIS)
    if (sampleSize < CONFIG.MIN_DEVICES_FOR_FLOW_ANALYSIS) {
      const avgSpeed =
        deviceCount > 0
          ? Math.round((devices.reduce((acc, d) => acc + d.speed, 0) / deviceCount) * 10) / 10
          : 0;

      return {
        zoneId: zone.id,
        zoneName: zone.name,
        deviceCount,
        sampleSize,
        averageSpeedKmH: avgSpeed,
        dominantHeadingDeg: 0,
        dominantDirectionCardinal: 'N',
        coherenceScore: 0,
        flowVector: { x: 0, y: 0 },
        occupancyPercentage,
        status: deviceCount > 0 ? 'NORMAL_STATIC' : 'NORMAL_STATIC',
        surgeDetected: false,
        lastCalculated: new Date().toISOString(),
      };
    }

    // 1. Map each moving device to a 2D velocity vector
    const vectors: Vector2D[] = movingDevices.map((d) =>
      speedAndHeadingToVector(d.speed, d.heading)
    );

    // 2. Compute Mean Velocity Vector (dominant direction + average speed)
    const { meanVector, averageSpeed, dominantHeadingDeg } = calculateMeanVelocityVector(vectors);

    // 3. Compute Directional Coherence (Kuramoto order parameter R in [0, 1])
    const headings = movingDevices.map((d) => d.heading);
    const coherenceScore = calculateDirectionalCoherence(headings);

    const dominantDirectionCardinal = degreesToCardinal(dominantHeadingDeg);

    // 4. Classify crowd flow status based on speed threshold and coherence
    const surgeThreshold = zone.surgeSpeedThresholdKmH || CONFIG.DEFAULT_SURGE_SPEED_KMH;
    let status: CrowdFlowStatus = 'NORMAL_STATIC';
    let surgeDetected = false;

    if (coherenceScore < 0.45) {
      status = 'NORMAL_DISPERSED';
    } else if (coherenceScore >= CONFIG.SURGE_COHERENCE_THRESHOLD && averageSpeed >= surgeThreshold) {
      // Coherent rapid mass movement exceeding zone limit
      status = 'CRITICAL_SURGE';
      surgeDetected = true;
    } else if (coherenceScore >= CONFIG.WARNING_COHERENCE_THRESHOLD && averageSpeed >= surgeThreshold * 0.75) {
      status = 'ELEVATED_FLOW';
    } else if (coherenceScore >= 0.55) {
      status = 'COORDINATED_FLOW';
    } else {
      status = 'NORMAL_DISPERSED';
    }

    // Check Bottleneck scenario (high occupancy, low speed, in an exit zone)
    if (zone.type === 'EXIT' && occupancyPercentage >= 85 && averageSpeed < 1.0) {
      status = 'BOTTLENECK';
    }

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      deviceCount,
      sampleSize,
      averageSpeedKmH: averageSpeed,
      dominantHeadingDeg,
      dominantDirectionCardinal,
      coherenceScore,
      flowVector: meanVector,
      occupancyPercentage,
      status,
      surgeDetected,
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Triggers or updates a SurgeAlert in the alert repository.
   */
  private async evaluateAndTriggerSurgeAlert(
    zone: EventZone,
    metric: CrowdMetric
  ): Promise<SurgeAlert | null> {
    // Check if an active alert already exists for this zone to avoid spamming
    const existing = await alertRepository.getLatestAlertForZone(zone.id);
    if (existing) {
      // Update existing alert with latest telemetry
      existing.averageSpeedKmH = metric.averageSpeedKmH;
      existing.dominantHeadingDeg = metric.dominantHeadingDeg;
      existing.dominantDirectionCardinal = metric.dominantDirectionCardinal;
      existing.coherenceScore = metric.coherenceScore;
      existing.deviceCount = metric.deviceCount;
      existing.timestamp = new Date().toISOString();
      return null;
    }

    const alertId = `SURGE-${zone.id}-${Date.now()}`;
    const newAlert: SurgeAlert = {
      id: alertId,
      zoneId: zone.id,
      zoneName: zone.name,
      type: 'CROWD_SURGE',
      severity: 'CRITICAL',
      message: `Crowd surge warning in ${zone.name}: ${metric.sampleSize} wearables moving ${metric.dominantDirectionCardinal} (${metric.dominantHeadingDeg}°) at ${metric.averageSpeedKmH} km/h (coherence: ${(metric.coherenceScore * 100).toFixed(0)}%).`,
      averageSpeedKmH: metric.averageSpeedKmH,
      speedThresholdKmH: zone.surgeSpeedThresholdKmH,
      dominantHeadingDeg: metric.dominantHeadingDeg,
      dominantDirectionCardinal: metric.dominantDirectionCardinal,
      coherenceScore: metric.coherenceScore,
      deviceCount: metric.deviceCount,
      status: 'ACTIVE',
      timestamp: new Date().toISOString(),
    };

    return alertRepository.createAlert(newAlert);
  }
}

export const crowdAnalysisService = new CrowdAnalysisService();
