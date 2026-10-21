import type { LatLng } from "./schema";

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (Haversine). Used by C2 (volunteer radius) and C3 (surge zones). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A real coordinate: finite, in range, and not the (0,0) "no fix" placeholder. */
export function validLatLng(lat: unknown, lng: unknown): LatLng | null {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return null;
  return { latitude: lat, longitude: lng };
}

/** Point moved `distanceM` metres along `bearingDeg` (0 = north). Good enough for festival-scale distances. */
export function offsetMeters(origin: LatLng, distanceM: number, bearingDeg: number): LatLng {
  const bearing = toRadians(bearingDeg);
  const dLat = (distanceM * Math.cos(bearing)) / EARTH_RADIUS_M;
  const dLng = (distanceM * Math.sin(bearing)) / (EARTH_RADIUS_M * Math.cos(toRadians(origin.latitude)));
  return {
    latitude: origin.latitude + (dLat * 180) / Math.PI,
    longitude: origin.longitude + (dLng * 180) / Math.PI,
  };
}
