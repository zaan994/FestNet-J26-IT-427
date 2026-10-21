import { app } from './index';
import { CONFIG } from './config/constants';
import { crowdAnalysisService } from './services/crowdAnalysisService';
import { ioTBridgeService } from './services/ioTBridgeService';

const PORT = CONFIG.PORT;

const server = app.listen(PORT, () => {
  console.log(`
=============================================================
  FestNet Location & Crowd Tracking Backend Server
=============================================================
  Listening on: http://localhost:${PORT}
  Endpoints:
    - POST /api/telemetry            (Ingest Wearable GPS)
    - GET  /api/telemetry/live       (Live Wearable Locations)
    - GET  /api/zones                (Dynamic Polygon Zones)
    - POST /api/zones                (Create New Zone)
    - GET  /api/crowd/metrics        (Crowd Flow Vectors & Coherence)
    - GET  /api/alerts               (Surge Warnings & Bottlenecks)
    - GET  /api/health               (Health Check)
    - GET  /api/iot/snapshot         (Live Physical Device Telemetry)
=============================================================
  Automated Crowd Analysis Engine running every ${CONFIG.CROWD_ANALYSIS_INTERVAL_MS / 1000}s.
=============================================================
`);

  // Start real-time bridge to physical ESP32 device
  ioTBridgeService.start();
});

// Periodic background crowd flow analysis loop
const crowdInterval = setInterval(async () => {
  try {
    await crowdAnalysisService.analyzeCrowdFlow();
  } catch (err) {
    console.error('[CrowdEngine] Background loop error:', err);
  }
}, CONFIG.CROWD_ANALYSIS_INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(crowdInterval);
  ioTBridgeService.stop();
  server.close(() => {
    console.log('\n[Server] FestNet backend shut down gracefully.');
    process.exit(0);
  });
});
