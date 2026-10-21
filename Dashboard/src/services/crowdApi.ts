import { EventZone, CrowdMetric, DeviceLocation, SurgeAlert } from '../types';

const API_BASE_URL = 'http://localhost:5001/api';

export const crowdApi = {
  async getZones(): Promise<EventZone[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/zones`);
      if (!res.ok) throw new Error('Failed to fetch zones');
      const json = await res.json();
      return json.data || [];
    } catch {
      return getFallbackZones();
    }
  },

  async createZone(zoneData: Partial<EventZone>): Promise<EventZone> {
    const res = await fetch(`${API_BASE_URL}/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zoneData),
    });
    const json = await res.json();
    return json.data;
  },

  async deleteZone(zoneId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/zones/${zoneId}`, {
      method: 'DELETE',
    });
  },

  async getCrowdMetrics(): Promise<CrowdMetric[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/crowd/metrics`);
      if (!res.ok) throw new Error('Failed to fetch crowd metrics');
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getLiveDevices(): Promise<DeviceLocation[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/live`);
      if (!res.ok) throw new Error('Failed to fetch live devices');
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getAlerts(): Promise<SurgeAlert[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts`);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async resolveAlert(alertId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve`, {
      method: 'POST',
    });
  },
};

// Fallback zones (empty by default - zones created dynamically)
function getFallbackZones(): EventZone[] {
  return [];
}
