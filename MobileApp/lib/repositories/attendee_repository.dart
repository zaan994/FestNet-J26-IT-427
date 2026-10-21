import 'dart:async';

import '../core/config/app_config.dart';
import '../core/constants/db_paths.dart';
import '../core/errors/app_exception.dart';
import '../models/attendee.dart';
import '../models/json_utils.dart';
import '../services/database_service.dart';

/// Attendee-side requests. The app only WRITES requests; the trusted backend validates them
/// and writes the outcome back (claim → attendeeLinks, SOS → emergencies).
class AttendeeRepository {
  AttendeeRepository(this._db);

  final DatabaseService _db;

  Stream<AttendeeLink?> watchLink(String uid) => _db
      .ref(DbPaths.attendeeLink(uid))
      .onValue
      .map((e) => e.snapshot.value == null ? null : AttendeeLink.fromMap(asMap(e.snapshot.value)));

  Stream<EventPublicInfo?> watchEventPublic(String eventId) => _db
      .ref(DbPaths.eventPublic(eventId))
      .onValue
      .map((e) => e.snapshot.value == null ? null : EventPublicInfo.fromMap(asMap(e.snapshot.value)));

  /// Redeems a one-time claim code shown/printed by event staff. Attendees never type device IDs.
  /// Completes when the backend has linked the device; throws [AppException] otherwise.
  Future<void> claimDevice(String uid, String rawCode) async {
    final code = rawCode.trim().replaceFirst(RegExp('^FESTNET-CLAIM:', caseSensitive: false), '').trim();
    if (code.isEmpty || code.length > 40) throw const AppException('Enter the code shown by FestNet staff.');
    if (code.startsWith('FESTNET-')) throw const AppException('That is not a claim code. Scan the code staff show you.');
    final node = _db.ref(DbPaths.claimRequests(uid)).push();
    try {
      await node.set({'code': code, 'createdAt': DatabaseService.serverTimestamp});
    } catch (_) {
      throw const AppException('Could not send the code. Check your connection.');
    }
    final result = await node.onValue
        .map((e) => asMap(e.snapshot.value))
        .firstWhere((m) => m['status'] == 'linked' || m['status'] == 'rejected')
        .timeout(AppConfig.requestTimeout, onTimeout: () => throw const AppException('No response from FestNet yet. Try again in a moment.'));
    if (result['status'] != 'linked') {
      throw AppException(asString(result['error']) ?? 'Code is invalid or has expired. Ask staff for a new code.');
    }
  }

  /// Raises an SOS request. Returns the request id so the UI can follow its delivery status.
  /// The write is queued offline by Firebase and sent as soon as a connection is available.
  Future<String> sendSos(String uid) async {
    final node = _db.ref(DbPaths.sosRequests(uid)).push();
    // Do not await the server round-trip: offline writes are queued and must not block the UI.
    unawaited(node.set({
      'clientCreatedAt': DateTime.now().millisecondsSinceEpoch,
      'createdAt': DatabaseService.serverTimestamp,
    }).catchError((Object _) {}));
    return node.key!;
  }

  /// The attendee's recent SOS requests (bounded), newest first.
  Stream<List<SosRequestStatus>> watchSosRequests(String uid, {int limit = 5}) => _db
      .ref(DbPaths.sosRequests(uid))
      .orderByKey()
      .limitToLast(limit + 1)
      .onValue
      .map((e) => e.snapshot.children
          .where((c) => c.key != '_active')
          .map((c) => SosRequestStatus.fromMap(c.key!, asMap(c.value)))
          .whereType<SosRequestStatus>()
          .toList()
          .reversed
          .toList());
}
