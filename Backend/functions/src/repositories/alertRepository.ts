import { SurgeAlert, AlertStatus } from '../types/alert';
import { getFirestoreDB, isUsingCloudFirestore } from '../config/firebase';

class AlertRepository {
  private alerts: Map<string, SurgeAlert> = new Map();

  async createAlert(alert: SurgeAlert): Promise<SurgeAlert> {
    this.alerts.set(alert.id, alert);

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db.collection('alerts').doc(alert.id).set(alert);
    }

    return alert;
  }

  async getAllAlerts(limitCount: number = 50): Promise<SurgeAlert[]> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const snapshot = await db
        .collection('alerts')
        .orderBy('timestamp', 'desc')
        .limit(limitCount)
        .get();
      if (!snapshot.empty) {
        return snapshot.docs.map((d) => d.data() as SurgeAlert);
      }
    }

    return Array.from(this.alerts.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitCount);
  }

  async getActiveAlerts(): Promise<SurgeAlert[]> {
    const all = await this.getAllAlerts(100);
    return all.filter((a) => a.status === 'ACTIVE');
  }

  async getLatestAlertForZone(zoneId: string): Promise<SurgeAlert | null> {
    const all = await this.getAllAlerts(100);
    return all.find((a) => a.zoneId === zoneId && a.status === 'ACTIVE') || null;
  }

  async updateAlertStatus(
    id: string,
    status: AlertStatus,
    updatedBy?: string
  ): Promise<SurgeAlert | null> {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    alert.status = status;
    if (status === 'ACKNOWLEDGED' && updatedBy) {
      alert.acknowledgedBy = updatedBy;
    }
    if (status === 'RESOLVED') {
      alert.resolvedAt = new Date().toISOString();
    }

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db.collection('alerts').doc(id).set(alert, { merge: true });
    }

    return alert;
  }
}

export const alertRepository = new AlertRepository();
