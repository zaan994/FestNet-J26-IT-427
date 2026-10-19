import { telemetryService } from '../functions/src/services/telemetryService';
import { crowdAnalysisService } from '../functions/src/services/crowdAnalysisService';
import { alertRepository } from '../functions/src/repositories/alertRepository';
import { telemetryRepository } from '../functions/src/repositories/telemetryRepository';
import { IngestTelemetryDTO } from '../functions/src/types/telemetry';

// Center anchor inside Main Stage Arena (~7.1195° N, 80.0475° E)
const ANCHOR_LAT = 7.119500;
const ANCHOR_LNG = 80.047500;

interface BenchmarkResult {
  scenarioName: string;
  deviceCount: number;
  expectedDirectionDeg: number | null;
  calculatedDirectionDeg: number;
  directionErrorDeg: number | null;
  coherenceScore: number;
  averageSpeedKmH: number;
  surgeExpected: boolean;
  surgeDetected: boolean;
  latencyMs: number;
  accuracyPassed: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScenario(
  name: string,
  deviceCount: number,
  baseSpeedKmH: number,
  baseHeadingDeg: number | null, // null for random
  surgeExpected: boolean
): Promise<BenchmarkResult> {
  console.log(`\n======================================================`);
  console.log(`  RUNNING SCENARIO: ${name}`);
  console.log(`  Devices: ${deviceCount} | Speed: ~${baseSpeedKmH} km/h | Target Heading: ${baseHeadingDeg !== null ? baseHeadingDeg + '°' : 'Random'}`);
  console.log(`======================================================`);

  // Clear previous telemetry
  await telemetryRepository.clearAll();

  // Generate device pings
  const pings: IngestTelemetryDTO[] = [];
  for (let i = 1; i <= deviceCount; i++) {
    const devId = `SIM-BAND-${String(i).padStart(3, '0')}`;
    // Spread positions within ~50 meters of anchor
    const latOffset = (Math.random() - 0.5) * 0.0003;
    const lngOffset = (Math.random() - 0.5) * 0.0003;

    // Heading calculation
    let heading = 0;
    if (baseHeadingDeg === null) {
      // Random independent heading (0 - 360)
      heading = Math.random() * 360;
    } else {
      // Coherent heading with slight human variation (+- 8 degrees)
      const jitter = (Math.random() - 0.5) * 16;
      heading = (baseHeadingDeg + jitter + 360) % 360;
    }

    // Speed calculation (+- 10% variation)
    const speed = Math.max(0.5, baseSpeedKmH + (Math.random() - 0.5) * 0.8);

    pings.push({
      deviceId: devId,
      attendeeId: `ATT-${1000 + i}`,
      latitude: ANCHOR_LAT + latOffset,
      longitude: ANCHOR_LNG + lngOffset,
      speed,
      heading,
      satellites: 7,
      fixQuality: 'Valid',
      timestamp: new Date().toISOString(),
    });
  }

  // Measure Ingestion and Analysis Latency
  const start = performance.now();

  for (const ping of pings) {
    await telemetryService.ingestTelemetry(ping);
  }

  const { metrics, newAlerts } = await crowdAnalysisService.analyzeCrowdFlow();
  const latencyMs = Math.round((performance.now() - start) * 10) / 10;

  // Find metrics for Main Stage
  const stageMetric = metrics.find((m) => m.zoneId === 'ZONE-MAIN-STAGE') || metrics[0];

  const calcDirection = stageMetric.dominantHeadingDeg;
  let dirError: number | null = null;
  if (baseHeadingDeg !== null) {
    const diff = Math.abs(calcDirection - baseHeadingDeg);
    dirError = Math.round(Math.min(diff, 360 - diff) * 10) / 10;
  }

  const surgeDetected = stageMetric.surgeDetected;
  const accuracyPassed =
    surgeDetected === surgeExpected && (dirError === null || dirError <= 10.0);

  console.log(`- Sample Count inside Zone: ${stageMetric.sampleSize}`);
  console.log(`- Calculated Average Speed: ${stageMetric.averageSpeedKmH} km/h`);
  console.log(`- Directional Coherence R:  ${stageMetric.coherenceScore}`);
  console.log(`- Dominant Flow Heading:   ${stageMetric.dominantHeadingDeg}° (${stageMetric.dominantDirectionCardinal})`);
  console.log(`- Direction Error:         ${dirError !== null ? dirError + '°' : 'N/A (Dispersed)'}`);
  console.log(`- Flow Status:             ${stageMetric.status}`);
  console.log(`- Surge Alert Triggered:   ${surgeDetected ? '🚨 YES' : 'NO'}`);
  console.log(`- Analysis Latency:        ${latencyMs} ms`);
  console.log(`- Decision Result:         ${accuracyPassed ? '✅ CORRECT' : '❌ MISMATCH'}`);

  return {
    scenarioName: name,
    deviceCount,
    expectedDirectionDeg: baseHeadingDeg,
    calculatedDirectionDeg: calcDirection,
    directionErrorDeg: dirError,
    coherenceScore: stageMetric.coherenceScore,
    averageSpeedKmH: stageMetric.averageSpeedKmH,
    surgeExpected,
    surgeDetected,
    latencyMs,
    accuracyPassed,
  };
}

async function runAllBenchmarks() {
  console.log(`\n=============================================================`);
  console.log(`  FESTNET LOCATION & CROWD TRACKING RESEARCH BENCHMARK TOOL  `);
  console.log(`=============================================================`);

  const results: BenchmarkResult[] = [];

  // Scenario 1: Random / Dispersed Walking (Normal crowd roaming)
  results.push(
    await runScenario('1. Independent Random Roaming', 10, 2.5, null, false)
  );

  // Scenario 2: Coherent Walking to Stage (High coherence, safe walking speed)
  results.push(
    await runScenario('2. Coordinated Migration (East 90°)', 10, 3.8, 90.0, false)
  );

  // Scenario 3: High-Speed Surge / Rapid Stampede (High coherence, speed > 6.0 km/h)
  results.push(
    await runScenario('3. High-Speed Stampede Surge (North-East 45°)', 10, 8.2, 45.0, true)
  );

  // Print Summary Evaluation Table
  console.log(`\n\n========================================================================================================`);
  console.log(`                               EXPERIMENTAL VALIDATION RESULTS TABLE                                    `);
  console.log(`========================================================================================================`);
  console.log(
    `| Scenario                          | Devices | Coherence | Speed    | Target  | Calc Dir | Error | Surge? | Latency |`
  );
  console.log(
    `|-----------------------------------|---------|-----------|----------|---------|----------|-------|--------|---------|`
  );

  for (const r of results) {
    const sc = r.scenarioName.padEnd(33, ' ');
    const dev = String(r.deviceCount).padStart(7, ' ');
    const coh = r.coherenceScore.toFixed(3).padStart(9, ' ');
    const spd = `${r.averageSpeedKmH} km/h`.padStart(8, ' ');
    const tgt = r.expectedDirectionDeg !== null ? `${r.expectedDirectionDeg}°`.padStart(7, ' ') : ' Random';
    const clc = `${r.calculatedDirectionDeg}°`.padStart(8, ' ');
    const err = r.directionErrorDeg !== null ? `${r.directionErrorDeg}°`.padStart(5, ' ') : ' N/A ';
    const srg = (r.surgeDetected ? '🚨 YES' : '  NO ').padEnd(6, ' ');
    const lat = `${r.latencyMs} ms`.padStart(7, ' ');
    console.log(`| ${sc} | ${dev} | ${coh} | ${spd} | ${tgt} | ${clc} | ${err} | ${srg} | ${lat} |`);
  }
  console.log(`========================================================================================================\n`);

  const allPassed = results.every((r) => r.accuracyPassed);
  if (allPassed) {
    console.log(`🎯 ALL RESEARCH BENCHMARK SCENARIOS PASSED WITH 100% ACCURACY!`);
  } else {
    console.warn(`⚠️ One or more scenarios did not match expected decisions.`);
  }
}

runAllBenchmarks().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
