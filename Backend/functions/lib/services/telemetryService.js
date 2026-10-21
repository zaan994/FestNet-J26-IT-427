"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetryService = void 0;
const telemetryValidator_1 = require("../validators/telemetryValidator");
const telemetryRepository_1 = require("../repositories/telemetryRepository");
const zoneService_1 = require("./zoneService");
const geoMath_1 = require("../utils/geoMath");
const wellnessService_1 = require("./wellnessService");
class TelemetryService {
    async ingestTelemetry(dto) {
        const validation = (0, telemetryValidator_1.validateTelemetryDTO)(dto);
        if (!validation.valid || !validation.data) {
            return { success: false, error: validation.error };
        }
        const telemetry = validation.data;
        // Check if speed or heading is missing; if so, compute from previous GPS ping
        if (telemetry.speed === 0 || telemetry.heading === 0) {
            const prev = await telemetryRepository_1.telemetryRepository.getLatestTelemetry(telemetry.deviceId);
            if (prev) {
                const timeDiffSec = (new Date(telemetry.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
                if (timeDiffSec > 0 && timeDiffSec < 30) {
                    const distMeters = (0, geoMath_1.haversineDistance)({ lat: prev.latitude, lng: prev.longitude }, { lat: telemetry.latitude, lng: telemetry.longitude });
                    if (telemetry.speed === 0 && distMeters > 0.5) {
                        // Convert m/s to km/h
                        const speedMps = distMeters / timeDiffSec;
                        telemetry.speed = Math.round(speedMps * 3.6 * 100) / 100;
                    }
                    if (telemetry.heading === 0 && distMeters > 1.0) {
                        telemetry.heading = Math.round((0, geoMath_1.calculateBearing)({ lat: prev.latitude, lng: prev.longitude }, { lat: telemetry.latitude, lng: telemetry.longitude }) * 10) / 10;
                    }
                }
            }
        }
        // Determine current zone
        const matchedZone = await zoneService_1.zoneService.findZoneForPoint(telemetry.latitude, telemetry.longitude);
        telemetry.currentZoneId = matchedZone ? matchedZone.id : null;
        // Persist telemetry
        await telemetryRepository_1.telemetryRepository.saveTelemetry(telemetry);
        // If wearable sent wellness data (bpm or bodyTemperature), pass to wellnessService
        if (dto.bpm !== undefined || dto.bodyTemperature !== undefined) {
            const bpm = dto.bpm ?? 75;
            const bodyTemp = dto.bodyTemperature ?? 37.0;
            try {
                await wellnessService_1.wellnessService.ingestWellnessReading({
                    deviceId: telemetry.deviceId,
                    attendeeId: telemetry.attendeeId,
                    bpm,
                    bodyTemperature: bodyTemp,
                    spO2: dto.spO2,
                    timestamp: telemetry.timestamp,
                });
            }
            catch (err) {
                console.error('[TelemetryService] Wellness sync error:', err);
            }
        }
        return { success: true, telemetry };
    }
    async getAllActiveDevices() {
        return telemetryRepository_1.telemetryRepository.getAllActiveDevices();
    }
    async getDeviceHistory(deviceId) {
        return telemetryRepository_1.telemetryRepository.getDeviceHistory(deviceId);
    }
}
exports.telemetryService = new TelemetryService();
//# sourceMappingURL=telemetryService.js.map