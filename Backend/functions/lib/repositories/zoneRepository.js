"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zoneRepository = void 0;
const firebase_1 = require("../config/firebase");
// Initial festival zones (empty by default - custom zones created dynamically via dashboard)
const DEFAULT_ZONES = [];
class ZoneRepository {
    localZones = new Map();
    constructor() {
        for (const z of DEFAULT_ZONES) {
            this.localZones.set(z.id, z);
        }
    }
    async getAllZones() {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const snapshot = await db.collection('zones').get();
            if (!snapshot.empty) {
                return snapshot.docs.map((d) => d.data());
            }
        }
        return Array.from(this.localZones.values());
    }
    async getZoneById(id) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const doc = await db.collection('zones').doc(id).get();
            if (doc.exists) {
                return doc.data();
            }
        }
        return this.localZones.get(id) || null;
    }
    async createZone(dto) {
        const id = dto.id || `ZONE-${Date.now()}`;
        const newZone = {
            id,
            name: dto.name,
            type: dto.type,
            polygon: dto.polygon,
            capacity: dto.capacity,
            surgeSpeedThresholdKmH: dto.surgeSpeedThresholdKmH ?? 6.0,
            densityWarningThreshold: dto.densityWarningThreshold ?? 80,
            color: dto.color ?? '#8b5cf6',
            description: dto.description ?? '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db.collection('zones').doc(id).set(newZone);
        }
        this.localZones.set(id, newZone);
        return newZone;
    }
    async updateZone(id, dto) {
        const existing = await this.getZoneById(id);
        if (!existing)
            return null;
        const updated = {
            ...existing,
            ...dto,
            id, // Immutable ID
            updatedAt: new Date().toISOString(),
        };
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db.collection('zones').doc(id).set(updated, { merge: true });
        }
        this.localZones.set(id, updated);
        return updated;
    }
    async deleteZone(id) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db.collection('zones').doc(id).delete();
        }
        return this.localZones.delete(id);
    }
}
exports.zoneRepository = new ZoneRepository();
//# sourceMappingURL=zoneRepository.js.map