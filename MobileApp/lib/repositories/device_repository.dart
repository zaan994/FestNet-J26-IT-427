import '../core/constants/db_paths.dart';
import '../models/device_health.dart';
import '../models/device_latest.dart';
import '../models/json_utils.dart';
import '../services/database_service.dart';

class DeviceRepository {
  DeviceRepository(this._db);

  final DatabaseService _db;

  /// Live `latest` snapshots for a band. The first event is the stored value
  /// (receivedAt = null); later events are fresh uploads (receivedAt = now).
  Stream<DeviceSnapshot> watchLatest(String deviceId) async* {
    var first = true;
    DateTime? lastReceived;
    await for (final event in _db.ref(DbPaths.deviceLatest(deviceId)).onValue) {
      final value = event.snapshot.value;
      if (!first) lastReceived = DateTime.now();
      first = false;
      yield DeviceSnapshot(
        latest: value == null ? null : DeviceLatest.fromMap(asMap(value)),
        receivedAt: lastReceived,
      );
    }
  }

  /// Computed vitals + anomaly state (C1 backend), null until the processor has run.
  Stream<DeviceHealth?> watchHealth(String deviceId) {
    return _db.ref(DbPaths.deviceHealth(deviceId)).onValue.map((event) {
      final value = event.snapshot.value;
      return value == null ? null : DeviceHealth.fromMap(asMap(value));
    });
  }

  /// Last [count] history points (10 s apart), oldest first.
  Stream<List<HistoryPoint>> watchHistory(String deviceId, int count) {
    final query = _db.ref(DbPaths.deviceHistory(deviceId)).orderByChild('ts').limitToLast(count);
    return query.onValue.map((event) {
      final points = event.snapshot.children
          .map((child) => HistoryPoint.fromMap(asMap(child.value)))
          .toList()
        ..sort((a, b) => a.ts.compareTo(b.ts));
      return points;
    });
  }
}
