"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const telemetryController_1 = require("./controllers/telemetryController");
const zoneController_1 = require("./controllers/zoneController");
const crowdController_1 = require("./controllers/crowdController");
const alertController_1 = require("./controllers/alertController");
const wellnessController_1 = require("./controllers/wellnessController");
const ioTBridgeService_1 = require("./services/ioTBridgeService");
exports.app = (0, express_1.default)();
// Middlewares
exports.app.use((0, cors_1.default)({ origin: true }));
exports.app.use(express_1.default.json());
// Health Check
exports.app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        service: 'FestNet Location & Crowd Tracking API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Telemetry Endpoints (Wearable GPS & Simulator)
exports.app.post('/api/telemetry', telemetryController_1.ingestTelemetry);
exports.app.get('/api/telemetry/live', telemetryController_1.getLiveTelemetry);
exports.app.get('/api/telemetry/:deviceId', telemetryController_1.getDeviceHistory);
// Dynamic Event-Zone Mapping Endpoints
exports.app.get('/api/zones', zoneController_1.getAllZones);
exports.app.get('/api/zones/:id', zoneController_1.getZoneById);
exports.app.post('/api/zones', zoneController_1.createZone);
exports.app.put('/api/zones/:id', zoneController_1.updateZone);
exports.app.delete('/api/zones/:id', zoneController_1.deleteZone);
// Crowd-Flow & Vector Analysis Endpoints
exports.app.get('/api/crowd/metrics', crowdController_1.getAllMetrics);
exports.app.get('/api/crowd/metrics/:zoneId', crowdController_1.getMetricByZoneId);
exports.app.post('/api/crowd/analyze', crowdController_1.triggerAnalysis);
// Surge & Safety Alert Endpoints
exports.app.get('/api/alerts', alertController_1.getAllAlerts);
exports.app.post('/api/alerts/:id/acknowledge', alertController_1.acknowledgeAlert);
exports.app.post('/api/alerts/:id/resolve', alertController_1.resolveAlert);
// Hydration & Wellness Management Endpoints
exports.app.post('/api/wellness/reading', wellnessController_1.ingestWellnessReading);
exports.app.post('/api/wellness/hydration', wellnessController_1.logHydration);
exports.app.get('/api/wellness/reminder/:deviceId', wellnessController_1.getHydrationReminder);
exports.app.get('/api/wellness/dashboard/:deviceId', wellnessController_1.getWellnessDashboard);
exports.app.get('/api/wellness/report/:deviceId', wellnessController_1.getPostEventReport);
// IoT Bridge Live Raw Snapshot Endpoint
exports.app.get('/api/iot/snapshot', (req, res) => {
    const snapshot = ioTBridgeService_1.ioTBridgeService.getLatestSnapshot();
    res.json({ success: true, snapshot });
});
exports.default = exports.app;
//# sourceMappingURL=index.js.map