"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertRepository = void 0;
const firebase_1 = require("../config/firebase");
class AlertRepository {
    alerts = new Map();
    async createAlert(alert) {
        this.alerts.set(alert.id, alert);
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db.collection('alerts').doc(alert.id).set(alert);
        }
        return alert;
    }
    async getAllAlerts(limitCount = 50) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const snapshot = await db
                .collection('alerts')
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .get();
            if (!snapshot.empty) {
                return snapshot.docs.map((d) => d.data());
            }
        }
        return Array.from(this.alerts.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limitCount);
    }
    async getActiveAlerts() {
        const all = await this.getAllAlerts(100);
        return all.filter((a) => a.status === 'ACTIVE');
    }
    async getLatestAlertForZone(zoneId) {
        const all = await this.getAllAlerts(100);
        return all.find((a) => a.zoneId === zoneId && a.status === 'ACTIVE') || null;
    }
    async updateAlertStatus(id, status, updatedBy) {
        const alert = this.alerts.get(id);
        if (!alert)
            return null;
        alert.status = status;
        if (status === 'ACKNOWLEDGED' && updatedBy) {
            alert.acknowledgedBy = updatedBy;
        }
        if (status === 'RESOLVED') {
            alert.resolvedAt = new Date().toISOString();
        }
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db.collection('alerts').doc(id).set(alert, { merge: true });
        }
        return alert;
    }
}
exports.alertRepository = new AlertRepository();
//# sourceMappingURL=alertRepository.js.map