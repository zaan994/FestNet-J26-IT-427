"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wellnessRepository = void 0;
const firebase_1 = require("../config/firebase");
class WellnessRepository {
    // In-memory stores (keyed by deviceId)
    heatStressHistory = new Map();
    hydrationLogs = new Map();
    reminderState = new Map();
    // ─── Heat Stress ───────────────────────────────────────────────────────────
    async saveHeatStressReading(reading) {
        const { deviceId } = reading;
        const history = this.heatStressHistory.get(deviceId) || [];
        history.push(reading);
        // Keep last 500 readings per device
        if (history.length > 500)
            history.shift();
        this.heatStressHistory.set(deviceId, history);
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db
                .collection('wellness_readings')
                .doc(deviceId)
                .collection('readings')
                .doc(reading.id)
                .set(reading);
        }
    }
    async getHeatStressHistory(deviceId, limitMinutes = 60) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const cutoff = new Date(Date.now() - limitMinutes * 60 * 1000).toISOString();
            const snap = await db
                .collection('wellness_readings')
                .doc(deviceId)
                .collection('readings')
                .where('timestamp', '>=', cutoff)
                .orderBy('timestamp', 'asc')
                .get();
            return snap.docs.map(d => d.data());
        }
        const cutoffTime = Date.now() - limitMinutes * 60 * 1000;
        const history = this.heatStressHistory.get(deviceId) || [];
        return history.filter(r => new Date(r.timestamp).getTime() >= cutoffTime);
    }
    async getLatestHeatStressReading(deviceId) {
        const history = this.heatStressHistory.get(deviceId) || [];
        return history.length > 0 ? history[history.length - 1] : null;
    }
    getAllDevicesWithReadings() {
        return Array.from(this.heatStressHistory.keys());
    }
    // ─── Hydration Logs ───────────────────────────────────────────────────────
    async saveHydrationLog(log) {
        const { deviceId } = log;
        const logs = this.hydrationLogs.get(deviceId) || [];
        logs.push(log);
        if (logs.length > 500)
            logs.shift();
        this.hydrationLogs.set(deviceId, logs);
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db
                .collection('hydration_logs')
                .doc(deviceId)
                .collection('logs')
                .doc(log.id)
                .set(log);
        }
    }
    async getHydrationLogs(deviceId, sinceHours = 24) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
            const snap = await db
                .collection('hydration_logs')
                .doc(deviceId)
                .collection('logs')
                .where('timestamp', '>=', cutoff)
                .orderBy('timestamp', 'asc')
                .get();
            return snap.docs.map(d => d.data());
        }
        const cutoffTime = Date.now() - sinceHours * 60 * 60 * 1000;
        const logs = this.hydrationLogs.get(deviceId) || [];
        return logs.filter(l => new Date(l.timestamp).getTime() >= cutoffTime);
    }
    // ─── Reminder State ───────────────────────────────────────────────────────
    async saveReminderState(reminder) {
        this.reminderState.set(reminder.deviceId, reminder);
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            await db
                .collection('hydration_reminders')
                .doc(reminder.deviceId)
                .set(reminder);
        }
    }
    async getReminderState(deviceId) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const doc = await db.collection('hydration_reminders').doc(deviceId).get();
            if (doc.exists)
                return doc.data();
        }
        return this.reminderState.get(deviceId) || null;
    }
    // ─── Helpers ─────────────────────────────────────────────────────────────
    async clearAll() {
        this.heatStressHistory.clear();
        this.hydrationLogs.clear();
        this.reminderState.clear();
    }
}
exports.wellnessRepository = new WellnessRepository();
//# sourceMappingURL=wellnessRepository.js.map