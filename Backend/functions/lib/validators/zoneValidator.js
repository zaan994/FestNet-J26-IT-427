"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateZoneDTO = validateZoneDTO;
const VALID_ZONE_TYPES = [
    'STAGE',
    'EXIT',
    'FIRST_AID',
    'RESTROOM',
    'FOOD_BEVERAGE',
    'CAMPING',
    'SECURITY',
];
function validateZoneDTO(dto) {
    if (!dto || typeof dto !== 'object') {
        return { valid: false, error: 'Request body must be a valid JSON object.' };
    }
    const { name, type, polygon, capacity } = dto;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return { valid: false, error: 'Field "name" is required and must be a non-empty string.' };
    }
    if (!type || !VALID_ZONE_TYPES.includes(type)) {
        return {
            valid: false,
            error: `Field "type" must be one of: ${VALID_ZONE_TYPES.join(', ')}.`,
        };
    }
    if (!Array.isArray(polygon) || polygon.length < 3) {
        return {
            valid: false,
            error: 'Field "polygon" must be an array of at least 3 GeoPoint objects [{lat, lng}, ...].',
        };
    }
    const cleanPolygon = [];
    for (let i = 0; i < polygon.length; i++) {
        const pt = polygon[i];
        if (!pt || typeof pt !== 'object') {
            return { valid: false, error: `Polygon vertex at index ${i} is not a valid object.` };
        }
        const lat = Number(pt.lat);
        const lng = Number(pt.lng);
        if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
            return { valid: false, error: `Polygon vertex at index ${i} has invalid lat/lng coordinates.` };
        }
        cleanPolygon.push({ lat, lng });
    }
    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap <= 0) {
        return { valid: false, error: 'Field "capacity" must be a positive integer.' };
    }
    const cleanData = {
        id: dto.id ? String(dto.id).trim() : undefined,
        name: name.trim(),
        type,
        polygon: cleanPolygon,
        capacity: cap,
        surgeSpeedThresholdKmH: dto.surgeSpeedThresholdKmH ? Number(dto.surgeSpeedThresholdKmH) : undefined,
        densityWarningThreshold: dto.densityWarningThreshold ? Number(dto.densityWarningThreshold) : undefined,
        color: dto.color ? String(dto.color).trim() : undefined,
        description: dto.description ? String(dto.description).trim() : undefined,
    };
    return { valid: true, data: cleanData };
}
//# sourceMappingURL=zoneValidator.js.map