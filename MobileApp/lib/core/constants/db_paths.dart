/// Realtime Database paths used by the attendee app — mirrors
/// Backend/functions/src/shared/paths.ts. The app only reads its own data
/// (enforced by database.rules.json).
class DbPaths {
  DbPaths._();

  static const root = 'festnet';

  static String thresholds() => '$root/config/thresholds';
  static String user(String uid) => '$root/users/$uid';

  // Own device (readable only while attendeeLinks/{uid} points at it)
  static String deviceLatest(String deviceId) => '$root/devices/$deviceId/latest';
  static String deviceHealth(String deviceId) => '$root/devices/$deviceId/health';

  // Own assignment
  static String attendeeLink(String uid) => '$root/attendeeLinks/$uid';
  static String healthHistory(String assignmentId) => '$root/healthHistory/$assignmentId';
  static String eventPublic(String eventId) => '$root/eventsPublic/$eventId';

  // Requests validated by the trusted backend
  static String sosRequests(String uid) => '$root/sosRequests/$uid';
  static String claimRequests(String uid) => '$root/claimRequests/$uid';
  static String commands(String uid) => '$root/commands/$uid';

  // C2 responders (roles are granted server-side; the app only reads them)
  static String staffEvents(String uid) => '$root/staffEvents/$uid';
  static String volunteerEvents(String uid) => '$root/volunteerEvents/$uid';
  static String responder(String uid) => '$root/emergency/responders/$uid';
  static String inbox(String uid) => '$root/emergency/inbox/$uid';
}
