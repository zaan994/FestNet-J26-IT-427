import '../core/constants/db_paths.dart';
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
}
