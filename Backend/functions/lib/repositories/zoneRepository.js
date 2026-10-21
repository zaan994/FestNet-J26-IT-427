"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zoneRepository = void 0;
const firebase_1 = require("../config/firebase");
// Initial festival zones around the test GPS coordinates (~7.119° N, 80.047° E)
const DEFAULT_ZONES = [
    {
        id: 'ZONE-MAIN-STAGE',
        name: 'Main Stage Arena',
        type: 'STAGE',
        polygon: [
            { lat: 7.119800, lng: 80.046800 },
            { lat: 7.120200, lng: 80.048200 },
            { lat: 7.118900, lng: 80.048500 },
            { lat: 7.118600, lng: 80.047000 },
        ],
        capacity: 2500,
        surgeSpeedThresholdKmH: 6.0,
        densityWarningThreshold: 80,
        color: '#ef4444',
        description: 'Central concert stage and standing grounds',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'ZONE-EXIT-NORTH',
        name: 'North Ingress / Egress Gate',
        type: 'EXIT',
        polygon: [
            { lat: 7.120300, lng: 80.046500 },
            { lat: 7.120800, lng: 80.047500 },
            { lat: 7.120100, lng: 80.047800 },
            { lat: 7.119700, lng: 80.046700 },
        ],
        capacity: 1000,
        surgeSpeedThresholdKmH: 5.5,
        densityWarningThreshold: 75,
        color: '#f59e0b',
        description: 'Main pedestrian pathway to exit gates',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'ZONE-FIRST-AID',
        name: 'Medical & First Aid Hub',
        type: 'FIRST_AID',
        polygon: [
            { lat: 7.118500, lng: 80.046000 },
            { lat: 7.118800, lng: 80.046700 },
            { lat: 7.118000, lng: 80.046800 },
            { lat: 7.117900, lng: 80.046100 },
        ],
        capacity: 300,
        surgeSpeedThresholdKmH: 4.5,
        densityWarningThreshold: 85,
        color: '#10b981',
        description: 'Emergency response command and triage tent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'ZONE-FOOD-REST',
        name: 'Food & Wellness Village',
        type: 'FOOD_BEVERAGE',
        polygon: [
            { lat: 7.117800, lng: 80.047000 },
            { lat: 7.118400, lng: 80.048300 },
            { lat: 7.117200, lng: 80.048400 },
            { lat: 7.117000, lng: 80.047200 },
        ],
        capacity: 1500,
        surgeSpeedThresholdKmH: 5.0,
        densityWarningThreshold: 80,
        color: '#3b82f6',
        description: 'Hydration stations, food stalls and seating',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];
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