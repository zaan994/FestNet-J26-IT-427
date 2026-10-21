"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestTelemetry = ingestTelemetry;
exports.getLiveTelemetry = getLiveTelemetry;
exports.getDeviceHistory = getDeviceHistory;
const telemetryService_1 = require("../services/telemetryService");
const crowdAnalysisService_1 = require("../services/crowdAnalysisService");
const api_1 = require("../types/api");
async function ingestTelemetry(req, res) {
    try {
        const result = await telemetryService_1.telemetryService.ingestTelemetry(req.body);
        if (!result.success) {
            res.status(400).json((0, api_1.errorResponse)(result.error || 'Failed to ingest telemetry'));
            return;
        }
        // Trigger asynchronous crowd flow calculation update
        crowdAnalysisService_1.crowdAnalysisService.analyzeCrowdFlow().catch((err) => {
            console.error('[CrowdAnalysis] Background update failed:', err);
        });
        res.status(201).json((0, api_1.successResponse)(result.telemetry, 'Telemetry recorded successfully'));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function getLiveTelemetry(req, res) {
    try {
        const devices = await telemetryService_1.telemetryService.getAllActiveDevices();
        res.json((0, api_1.successResponse)(devices));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function getDeviceHistory(req, res) {
    try {
        const { deviceId } = req.params;
        const history = await telemetryService_1.telemetryService.getDeviceHistory(deviceId);
        res.json((0, api_1.successResponse)(history));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
//# sourceMappingURL=telemetryController.js.map