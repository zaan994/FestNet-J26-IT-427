import express from 'express';
import cors from 'cors';
import { ingestTelemetry, getLiveTelemetry, getDeviceHistory } from './controllers/telemetryController';
import { getAllZones, getZoneById, createZone, updateZone, deleteZone } from './controllers/zoneController';
import { getAllMetrics, getMetricByZoneId, triggerAnalysis } from './controllers/crowdController';
import { getAllAlerts, acknowledgeAlert, resolveAlert } from './controllers/alertController';
import {
  ingestWellnessReading,
  logHydration,
  getHydrationReminder,
  getWellnessDashboard,
  getPostEventReport,
} from './controllers/wellnessController';
import { ioTBridgeService } from './services/ioTBridgeService';

export const app = express();

// Middlewares
app.use(cors({ origin: true }));
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'FestNet Location & Crowd Tracking API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Telemetry Endpoints (Wearable GPS & Simulator)
app.post('/api/telemetry', ingestTelemetry);
app.get('/api/telemetry/live', getLiveTelemetry);
app.get('/api/telemetry/:deviceId', getDeviceHistory);

// Dynamic Event-Zone Mapping Endpoints
app.get('/api/zones', getAllZones);
app.get('/api/zones/:id', getZoneById);
app.post('/api/zones', createZone);
app.put('/api/zones/:id', updateZone);
app.delete('/api/zones/:id', deleteZone);

// Crowd-Flow & Vector Analysis Endpoints
app.get('/api/crowd/metrics', getAllMetrics);
app.get('/api/crowd/metrics/:zoneId', getMetricByZoneId);
app.post('/api/crowd/analyze', triggerAnalysis);

// Surge & Safety Alert Endpoints
app.get('/api/alerts', getAllAlerts);
app.post('/api/alerts/:id/acknowledge', acknowledgeAlert);
app.post('/api/alerts/:id/resolve', resolveAlert);

// Hydration & Wellness Management Endpoints
app.post('/api/wellness/reading', ingestWellnessReading);
app.post('/api/wellness/hydration', logHydration);
app.get('/api/wellness/reminder/:deviceId', getHydrationReminder);
app.get('/api/wellness/dashboard/:deviceId', getWellnessDashboard);
app.get('/api/wellness/report/:deviceId', getPostEventReport);

// IoT Bridge Live Raw Snapshot Endpoint
app.get('/api/iot/snapshot', (req, res) => {
  const snapshot = ioTBridgeService.getLatestSnapshot();
  res.json({ success: true, snapshot });
});

export default app;
