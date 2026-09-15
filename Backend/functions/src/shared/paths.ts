/** Realtime Database paths (pure module, shared with Dashboard and scripts). */

export const DB_ROOT = "festnet";

export const paths = {
  config: () => `${DB_ROOT}/config`,
  thresholds: () => `${DB_ROOT}/config/thresholds`,

  deviceAuth: (authUid: string) => `${DB_ROOT}/deviceAuth/${authUid}`,
  deviceIndex: () => `${DB_ROOT}/deviceIndex`,
  deviceIndexEntry: (deviceId: string) => `${DB_ROOT}/deviceIndex/${deviceId}`,

  devices: () => `${DB_ROOT}/devices`,
  device: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}`,
  deviceLatest: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/latest`,
  deviceHistory: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/history`,
  deviceLocation: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/location`,
  deviceMeta: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/meta`,

  users: () => `${DB_ROOT}/users`,
  user: (uid: string) => `${DB_ROOT}/users/${uid}`,

  alerts: () => `${DB_ROOT}/alerts`,
  alert: (alertId: string) => `${DB_ROOT}/alerts/${alertId}`,

  events: () => `${DB_ROOT}/events`,
  event: (eventId: string) => `${DB_ROOT}/events/${eventId}`,
  eventZones: (eventId: string) => `${DB_ROOT}/events/${eventId}/zones`,

  wellness: (uid: string) => `${DB_ROOT}/wellness/${uid}`,
  hydrationLog: (uid: string) => `${DB_ROOT}/wellness/${uid}/hydrationLog`,
  heatStress: (uid: string) => `${DB_ROOT}/wellness/${uid}/heatStress`,
} as const;
