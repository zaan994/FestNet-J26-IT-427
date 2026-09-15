import '../core/constants/db_paths.dart';
import '../core/errors/app_exception.dart';
import '../models/json_utils.dart';
import '../models/user_profile.dart';
import '../services/database_service.dart';

class UserRepository {
  UserRepository(this._db);

  final DatabaseService _db;

  Stream<UserProfile?> watchProfile(String uid) {
    return _db.ref(DbPaths.user(uid)).onValue.map((event) {
      final value = event.snapshot.value;
      return value == null ? null : UserProfile.fromMap(uid, asMap(value));
    });
  }

  /// New self-registered accounts are always participants (enforced by security rules).
  Future<void> createParticipantProfile({required String uid, required String name, required String email}) {
    return _db.ref(DbPaths.user(uid)).set({
      'name': name,
      'email': email,
      'role': 'participant',
      'deviceId': null,
      'fcmToken': null,
      'createdAt': DatabaseService.serverTimestamp,
    });
  }

  /// Links a band to the user: users/{uid}/deviceId + devices/{id}/meta/ownerUid.
  Future<void> pairDevice({required String uid, required String deviceId}) async {
    final id = deviceId.trim().toUpperCase();
    final indexEntry = await _db.ref(DbPaths.deviceIndexEntry(id)).get();
    if (!indexEntry.exists) {
      throw AppException('Band "$id" is not registered. Ask an organiser to add it.');
    }
    try {
      await _db.ref('${DbPaths.deviceMeta(id)}/ownerUid').set(uid);
    } catch (_) {
      throw AppException('Band "$id" is already paired with another account.');
    }
    await _db.ref(DbPaths.user(uid)).update({'deviceId': id});
  }

  Future<void> unpairDevice({required String uid, required String deviceId}) async {
    await _db.ref('${DbPaths.deviceMeta(deviceId)}/ownerUid').remove();
    await _db.ref(DbPaths.user(uid)).update({'deviceId': null});
  }
}
