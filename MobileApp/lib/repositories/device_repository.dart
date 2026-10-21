import '../core/constants/db_paths.dart';
import '../models/device_health.dart';
import '../models/device_latest.dart';
import '../models/json_utils.dart';
import '../services/database_service.dart';

/// Read-only access to the attendee's OWN band (the rules deny every other band).
class DeviceRepository {
  DeviceRepository(this._db);

  final DatabaseService _db;

  /// Live `latest` snapshots. The first event is the cached value (receivedAt = null);
  /// later events are fresh uploads (receivedAt = now).
  Stream<DeviceSnapshot> watchLatest(String deviceId) async* {
    var first = true;
    DateTime? lastReceived;
    await for (final event in _db.ref(DbPaths.deviceLatest(deviceId)).onValue) {
      final value = event.snapshot.value;
      if (!first) lastReceived = DateTime.now();
      first = false;
      yield DeviceSnapshot(latest: value == null ? null : DeviceLatest.fromMap(asMap(value)), receivedAt: lastReceived);
    }
  }

  /// Derived health from the backend — null until processed.
  Stream<DeviceHealth?> watchHealth(String deviceId) {
    return _db.ref(DbPaths.deviceHealth(deviceId)).onValue.map((event) {
      final value = event.snapshot.value;
      return value == null ? null : DeviceHealth.fromMap(asMap(value));
    });
  }

  /// History of ONE assignment in a time window, capped (10 s resolution → 1 h = 360 points).
  Stream<List<HistoryPoint>> watchHistory(String assignmentId, Duration window, {int maxPoints = 400}) {
    final from = DateTime.now().subtract(window).millisecondsSinceEpoch;
    final query = _db.ref(DbPaths.healthHistory(assignmentId)).orderByChild('ts').startAt(from).limitToLast(maxPoints);
    return query.onValue.map((event) {
      final points = event.snapshot.children.map((c) => HistoryPoint.fromMap(asMap(c.value))).whereType<HistoryPoint>().toList()
        ..sort((a, b) => a.ts.compareTo(b.ts));
      return points;
    });
  }
}
