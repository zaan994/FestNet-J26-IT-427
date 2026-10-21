"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllZones = getAllZones;
exports.getZoneById = getZoneById;
exports.createZone = createZone;
exports.updateZone = updateZone;
exports.deleteZone = deleteZone;
const zoneService_1 = require("../services/zoneService");
const zoneValidator_1 = require("../validators/zoneValidator");
const api_1 = require("../types/api");
async function getAllZones(req, res) {
    try {
        const zones = await zoneService_1.zoneService.getAllZones();
        res.json((0, api_1.successResponse)(zones));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function getZoneById(req, res) {
    try {
        const { id } = req.params;
        const zone = await zoneService_1.zoneService.getZoneById(id);
        if (!zone) {
            res.status(404).json((0, api_1.errorResponse)(`Zone with ID ${id} not found`, 404));
            return;
        }
        res.json((0, api_1.successResponse)(zone));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function createZone(req, res) {
    try {
        const validation = (0, zoneValidator_1.validateZoneDTO)(req.body);
        if (!validation.valid || !validation.data) {
            res.status(400).json((0, api_1.errorResponse)(validation.error || 'Invalid zone data'));
            return;
        }
        const created = await zoneService_1.zoneService.createZone(validation.data);
        res.status(201).json((0, api_1.successResponse)(created, 'Zone created successfully'));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function updateZone(req, res) {
    try {
        const { id } = req.params;
        const updated = await zoneService_1.zoneService.updateZone(id, req.body);
        if (!updated) {
            res.status(404).json((0, api_1.errorResponse)(`Zone with ID ${id} not found`, 404));
            return;
        }
        res.json((0, api_1.successResponse)(updated, 'Zone updated successfully'));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
async function deleteZone(req, res) {
    try {
        const { id } = req.params;
        const deleted = await zoneService_1.zoneService.deleteZone(id);
        if (!deleted) {
            res.status(404).json((0, api_1.errorResponse)(`Zone with ID ${id} not found`, 404));
            return;
        }
        res.json((0, api_1.successResponse)({ id }, 'Zone deleted successfully'));
    }
    catch (err) {
        res.status(500).json((0, api_1.errorResponse)(err.message || 'Internal server error'));
    }
}
//# sourceMappingURL=zoneController.js.map