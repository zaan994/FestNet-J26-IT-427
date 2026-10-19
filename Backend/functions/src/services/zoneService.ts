import { EventZone, CreateZoneDTO, UpdateZoneDTO } from '../types/zone';
import { DeviceTelemetry } from '../types/telemetry';
import { zoneRepository } from '../repositories/zoneRepository';
import { isPointInPolygon } from '../utils/geoMath';

class ZoneService {
  async getAllZones(): Promise<EventZone[]> {
    return zoneRepository.getAllZones();
  }

  async getZoneById(id: string): Promise<EventZone | null> {
    return zoneRepository.getZoneById(id);
  }

  async createZone(dto: CreateZoneDTO): Promise<EventZone> {
    return zoneRepository.createZone(dto);
  }

  async updateZone(id: string, dto: UpdateZoneDTO): Promise<EventZone | null> {
    return zoneRepository.updateZone(id, dto);
  }

  async deleteZone(id: string): Promise<boolean> {
    return zoneRepository.deleteZone(id);
  }

  /**
   * Identifies which digital event zone polygon (if any) contains the given GPS coordinates.
   */
  async findZoneForPoint(lat: number, lng: number): Promise<EventZone | null> {
    const zones = await this.getAllZones();
    for (const zone of zones) {
      if (isPointInPolygon({ lat, lng }, zone.polygon)) {
        return zone;
      }
    }
    return null;
  }
}

export const zoneService = new ZoneService();
