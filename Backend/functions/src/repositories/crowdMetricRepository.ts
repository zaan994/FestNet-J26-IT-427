import { CrowdMetric } from '../types/crowd';
import { getFirestoreDB, isUsingCloudFirestore } from '../config/firebase';

class CrowdMetricRepository {
  private latestMetricsByZone: Map<string, CrowdMetric> = new Map();

  async saveMetric(metric: CrowdMetric): Promise<void> {
    this.latestMetricsByZone.set(metric.zoneId, metric);

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db.collection('crowd_metrics').doc(metric.zoneId).set(metric);
    }
  }

  async getAllMetrics(): Promise<CrowdMetric[]> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const snapshot = await db.collection('crowd_metrics').get();
      if (!snapshot.empty) {
        return snapshot.docs.map((d) => d.data() as CrowdMetric);
      }
    }
    return Array.from(this.latestMetricsByZone.values());
  }

  async getMetricByZoneId(zoneId: string): Promise<CrowdMetric | null> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const doc = await db.collection('crowd_metrics').doc(zoneId).get();
      if (doc.exists) {
        return doc.data() as CrowdMetric;
      }
    }
    return this.latestMetricsByZone.get(zoneId) || null;
  }
}

export const crowdMetricRepository = new CrowdMetricRepository();
