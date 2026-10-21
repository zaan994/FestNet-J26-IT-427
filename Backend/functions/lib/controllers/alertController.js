"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAlerts = getAllAlerts;
exports.acknowledgeAlert = acknowledgeAlert;
exports.resolveAlert = resolveAlert;
const alertRepository_1 = require("../repositories/alertRepository");
const api_1 = require("../types/api");
async function getAllAlerts(req, res) {
    try {
        const { status, limit } = req.query;
        const limitNum = limit ? parseInt(String(limit), 10) : 50;
        let alerts = await alertRepository_1.alertRepository.getAllAlerts(limitNum);
        if (status && typeof status === 'string') {
            alerts = alerts.filter((a) => a.status === status.toUpperCase());
        }
        res.json((0, api_1.successResponse)(alerts));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function acknowledgeAlert(req, res) {
    try {
        const { id } = req.params;
        const { responderName } = req.body;
        const updated = await alertRepository_1.alertRepository.updateAlertStatus(id, 'ACKNOWLEDGED', responderName);
        if (!updated) {
            res.status(404).json((0, api_1.errorResponse)(`Alert with ID ${id} not found`, 404));
            return;
        }
        res.json((0, api_1.successResponse)(updated, 'Alert acknowledged successfully'));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function resolveAlert(req, res) {
    try {
        const { id } = req.params;
        const updated = await alertRepository_1.alertRepository.updateAlertStatus(id, 'RESOLVED');
        if (!updated) {
            res.status(404).json((0, api_1.errorResponse)(`Alert with ID ${id} not found`, 404));
            return;
        }
        res.json((0, api_1.successResponse)(updated, 'Alert resolved successfully'));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
//# sourceMappingURL=alertController.js.map