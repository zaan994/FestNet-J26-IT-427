"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPointInPolygon = isPointInPolygon;
exports.haversineDistance = haversineDistance;
exports.calculateBearing = calculateBearing;
exports.speedAndHeadingToVector = speedAndHeadingToVector;
exports.calculateMeanVelocityVector = calculateMeanVelocityVector;
exports.calculateDirectionalCoherence = calculateDirectionalCoherence;
exports.degreesToCardinal = degreesToCardinal;
const constants_1 = require("../config/constants");
/**
 * Checks whether a given point (lat, lng) falls inside a digital polygon boundary
 * using the standard Jordan curve theorem (Ray-Casting algorithm).
 */
function isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3)
        return false;
    let inside = false;
    const x = point.lng;
    const y = point.lat;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;
        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect)
            inside = !inside;
    }
    return inside;
}
/**
 * Calculates the great-circle distance between two GPS coordinates in meters
 * using the Haversine formula.
 */
function haversineDistance(p1, p2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLng = toRad(p2.lng - p1.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return constants_1.CONFIG.EARTH_RADIUS_METERS * c;
}
/**
 * Calculates the initial compass bearing from point 1 to point 2 in degrees (0 - 360).
 */
function calculateBearing(from, to) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const φ1 = toRad(from.lat);
    const φ2 = toRad(to.lat);
    const Δλ = toRad(to.lng - from.lng);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
}
/**
 * Converts a scalar speed (km/h) and heading angle (degrees clockwise from North)
 * into a 2D Cartesian velocity vector [Vx, Vy] where:
 * Vx = Easting velocity, Vy = Northing velocity.
 */
function speedAndHeadingToVector(speedKmH, headingDeg) {
    const rad = (headingDeg * Math.PI) / 180;
    return {
        x: speedKmH * Math.sin(rad),
        y: speedKmH * Math.cos(rad),
    };
}
/**
 * Computes the mean velocity vector, dominant heading, and average speed from multiple velocity vectors.
 */
function calculateMeanVelocityVector(vectors) {
    if (vectors.length === 0) {
        return {
            meanVector: { x: 0, y: 0 },
            averageSpeed: 0,
            dominantHeadingDeg: 0,
        };
    }
    let sumX = 0;
    let sumY = 0;
    for (const v of vectors) {
        sumX += v.x;
        sumY += v.y;
    }
    const meanX = sumX / vectors.length;
    const meanY = sumY / vectors.length;
    const averageSpeed = Math.sqrt(meanX * meanX + meanY * meanY);
    const dominantHeadingDeg = (Math.atan2(meanX, meanY) * (180 / Math.PI) + 360) % 360;
    return {
        meanVector: { x: meanX, y: meanY },
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        dominantHeadingDeg: Math.round(dominantHeadingDeg * 10) / 10,
    };
}
/**
 * Computes the Kuramoto Order Parameter (Directional Coherence R) for a set of device headings.
 * R is in [0.0, 1.0].
 * R ≈ 0: Uncorrelated random movement / dispersed crowd
 * R ≈ 1: Perfectly aligned unidirectional crowd flow
 */
function calculateDirectionalCoherence(headingsDeg) {
    if (headingsDeg.length === 0)
        return 0;
    let sumSin = 0;
    let sumCos = 0;
    for (const deg of headingsDeg) {
        const rad = (deg * Math.PI) / 180;
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
    }
    const n = headingsDeg.length;
    const r = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / n;
    return Math.round(r * 1000) / 1000;
}
/**
 * Converts a compass heading in degrees (0 - 360) to 8-point cardinal abbreviation.
 */
function degreesToCardinal(headingDeg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const normalized = ((headingDeg % 360) + 360) % 360;
    const index = Math.round(normalized / 45) % 8;
    return directions[index];
}
//# sourceMappingURL=geoMath.js.map