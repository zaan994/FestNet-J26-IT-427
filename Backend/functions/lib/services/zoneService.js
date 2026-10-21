"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zoneService = void 0;
const zoneRepository_1 = require("../repositories/zoneRepository");
const geoMath_1 = require("../utils/geoMath");
class ZoneService {
    async getAllZones() {
        return zoneRepository_1.zoneRepository.getAllZones();
    }
    async getZoneById(id) {
        return zoneRepository_1.zoneRepository.getZoneById(id);
    }
    async createZone(dto) {
        return zoneRepository_1.zoneRepository.createZone(dto);
    }
    async updateZone(id, dto) {
        return zoneRepository_1.zoneRepository.updateZone(id, dto);
    }
    async deleteZone(id) {
        return zoneRepository_1.zoneRepository.deleteZone(id);
    }
    /**
     * Identifies which digital event zone polygon (if any) contains the given GPS coordinates.
     */
    async findZoneForPoint(lat, lng) {
        const zones = await this.getAllZones();
        for (const zone of zones) {
            if ((0, geoMath_1.isPointInPolygon)({ lat, lng }, zone.polygon)) {
                return zone;
            }
        }
        return null;
    }
}
exports.zoneService = new ZoneService();
//# sourceMappingURL=zoneService.js.map