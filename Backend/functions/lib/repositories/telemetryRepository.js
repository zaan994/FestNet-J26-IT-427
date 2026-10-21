"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetryRepository = void 0;
const firebase_1 = require("../config/firebase");
const constants_1 = require("../config/constants");
class TelemetryRepository {
    latestTelemetry = new Map();
    historyByDevice = new Map();
    async saveTelemetry(telemetry) {
        const { deviceId } = telemetry;
        this.latestTelemetry.set(deviceId, telemetry);
        // Maintain recent history buffer (last 50 pings per device)
        const history = this.historyByDevice.get(deviceId) || [];
        history.push(telemetry);
        if (history.length > 50) {
            history.shift();
        }
        this.historyByDevice.set(deviceId, history);
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            // Update latest device snapshot
            await db.collection('device_telemetry').doc(deviceId).set(telemetry);
            // Append to historical subcollection
            await db
                .collection('device_telemetry')
                .doc(deviceId)
                .collection('history')
                .add(telemetry);
        }
    }
    async getLatestTelemetry(deviceId) {
        if ((0, firebase_1.isUsingCloudFirestore)()) {
            const db = (0, firebase_1.getFirestoreDB)();
            const doc = await db.collection('device_telemetry').doc(deviceId).get();
            if (doc.exists) {
                return doc.data();
            }
        }
        return this.latestTelemetry.get(deviceId) || null;
    }
    async getAllActiveDevices(stalenessSeconds = constants_1.CONFIG.DATA_STALENESS_SECONDS) {
        const now = Date.now();
        const thresholdMs = stalenessSeconds * 1000;
        const active = [];
        for (const item of this.latestTelemetry.values()) {
            const pingTime = new Date(item.timestamp).getTime();
            if (!isNaN(pingTime) && now - pingTime <= thresholdMs) {
                active.push(item);
            }
        }
        return active;
    }
    async getAllDevices() {
        return Array.from(this.latestTelemetry.values());
    }
    async getDeviceHistory(deviceId, limit = 20) {
        const list = this.historyByDevice.get(deviceId) || [];
        return list.slice(-limit);
    }
    async clearAll() {
        this.latestTelemetry.clear();
        this.historyByDevice.clear();
    }
}
exports.telemetryRepository = new TelemetryRepository();
//# sourceMappingURL=telemetryRepository.js.map