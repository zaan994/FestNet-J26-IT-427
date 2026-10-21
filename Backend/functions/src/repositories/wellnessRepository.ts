import { HeatStressReading, HydrationLog, HydrationReminder } from '../types/wellness';
import { getFirestoreDB, isUsingCloudFirestore } from '../config/firebase';

class WellnessRepository {
  // In-memory stores (keyed by deviceId)
  private heatStressHistory: Map<string, HeatStressReading[]> = new Map();
  private hydrationLogs: Map<string, HydrationLog[]> = new Map();
  private reminderState: Map<string, HydrationReminder> = new Map();

  // ─── Heat Stress ───────────────────────────────────────────────────────────

  async saveHeatStressReading(reading: HeatStressReading): Promise<void> {
    const { deviceId } = reading;
    const history = this.heatStressHistory.get(deviceId) || [];
    history.push(reading);
    // Keep last 500 readings per device
    if (history.length > 500) history.shift();
    this.heatStressHistory.set(deviceId, history);

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db
        .collection('wellness_readings')
        .doc(deviceId)
        .collection('readings')
        .doc(reading.id)
        .set(reading);
    }
  }

  async getHeatStressHistory(deviceId: string, limitMinutes: number = 60): Promise<HeatStressReading[]> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const cutoff = new Date(Date.now() - limitMinutes * 60 * 1000).toISOString();
      const snap = await db
        .collection('wellness_readings')
        .doc(deviceId)
        .collection('readings')
        .where('timestamp', '>=', cutoff)
        .orderBy('timestamp', 'asc')
        .get();
      return snap.docs.map(d => d.data() as HeatStressReading);
    }

    const cutoffTime = Date.now() - limitMinutes * 60 * 1000;
    const history = this.heatStressHistory.get(deviceId) || [];
    return history.filter(r => new Date(r.timestamp).getTime() >= cutoffTime);
  }

  async getLatestHeatStressReading(deviceId: string): Promise<HeatStressReading | null> {
    const history = this.heatStressHistory.get(deviceId) || [];
    return history.length > 0 ? history[history.length - 1] : null;
  }

  getAllDevicesWithReadings(): string[] {
    return Array.from(this.heatStressHistory.keys());
  }

  // ─── Hydration Logs ───────────────────────────────────────────────────────

  async saveHydrationLog(log: HydrationLog): Promise<void> {
    const { deviceId } = log;
    const logs = this.hydrationLogs.get(deviceId) || [];
    logs.push(log);
    if (logs.length > 500) logs.shift();
    this.hydrationLogs.set(deviceId, logs);

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db
        .collection('hydration_logs')
        .doc(deviceId)
        .collection('logs')
        .doc(log.id)
        .set(log);
    }
  }

  async getHydrationLogs(deviceId: string, sinceHours: number = 24): Promise<HydrationLog[]> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
      const snap = await db
        .collection('hydration_logs')
        .doc(deviceId)
        .collection('logs')
        .where('timestamp', '>=', cutoff)
        .orderBy('timestamp', 'asc')
        .get();
      return snap.docs.map(d => d.data() as HydrationLog);
    }

    const cutoffTime = Date.now() - sinceHours * 60 * 60 * 1000;
    const logs = this.hydrationLogs.get(deviceId) || [];
    return logs.filter(l => new Date(l.timestamp).getTime() >= cutoffTime);
  }

  // ─── Reminder State ───────────────────────────────────────────────────────

  async saveReminderState(reminder: HydrationReminder): Promise<void> {
    this.reminderState.set(reminder.deviceId, reminder);

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db
        .collection('hydration_reminders')
        .doc(reminder.deviceId)
        .set(reminder);
    }
  }

  async getReminderState(deviceId: string): Promise<HydrationReminder | null> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const doc = await db.collection('hydration_reminders').doc(deviceId).get();
      if (doc.exists) return doc.data() as HydrationReminder;
    }
    return this.reminderState.get(deviceId) || null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  async clearAll(): Promise<void> {
    this.heatStressHistory.clear();
    this.hydrationLogs.clear();
    this.reminderState.clear();
  }
}

export const wellnessRepository = new WellnessRepository();
