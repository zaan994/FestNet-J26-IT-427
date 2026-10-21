import { EventZone, CreateZoneDTO, UpdateZoneDTO } from '../types/zone';
import { getFirestoreDB, isUsingCloudFirestore } from '../config/firebase';

// Initial festival zones (empty by default - custom zones created dynamically via dashboard)
const DEFAULT_ZONES: EventZone[] = [];

class ZoneRepository {
  private localZones: Map<string, EventZone> = new Map();

  constructor() {
    for (const z of DEFAULT_ZONES) {
      this.localZones.set(z.id, z);
    }
  }

  async getAllZones(): Promise<EventZone[]> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const snapshot = await db.collection('zones').get();
      if (!snapshot.empty) {
        return snapshot.docs.map((d) => d.data() as EventZone);
      }
    }
    return Array.from(this.localZones.values());
  }

  async getZoneById(id: string): Promise<EventZone | null> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      const doc = await db.collection('zones').doc(id).get();
      if (doc.exists) {
        return doc.data() as EventZone;
      }
    }
    return this.localZones.get(id) || null;
  }

  async createZone(dto: CreateZoneDTO): Promise<EventZone> {
    const id = dto.id || `ZONE-${Date.now()}`;
    const newZone: EventZone = {
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

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db.collection('zones').doc(id).set(newZone);
    }

    this.localZones.set(id, newZone);
    return newZone;
  }

  async updateZone(id: string, dto: UpdateZoneDTO): Promise<EventZone | null> {
    const existing = await this.getZoneById(id);
    if (!existing) return null;

    const updated: EventZone = {
      ...existing,
      ...dto,
      id, // Immutable ID
      updatedAt: new Date().toISOString(),
    };

    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db.collection('zones').doc(id).set(updated, { merge: true });
    }

    this.localZones.set(id, updated);
    return updated;
  }

  async deleteZone(id: string): Promise<boolean> {
    if (isUsingCloudFirestore()) {
      const db = getFirestoreDB()!;
      await db.collection('zones').doc(id).delete();
    }
    return this.localZones.delete(id);
  }
}

export const zoneRepository = new ZoneRepository();
