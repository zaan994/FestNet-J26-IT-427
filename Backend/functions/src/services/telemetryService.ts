import { DeviceTelemetry, IngestTelemetryDTO } from '../types/telemetry';
import { validateTelemetryDTO } from '../validators/telemetryValidator';
import { telemetryRepository } from '../repositories/telemetryRepository';
import { zoneService } from './zoneService';
import { crowdAnalysisService } from './crowdAnalysisService';
import { haversineDistance, calculateBearing } from '../utils/geoMath';
import { wellnessService } from './wellnessService';

class TelemetryService {
  async ingestTelemetry(dto: IngestTelemetryDTO): Promise<{
    success: boolean;
    telemetry?: DeviceTelemetry;
    error?: string;
  }> {
    const validation = validateTelemetryDTO(dto);
    if (!validation.valid || !validation.data) {
      return { success: false, error: validation.error };
    }

    const telemetry = validation.data;

    // Check if speed or heading is missing; if so, compute from previous GPS ping
    if (telemetry.speed === 0 || telemetry.heading === 0) {
      const prev = await telemetryRepository.getLatestTelemetry(telemetry.deviceId);
      if (prev) {
        const timeDiffSec =
          (new Date(telemetry.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;

        if (timeDiffSec > 0 && timeDiffSec < 30) {
          const distMeters = haversineDistance(
            { lat: prev.latitude, lng: prev.longitude },
            { lat: telemetry.latitude, lng: telemetry.longitude }
          );

          if (telemetry.speed === 0 && distMeters > 0.5) {
            // Convert m/s to km/h
            const speedMps = distMeters / timeDiffSec;
            telemetry.speed = Math.round(speedMps * 3.6 * 100) / 100;
          }

          if (telemetry.heading === 0 && distMeters > 1.0) {
            telemetry.heading = Math.round(
              calculateBearing(
                { lat: prev.latitude, lng: prev.longitude },
                { lat: telemetry.latitude, lng: telemetry.longitude }
              ) * 10
            ) / 10;
          }
        }
      }
    }

    // Determine current zone
    const matchedZone = await zoneService.findZoneForPoint(telemetry.latitude, telemetry.longitude);
    telemetry.currentZoneId = matchedZone ? matchedZone.id : null;

    // Persist telemetry
    await telemetryRepository.saveTelemetry(telemetry);

    // If wearable sent wellness data (bpm or bodyTemperature), pass to wellnessService
    if (dto.bpm !== undefined || dto.bodyTemperature !== undefined) {
      const bpm = dto.bpm ?? 75;
      const bodyTemp = dto.bodyTemperature ?? 37.0;
      try {
        await wellnessService.ingestWellnessReading({
          deviceId: telemetry.deviceId,
          attendeeId: telemetry.attendeeId,
          bpm,
          bodyTemperature: bodyTemp,
          spO2: dto.spO2,
          timestamp: telemetry.timestamp,
        });
      } catch (err) {
        console.error('[TelemetryService] Wellness sync error:', err);
      }
    }

    return { success: true, telemetry };
  }

  async getAllActiveDevices(): Promise<DeviceTelemetry[]> {
    return telemetryRepository.getAllActiveDevices();
  }

  async getDeviceHistory(deviceId: string): Promise<DeviceTelemetry[]> {
    return telemetryRepository.getDeviceHistory(deviceId);
  }
}

export const telemetryService = new TelemetryService();
