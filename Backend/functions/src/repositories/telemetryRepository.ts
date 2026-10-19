import { DeviceTelemetry } from '../types/telemetry';
import { getFirestoreDB, isUsingCloudFirestore } from '../config/firebase';
import { CONFIG } from '../config/constants';

class TelemetryRepository {
  private latestTelemetry: Map<string, DeviceTelemetry> = new Map();
  private historyByDevice: Map<string, DeviceTelemetry[]> = new Map();

  async saveTelemetry(telemetry: DeviceTelemetry): Promise<void> {
    const { deviceId } = telemetry;
    this.latestTelemetry.set(deviceId, telemetry);

    // Maintain recent history buffer (last 50 pings per device)
    const history = this.historyByDevice.get(deviceId) || [];
    history.push(telemetry);
    if (history.length > 50) {
      history.shift();
    }
    this.historyByDevice.set(deviceId, history);

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
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

  async getLatestTelemetry(deviceId: string): Promise<DeviceTelemetry | null> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const doc = await db.collection('device_telemetry').doc(deviceId).get();
      if (doc.exists) {
        return doc.data() as DeviceTelemetry;
      }
    }
    return this.latestTelemetry.get(deviceId) || null;
  }

  async getAllActiveDevices(stalenessSeconds: number = CONFIG.DATA_STALENESS_SECONDS): Promise<DeviceTelemetry[]> {
    const now = Date.now();
    const thresholdMs = stalenessSeconds * 1000;

    const active: DeviceTelemetry[] = [];

    for (const item of this.latestTelemetry.values()) {
      const pingTime = new Date(item.timestamp).getTime();
      if (!isNaN(pingTime) && now - pingTime <= thresholdMs) {
        active.push(item);
      }
    }

    return active;
  }

  async getAllDevices(): Promise<DeviceTelemetry[]> {
    return Array.from(this.latestTelemetry.values());
  }

  async getDeviceHistory(deviceId: string, limit: number = 20): Promise<DeviceTelemetry[]> {
    const list = this.historyByDevice.get(deviceId) || [];
    return list.slice(-limit);
  }

  async clearAll(): Promise<void> {
    this.latestTelemetry.clear();
    this.historyByDevice.clear();
  }
}

export const telemetryRepository = new TelemetryRepository();
