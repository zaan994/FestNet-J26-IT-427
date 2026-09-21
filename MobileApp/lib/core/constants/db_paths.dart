/// Realtime Database paths — mirrors Backend/functions/src/shared/paths.ts
/// and docs/database/schema.md.
class DbPaths {
  DbPaths._();

  static const root = 'festnet';

  static String thresholds() => '$root/config/thresholds';

  static String deviceIndex() => '$root/deviceIndex';
  static String deviceIndexEntry(String deviceId) => '$root/deviceIndex/$deviceId';

  static String device(String deviceId) => '$root/devices/$deviceId';
  static String deviceLatest(String deviceId) => '$root/devices/$deviceId/latest';
  static String deviceHealth(String deviceId) => '$root/devices/$deviceId/health';
  static String deviceHistory(String deviceId) => '$root/devices/$deviceId/history';
  static String deviceMeta(String deviceId) => '$root/devices/$deviceId/meta';

  static String user(String uid) => '$root/users/$uid';

  static String alerts() => '$root/alerts';
  static String events() => '$root/events';
  static String wellness(String uid) => '$root/wellness/$uid';
}
