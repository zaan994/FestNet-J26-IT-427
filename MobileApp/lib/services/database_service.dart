import 'package:firebase_database/firebase_database.dart';

/// Single access point to the Realtime Database so repositories never touch
/// FirebaseDatabase.instance directly (easier to fake in tests).
class DatabaseService {
  DatabaseService(this._db);

  final FirebaseDatabase _db;

  DatabaseReference ref(String path) => _db.ref(path);

  /// Firebase server timestamp placeholder for writes.
  static Object get serverTimestamp => ServerValue.timestamp;
}
