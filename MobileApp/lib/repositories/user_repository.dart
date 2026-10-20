import '../core/constants/db_paths.dart';
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

  /// Creates / updates the profile. Only displayName, email and createdAt are allowed by the
  /// security rules — no health data, device id or role is ever written from the app.
  Future<void> saveProfile({required String uid, required String displayName, String? email}) {
    return _db.ref(DbPaths.user(uid)).update({
      'displayName': displayName,
      if (email != null) 'email': email,
    });
  }

  Future<void> createProfile({required String uid, required String displayName, required String email}) {
    return _db.ref(DbPaths.user(uid)).set({
      'displayName': displayName,
      'email': email,
      'createdAt': DatabaseService.serverTimestamp,
    });
  }
}
