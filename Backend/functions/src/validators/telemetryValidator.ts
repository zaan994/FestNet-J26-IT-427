import { IngestTelemetryDTO, DeviceTelemetry } from '../types/telemetry';

export function validateTelemetryDTO(dto: any): { valid: boolean; error?: string; data?: DeviceTelemetry } {
  if (!dto || typeof dto !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const { deviceId, latitude, longitude } = dto;

  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    return { valid: false, error: 'Field "deviceId" is required and must be a non-empty string.' };
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return { valid: false, error: 'Field "latitude" must be a valid number between -90 and 90.' };
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    return { valid: false, error: 'Field "longitude" must be a valid number between -180 and 180.' };
  }

  const speed = dto.speed !== undefined ? Math.max(0, Number(dto.speed)) : 0;
  const heading = dto.heading !== undefined ? ((Number(dto.heading) % 360) + 360) % 360 : 0;
  const satellites = dto.satellites !== undefined ? Math.max(0, parseInt(dto.satellites, 10)) : 0;
  const altitude = dto.altitude !== undefined ? Number(dto.altitude) : undefined;
  const battery = dto.battery !== undefined ? Math.min(100, Math.max(0, Number(dto.battery))) : undefined;

  const validTelemetry: DeviceTelemetry = {
    deviceId: deviceId.trim(),
    attendeeId: dto.attendeeId ? String(dto.attendeeId).trim() : undefined,
    latitude: Math.round(lat * 1e6) / 1e6,
    longitude: Math.round(lng * 1e6) / 1e6,
    altitude: altitude !== undefined ? Math.round(altitude * 10) / 10 : undefined,
    speed: Math.round(speed * 100) / 100,
    heading: Math.round(heading * 10) / 10,
    satellites,
    fixQuality: (dto.fixQuality === 'Invalid' || satellites === 0) ? 'Invalid' : 'Valid',
    timestamp: dto.timestamp && !isNaN(Date.parse(dto.timestamp)) ? new Date(dto.timestamp).toISOString() : new Date().toISOString(),
    battery,
    currentZoneId: null,
  };

  return { valid: true, data: validTelemetry };
}
