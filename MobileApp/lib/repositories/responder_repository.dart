import 'dart:async';

import '../core/config/app_config.dart';
import '../core/constants/db_paths.dart';
import '../core/errors/app_exception.dart';
import '../models/json_utils.dart';
import '../models/responder.dart';
import '../services/database_service.dart';

/// C2 responder side of the app. Responders write only their own duty / location / device tokens
/// (validated by the security rules); every alert action is a command the backend re-checks.
class ResponderRepository {
  ResponderRepository(this._db);

  final DatabaseService _db;

  /// Combined staff + volunteer roles of this account.
  Stream<ResponderRoles> watchRoles(String uid) {
    final controller = StreamController<ResponderRoles>();
    Map<String, String> staff = {};
    Set<String> volunteer = {};
    var gotStaff = false;
    var gotVolunteer = false;
    void emit() {
      if (gotStaff && gotVolunteer) controller.add(ResponderRoles(staff: staff, volunteerEvents: volunteer));
    }

    final subs = [
      _db.ref(DbPaths.staffEvents(uid)).onValue.listen((e) {
        staff = asMap(e.snapshot.value).map((k, v) => MapEntry(k, v.toString()));
        gotStaff = true;
        emit();
      }, onError: (_) {
        gotStaff = true;
        emit();
      }),
      _db.ref(DbPaths.volunteerEvents(uid)).onValue.listen((e) {
        volunteer = asMap(e.snapshot.value).entries.where((x) => x.value == true).map((x) => x.key).toSet();
        gotVolunteer = true;
        emit();
      }, onError: (_) {
        gotVolunteer = true;
        emit();
      }),
    ];
    controller.onCancel = () {
      for (final s in subs) {
        s.cancel();
      }
    };
    return controller.stream;
  }

  Stream<List<InboxAlert>> watchInbox(String uid, {int limit = 50}) => _db
      .ref(DbPaths.inbox(uid))
      .orderByChild('createdAt')
      .limitToLast(limit)
      .onValue
      .map((e) => e.snapshot.children.map((c) => InboxAlert.fromMap(asMap(c.value))).whereType<InboxAlert>().toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt)));

  Stream<ResponderRecord> watchRecord(String uid) => _db
      .ref(DbPaths.responder(uid))
      .onValue
      .map((e) => e.snapshot.value == null ? ResponderRecord.empty : ResponderRecord.fromMap(asMap(e.snapshot.value)));

  Future<void> setOnDuty(String uid, bool onDuty) => _db.ref(DbPaths.responder(uid)).update({'onDuty': onDuty});

  Future<void> updateLocation(String uid, {required double lat, required double lng, required double accuracyM}) =>
      _db.ref(DbPaths.responder(uid)).update({
        'lat': lat,
        'lng': lng,
        'accuracyM': accuracyM.clamp(0, 100000).round(),
        'locationUpdatedAt': DatabaseService.serverTimestamp,
      });

  Future<void> saveToken(String uid, String token, String platform) => _db
      .ref('${DbPaths.responder(uid)}/tokens/${tokenKey(token)}')
      .set({'token': token, 'platform': platform, 'updatedAt': DatabaseService.serverTimestamp});

  Future<void> removeToken(String uid, String token) => _db.ref('${DbPaths.responder(uid)}/tokens/${tokenKey(token)}').remove();

  /// Queues an alert action for the backend and waits for its result.
  Future<void> sendCommand(String uid, String type, Map<String, Object?> payload) async {
    final node = _db.ref(DbPaths.commands(uid)).push();
    try {
      await node.set({'type': type, 'payload': payload, 'createdAt': DatabaseService.serverTimestamp});
    } catch (_) {
      throw const AppException('Could not send the request. Check your connection.');
    }
    final result = await node.onValue
        .map((e) => asMap(e.snapshot.value))
        .firstWhere((m) => m['status'] == 'ok' || m['status'] == 'error')
        .timeout(AppConfig.requestTimeout, onTimeout: () => throw const AppException('No response from FestNet yet. It may still go through.'));
    if (result['status'] != 'ok') throw AppException(asString(result['error']) ?? 'The action failed.');
  }
}

/// Stable, database-safe key for a push token (FNV-1a, same scheme as the dashboard).
String tokenKey(String token) {
  var h = 0x811c9dc5;
  for (final c in token.codeUnits) {
    h ^= c;
    h = (h * 0x01000193) & 0xffffffff;
  }
  return 'app-${h.toRadixString(16)}-${token.length}';
}
