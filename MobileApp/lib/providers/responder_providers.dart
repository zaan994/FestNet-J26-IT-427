import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../models/responder.dart';
import '../repositories/responder_repository.dart';
import '../services/push_service.dart';
import 'auth_providers.dart';
import 'firebase_providers.dart';

final responderRepositoryProvider = Provider<ResponderRepository>((ref) => ResponderRepository(ref.watch(databaseServiceProvider)));

final pushServiceProvider = Provider<PushService>((ref) => PushService(FirebaseMessaging.instance, ref.watch(responderRepositoryProvider)));

/// Responder roles of the signed-in account (none for ordinary attendees).
final responderRolesProvider = StreamProvider<ResponderRoles>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return Stream.value(ResponderRoles.none);
  return ref.watch(responderRepositoryProvider).watchRoles(user.uid);
});

final isResponderProvider = Provider<bool>((ref) => ref.watch(responderRolesProvider).valueOrNull?.isResponder ?? false);

final inboxProvider = StreamProvider.autoDispose<List<InboxAlert>>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return Stream.value(const []);
  return ref.watch(responderRepositoryProvider).watchInbox(user.uid);
});

final responderRecordProvider = StreamProvider.autoDispose<ResponderRecord>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return Stream.value(ResponderRecord.empty);
  return ref.watch(responderRepositoryProvider).watchRecord(user.uid);
});

/// Push registration state for the signed-in responder (null message = registered).
final pushRegistrationProvider = FutureProvider<String?>((ref) async {
  final user = ref.watch(authStateProvider).valueOrNull;
  final isResponder = ref.watch(isResponderProvider);
  if (user == null || !isResponder) return 'Not a responder account.';
  return ref.watch(pushServiceProvider).register(user.uid);
});

/// Location sharing while on duty. Writes at most every [writeEvery] so the backend always has a
/// position younger than its 120-s routing limit, without draining the battery.
class DutyLocationState {
  const DutyLocationState({this.position, this.error, this.active = false});
  final Position? position;
  final String? error;
  final bool active;
}

class DutyLocationController extends AutoDisposeNotifier<DutyLocationState> {
  static const writeEvery = Duration(seconds: 20);
  StreamSubscription<Position>? _sub;
  DateTime? _lastWrite;

  @override
  DutyLocationState build() {
    final onDuty = ref.watch(responderRecordProvider).valueOrNull?.onDuty ?? false;
    ref.onDispose(() => _sub?.cancel());
    if (onDuty) {
      unawaited(_start());
    } else {
      _sub?.cancel();
      _sub = null;
    }
    return DutyLocationState(active: onDuty);
  }

  Future<void> _start() async {
    final uid = ref.read(authStateProvider).valueOrNull?.uid;
    if (uid == null || _sub != null) return;
    if (!await Geolocator.isLocationServiceEnabled()) {
      state = const DutyLocationState(active: true, error: 'Location services are off. Turn them on to receive nearby alerts.');
      return;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      state = const DutyLocationState(active: true, error: 'Location permission denied — nearby alerts need your location.');
      return;
    }
    final repo = ref.read(responderRepositoryProvider);
    _sub = Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 5)).listen(
      (pos) async {
        state = DutyLocationState(active: true, position: pos);
        final now = DateTime.now();
        if (_lastWrite != null && now.difference(_lastWrite!) < writeEvery) return;
        _lastWrite = now;
        try {
          await repo.updateLocation(uid, lat: pos.latitude, lng: pos.longitude, accuracyM: pos.accuracy);
        } catch (_) {
          state = DutyLocationState(active: true, position: pos, error: 'Could not save your location (connection).');
        }
      },
      onError: (Object _) => state = const DutyLocationState(active: true, error: 'Location unavailable.'),
    );
  }
}

final dutyLocationProvider = NotifierProvider.autoDispose<DutyLocationController, DutyLocationState>(DutyLocationController.new);
