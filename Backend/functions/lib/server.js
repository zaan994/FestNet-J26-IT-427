"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const constants_1 = require("./config/constants");
const crowdAnalysisService_1 = require("./services/crowdAnalysisService");
const PORT = constants_1.CONFIG.PORT;
const server = index_1.app.listen(PORT, () => {
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
=============================================================
  Automated Crowd Analysis Engine running every ${constants_1.CONFIG.CROWD_ANALYSIS_INTERVAL_MS / 1000}s.
=============================================================
`);
});
// Periodic background crowd flow analysis loop
const crowdInterval = setInterval(async () => {
    try {
        await crowdAnalysisService_1.crowdAnalysisService.analyzeCrowdFlow();
    }
    catch (err) {
        console.error('[CrowdEngine] Background loop error:', err);
    }
}, constants_1.CONFIG.CROWD_ANALYSIS_INTERVAL_MS);
// Graceful shutdown
process.on('SIGINT', () => {
    clearInterval(crowdInterval);
    server.close(() => {
        console.log('\n[Server] FestNet backend shut down gracefully.');
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map