import {
  isPointInPolygon,
  haversineDistance,
  calculateBearing,
  speedAndHeadingToVector,
  calculateMeanVelocityVector,
  calculateDirectionalCoherence,
} from '../src/utils/geoMath';
import { crowdAnalysisService } from '../src/services/crowdAnalysisService';
import { EventZone } from '../src/types/zone';
import { DeviceTelemetry } from '../src/types/telemetry';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('  RUNNING FESTNET CROWD & VECTOR ALGORITHM TEST SUITE');
  console.log('======================================================\n');

  // --- Test 1: Point in Polygon Geometry ---
  console.log('--- Test 1: Point-in-Polygon (Ray Casting) ---');
  const testPolygon = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 10, lng: 10 },
    { lat: 10, lng: 0 },
  ];
  assert(isPointInPolygon({ lat: 5, lng: 5 }, testPolygon) === true, 'Center point (5,5) is inside square polygon');
  assert(isPointInPolygon({ lat: 15, lng: 5 }, testPolygon) === false, 'External point (15,5) is outside square polygon');
  assert(isPointInPolygon({ lat: -2, lng: -2 }, testPolygon) === false, 'Negative point (-2,-2) is outside');

  // --- Test 2: Great-Circle Haversine Distance ---
  console.log('\n--- Test 2: Haversine Distance Calculation ---');
  // 1 degree latitude is approximately 111,195 meters
  const dist = haversineDistance({ lat: 7.0, lng: 80.0 }, { lat: 7.001, lng: 80.0 });
  assert(dist > 100 && dist < 125, `Distance for 0.001 deg lat is ~111m (Calculated: ${dist.toFixed(1)}m)`);

  // --- Test 3: Compass Bearing Calculation ---
  console.log('\n--- Test 3: Bearing Calculation ---');
  const bearingNorth = calculateBearing({ lat: 7.0, lng: 80.0 }, { lat: 7.01, lng: 80.0 });
  assert(Math.abs(bearingNorth - 0) < 1, `Bearing due North is ~0° (Calculated: ${bearingNorth.toFixed(1)}°)`);

  const bearingEast = calculateBearing({ lat: 7.0, lng: 80.0 }, { lat: 7.0, lng: 80.01 });
  assert(Math.abs(bearingEast - 90) < 1, `Bearing due East is ~90° (Calculated: ${bearingEast.toFixed(1)}°)`);

  // --- Test 4: Directional Coherence (Kuramoto Order Parameter R) ---
  console.log('\n--- Test 4: Directional Coherence Order Parameter R ---');
  // Perfectly aligned group moving East (90 deg)
  const coherentHeadings = [90, 92, 88, 91, 89, 90];
  const rCoherent = calculateDirectionalCoherence(coherentHeadings);
  assert(rCoherent >= 0.95, `Coherent group has high R >= 0.95 (Calculated: ${rCoherent})`);

  // Randomly dispersed group moving in all directions
  const randomHeadings = [0, 90, 180, 270, 45, 135, 225, 315];
  const rRandom = calculateDirectionalCoherence(randomHeadings);
  assert(rRandom <= 0.20, `Uniformly dispersed group has low R <= 0.20 (Calculated: ${rRandom})`);

  // --- Test 5: Mean Velocity Vector Calculation ---
  console.log('\n--- Test 5: Mean Velocity Vector Math ---');
  // 5 devices moving East (90 deg) at 6 km/h: Vx = 6, Vy = 0
  const eastVectors = [
    speedAndHeadingToVector(6.0, 90),
    speedAndHeadingToVector(6.2, 92),
    speedAndHeadingToVector(5.8, 88),
    speedAndHeadingToVector(6.0, 90),
    speedAndHeadingToVector(6.0, 90),
  ];
  const meanResult = calculateMeanVelocityVector(eastVectors);
  assert(Math.abs(meanResult.averageSpeed - 6.0) < 0.2, `Average speed is ~6.0 km/h (Calculated: ${meanResult.averageSpeed})`);
  assert(Math.abs(meanResult.dominantHeadingDeg - 90) < 2, `Dominant heading is ~90° (Calculated: ${meanResult.dominantHeadingDeg}°)`);

  // --- Test 6: Crowd Surge Detection Criteria ---
  console.log('\n--- Test 6: Surge Detection Evaluation ---');
  const mockZone: EventZone = {
    id: 'TEST-ZONE',
    name: 'Test Arena',
    type: 'STAGE',
    polygon: [
      { lat: 7.0, lng: 80.0 },
      { lat: 7.0, lng: 80.05 },
      { lat: 7.05, lng: 80.05 },
      { lat: 7.05, lng: 80.0 },
    ],
    capacity: 1000,
    surgeSpeedThresholdKmH: 6.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Scenario 6A: Fewer than 5 devices (Insufficient sample size)
  const fewDevices: DeviceTelemetry[] = [
    { deviceId: 'B1', latitude: 7.01, longitude: 80.01, speed: 7.0, heading: 90, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B2', latitude: 7.01, longitude: 80.01, speed: 7.5, heading: 90, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
  ];
  const metricFew = crowdAnalysisService.computeMetricForZone(mockZone, fewDevices);
  assert(metricFew.status === 'NORMAL_STATIC' && metricFew.surgeDetected === false, 'Less than 5 devices does not trigger surge (sample size filter)');

  // Scenario 6B: 8 devices moving randomly at walking speed (2 - 3 km/h)
  const randomDevices: DeviceTelemetry[] = [
    { deviceId: 'B1', latitude: 7.01, longitude: 80.01, speed: 2.5, heading: 10, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B2', latitude: 7.01, longitude: 80.01, speed: 3.0, heading: 95, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B3', latitude: 7.01, longitude: 80.01, speed: 2.2, heading: 180, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B4', latitude: 7.01, longitude: 80.01, speed: 3.1, heading: 260, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B5', latitude: 7.01, longitude: 80.01, speed: 2.8, heading: 45, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B6', latitude: 7.01, longitude: 80.01, speed: 2.0, heading: 140, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B7', latitude: 7.01, longitude: 80.01, speed: 3.2, heading: 220, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B8', latitude: 7.01, longitude: 80.01, speed: 2.7, heading: 310, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
  ];
  const metricRandom = crowdAnalysisService.computeMetricForZone(mockZone, randomDevices);
  assert(metricRandom.status === 'NORMAL_DISPERSED' && metricRandom.coherenceScore < 0.45, `Random walk produces NORMAL_DISPERSED (Coherence: ${metricRandom.coherenceScore})`);

  // Scenario 6C: 8 devices walking coherently at normal speed (3.5 km/h < 6.0 km/h threshold)
  const walkingDevices: DeviceTelemetry[] = [
    { deviceId: 'B1', latitude: 7.01, longitude: 80.01, speed: 3.5, heading: 88, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B2', latitude: 7.01, longitude: 80.01, speed: 3.6, heading: 91, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B3', latitude: 7.01, longitude: 80.01, speed: 3.4, heading: 89, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B4', latitude: 7.01, longitude: 80.01, speed: 3.7, heading: 92, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B5', latitude: 7.01, longitude: 80.01, speed: 3.5, heading: 90, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B6', latitude: 7.01, longitude: 80.01, speed: 3.8, heading: 87, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B7', latitude: 7.01, longitude: 80.01, speed: 3.3, heading: 93, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B8', latitude: 7.01, longitude: 80.01, speed: 3.5, heading: 90, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
  ];
  const metricWalking = crowdAnalysisService.computeMetricForZone(mockZone, walkingDevices);
  assert(metricWalking.status === 'COORDINATED_FLOW' && metricWalking.coherenceScore > 0.8 && metricWalking.surgeDetected === false, `Coherent walking produces COORDINATED_FLOW without surge (Coherence: ${metricWalking.coherenceScore})`);

  // Scenario 6D: 8 devices SURGING at high speed (7.8 km/h > 6.0 km/h threshold) towards East
  const surgingDevices: DeviceTelemetry[] = [
    { deviceId: 'B1', latitude: 7.01, longitude: 80.01, speed: 7.8, heading: 88, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B2', latitude: 7.01, longitude: 80.01, speed: 8.0, heading: 92, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B3', latitude: 7.01, longitude: 80.01, speed: 7.5, heading: 89, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B4', latitude: 7.01, longitude: 80.01, speed: 8.2, heading: 91, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B5', latitude: 7.01, longitude: 80.01, speed: 7.9, heading: 90, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B6', latitude: 7.01, longitude: 80.01, speed: 8.5, heading: 87, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B7', latitude: 7.01, longitude: 80.01, speed: 7.6, heading: 94, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
    { deviceId: 'B8', latitude: 7.01, longitude: 80.01, speed: 7.7, heading: 90, satellites: 6, fixQuality: 'Valid', timestamp: new Date().toISOString() },
  ];
  const metricSurge = crowdAnalysisService.computeMetricForZone(mockZone, surgingDevices);
  assert(metricSurge.status === 'CRITICAL_SURGE' && metricSurge.surgeDetected === true, `High-speed aligned swarm accurately triggers CRITICAL_SURGE! (Speed: ${metricSurge.averageSpeedKmH} km/h, Coherence: ${metricSurge.coherenceScore})`);
  assert(metricSurge.dominantDirectionCardinal === 'E', `Detected dominant surge direction as East 'E' (Heading: ${metricSurge.dominantHeadingDeg}°)`);

  console.log('\n======================================================');
  console.log('  ALL CROWD TRACKING ALGORITHM TESTS PASSED SUCCESSFULLY');
  console.log('======================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
