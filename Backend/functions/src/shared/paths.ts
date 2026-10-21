/** Realtime Database paths (pure module, shared with Dashboard and scripts). */

export const DB_ROOT = "festnet";

export const paths = {
  config: () => `${DB_ROOT}/config`,
  thresholds: () => `${DB_ROOT}/config/thresholds`,
  hriConfig: () => `${DB_ROOT}/config/hri`,

  // ---- roles ----
  roles: (uid: string) => `${DB_ROOT}/roles/${uid}`,
  allRoles: () => `${DB_ROOT}/roles`,
  eventStaff: (eventId: string) => `${DB_ROOT}/eventStaff/${eventId}`,
  staffEvents: (uid: string) => `${DB_ROOT}/staffEvents/${uid}`,
  users: () => `${DB_ROOT}/users`,
  user: (uid: string) => `${DB_ROOT}/users/${uid}`,

  // ---- band (firmware contract — do not rename) ----
  deviceAuth: (authUid: string) => `${DB_ROOT}/deviceAuth/${authUid}`,
  devices: () => `${DB_ROOT}/devices`,
  device: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}`,
  deviceLatest: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/latest`,
  deviceRaw: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/raw`,
  deviceMeta: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/meta`,
  /** Backend output: current derived health + HRI. */
  deviceHealth: (deviceId: string) => `${DB_ROOT}/devices/${deviceId}/health`,

  // ---- inventory / events / assignments ----
  deviceIndex: () => `${DB_ROOT}/deviceIndex`,
  deviceIndexEntry: (deviceId: string) => `${DB_ROOT}/deviceIndex/${deviceId}`,
  events: () => `${DB_ROOT}/events`,
  event: (eventId: string) => `${DB_ROOT}/events/${eventId}`,
  eventPublic: (eventId: string) => `${DB_ROOT}/eventsPublic/${eventId}`,
  participants: (eventId: string) => `${DB_ROOT}/participants/${eventId}`,
  participant: (eventId: string, participantId: string) => `${DB_ROOT}/participants/${eventId}/${participantId}`,
  assignments: () => `${DB_ROOT}/assignments`,
  assignment: (assignmentId: string) => `${DB_ROOT}/assignments/${assignmentId}`,
  eventAssignments: (eventId: string) => `${DB_ROOT}/eventAssignments/${eventId}`,
  attendeeLink: (uid: string) => `${DB_ROOT}/attendeeLinks/${uid}`,
  claimCode: (codeHash: string) => `${DB_ROOT}/claimCodes/${codeHash}`,

  // ---- per-assignment derived history (never mixed across events) ----
  healthHistory: (assignmentId: string) => `${DB_ROOT}/healthHistory/${assignmentId}`,
  assignmentStats: (assignmentId: string) => `${DB_ROOT}/assignmentStats/${assignmentId}`,

  // ---- emergencies ----
  emergencies: (eventId: string) => `${DB_ROOT}/emergencies/${eventId}`,
  emergency: (eventId: string, alertId: string) => `${DB_ROOT}/emergencies/${eventId}/${alertId}`,
  emergencyAudit: (eventId: string, alertId: string) => `${DB_ROOT}/emergencyAudit/${eventId}/${alertId}`,
  emergencyKey: (key: string) => `${DB_ROOT}/emergencyKeys/${key}`,

  // ---- C2 Emergency Alert System (alerts themselves stay in emergencies/{eventId}) ----
  c2Config: () => `${DB_ROOT}/config/c2`,
  eventVolunteers: (eventId: string) => `${DB_ROOT}/eventVolunteers/${eventId}`,
  volunteerEvents: (uid: string) => `${DB_ROOT}/volunteerEvents/${uid}`,
  /** Backend only: open (not yet acknowledged) alerts, indexed by escalationDueAt. */
  openAlerts: () => `${DB_ROOT}/emergency/openAlerts`,
  openAlert: (alertId: string) => `${DB_ROOT}/emergency/openAlerts/${alertId}`,
  /** Backend only: per-device dedupe / cooldown / trend state. */
  deviceAlertState: (deviceId: string) => `${DB_ROOT}/emergency/deviceAlertState/${deviceId}`,
  /** Backend only: exactly-once notification rounds. */
  dispatchLock: (alertId: string, phase: string) => `${DB_ROOT}/emergency/dispatchLocks/${alertId}/${phase}`,
  /** Backend only: who was sent an alert (uid → role), to keep inboxes in sync. */
  alertRecipients: (alertId: string) => `${DB_ROOT}/emergency/recipients/${alertId}`,
  dispatchLog: (eventId: string, alertId: string) => `${DB_ROOT}/emergency/dispatch/${eventId}/${alertId}`,
  inbox: (uid: string) => `${DB_ROOT}/emergency/inbox/${uid}`,
  inboxEntry: (uid: string, alertId: string) => `${DB_ROOT}/emergency/inbox/${uid}/${alertId}`,
  responders: () => `${DB_ROOT}/emergency/responders`,
  responder: (uid: string) => `${DB_ROOT}/emergency/responders/${uid}`,
  watch: (eventId: string) => `${DB_ROOT}/emergency/watch/${eventId}`,
  watchEntry: (eventId: string, deviceId: string) => `${DB_ROOT}/emergency/watch/${eventId}/${deviceId}`,

  // ---- requests from clients (validated by the backend) ----
  commands: (uid: string) => `${DB_ROOT}/commands/${uid}`,
  command: (uid: string, commandId: string) => `${DB_ROOT}/commands/${uid}/${commandId}`,
  sosRequests: (uid: string) => `${DB_ROOT}/sosRequests/${uid}`,
  claimRequests: (uid: string) => `${DB_ROOT}/claimRequests/${uid}`,

  // ---- audit / research ----
  auditLog: (scope: string) => `${DB_ROOT}/auditLog/${scope}`,
  researchExport: (exportId: string) => `${DB_ROOT}/researchExports/${exportId}`,
  researchExports: () => `${DB_ROOT}/researchExports`,

  /** C1 processor state per band — backend only (no client access in the rules). */
  processingState: (deviceId: string) => `${DB_ROOT}/processing/${deviceId}`,
} as const;
