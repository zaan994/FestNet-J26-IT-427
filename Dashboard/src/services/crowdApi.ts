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

// Fallback zones around test coordinates (Sri Lanka 7.119° N, 80.047° E)
function getFallbackZones(): EventZone[] {
  return [
    {
      id: 'ZONE-MAIN-STAGE',
      name: 'Main Stage Arena',
      type: 'STAGE',
      polygon: [
        { lat: 7.119800, lng: 80.046800 },
        { lat: 7.120200, lng: 80.048200 },
        { lat: 7.118900, lng: 80.048500 },
        { lat: 7.118600, lng: 80.047000 },
      ],
      capacity: 2500,
      surgeSpeedThresholdKmH: 6.0,
      densityWarningThreshold: 80,
      color: '#ef4444',
      description: 'Central concert stage and standing grounds',
    },
    {
      id: 'ZONE-EXIT-NORTH',
      name: 'North Ingress / Egress Gate',
      type: 'EXIT',
      polygon: [
        { lat: 7.120300, lng: 80.046500 },
        { lat: 7.120800, lng: 80.047500 },
        { lat: 7.120100, lng: 80.047800 },
        { lat: 7.119700, lng: 80.046700 },
      ],
      capacity: 1000,
      surgeSpeedThresholdKmH: 5.5,
      densityWarningThreshold: 75,
      color: '#f59e0b',
      description: 'Main pedestrian pathway to exit gates',
    },
    {
      id: 'ZONE-FIRST-AID',
      name: 'Medical & First Aid Hub',
      type: 'FIRST_AID',
      polygon: [
        { lat: 7.118500, lng: 80.046000 },
        { lat: 7.118800, lng: 80.046700 },
        { lat: 7.118000, lng: 80.046800 },
        { lat: 7.117900, lng: 80.046100 },
      ],
      capacity: 300,
      surgeSpeedThresholdKmH: 4.5,
      densityWarningThreshold: 85,
      color: '#10b981',
      description: 'Emergency response command and triage tent',
    },
    {
      id: 'ZONE-FOOD-REST',
      name: 'Food & Wellness Village',
      type: 'FOOD_BEVERAGE',
      polygon: [
        { lat: 7.117800, lng: 80.047000 },
        { lat: 7.118400, lng: 80.048300 },
        { lat: 7.117200, lng: 80.048400 },
        { lat: 7.117000, lng: 80.047200 },
      ],
      capacity: 1500,
      surgeSpeedThresholdKmH: 5.0,
      densityWarningThreshold: 80,
      color: '#3b82f6',
      description: 'Hydration stations, food stalls and seating',
    },
  ];
}
