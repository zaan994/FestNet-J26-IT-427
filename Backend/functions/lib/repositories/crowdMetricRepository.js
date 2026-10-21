"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crowdMetricRepository = void 0;
const firebase_1 = require("../config/firebase");
class CrowdMetricRepository {
    latestMetricsByZone = new Map();
    async saveMetric(metric) {
        this.latestMetricsByZone.set(metric.zoneId, metric);
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db.collection('crowd_metrics').doc(metric.zoneId).set(metric);
        }
    }
    async getAllMetrics() {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const snapshot = await db.collection('crowd_metrics').get();
            if (!snapshot.empty) {
                return snapshot.docs.map((d) => d.data());
            }
        }
        return Array.from(this.latestMetricsByZone.values());
    }
    async getMetricByZoneId(zoneId) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const doc = await db.collection('crowd_metrics').doc(zoneId).get();
            if (doc.exists) {
                return doc.data();
            }
        }
        return this.latestMetricsByZone.get(zoneId) || null;
    }
}
exports.crowdMetricRepository = new CrowdMetricRepository();
//# sourceMappingURL=crowdMetricRepository.js.map