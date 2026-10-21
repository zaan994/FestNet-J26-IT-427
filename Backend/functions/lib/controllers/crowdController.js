"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllMetrics = getAllMetrics;
exports.getMetricByZoneId = getMetricByZoneId;
exports.triggerAnalysis = triggerAnalysis;
const crowdMetricRepository_1 = require("../repositories/crowdMetricRepository");
const crowdAnalysisService_1 = require("../services/crowdAnalysisService");
const api_1 = require("../types/api");
async function getAllMetrics(req, res) {
    try {
        const metrics = await crowdMetricRepository_1.crowdMetricRepository.getAllMetrics();
        res.json((0, api_1.successResponse)(metrics));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function getMetricByZoneId(req, res) {
    try {
        const { zoneId } = req.params;
        const metric = await crowdMetricRepository_1.crowdMetricRepository.getMetricByZoneId(zoneId);
        if (!metric) {
            res.status(404).json((0, api_1.errorResponse)(`No crowd metric found for zone ${zoneId}`, 404));
            return;
        }
        res.json((0, api_1.successResponse)(metric));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function triggerAnalysis(req, res) {
    try {
        const result = await crowdAnalysisService_1.crowdAnalysisService.analyzeCrowdFlow();
        res.json((0, api_1.successResponse)(result, 'Crowd analysis evaluated successfully'));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
//# sourceMappingURL=crowdController.js.map