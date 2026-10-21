import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/attendee.dart';
import '../models/device_health.dart';
import '../models/device_latest.dart';
import 'auth_providers.dart';
import 'firebase_providers.dart';

/// attendeeLinks/{uid}: the band currently linked to this account (null = no band).
final attendeeLinkProvider = StreamProvider<AttendeeLink?>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return Stream.value(null);
  return ref.watch(attendeeRepositoryProvider).watchLink(user.uid);
});

/// Live telemetry of the linked band.
final linkedSnapshotProvider = StreamProvider.autoDispose<DeviceSnapshot?>((ref) {
  final link = ref.watch(attendeeLinkProvider).valueOrNull;
  if (link == null) return Stream.value(null);
  return ref.watch(deviceRepositoryProvider).watchLatest(link.deviceId);
});

/// Derived health of the linked band — only if it belongs to THIS assignment, so data from a
/// previous wearer of the same band is never shown.
final linkedHealthProvider = StreamProvider.autoDispose<DeviceHealth?>((ref) {
  final link = ref.watch(attendeeLinkProvider).valueOrNull;
  if (link == null) return Stream.value(null);
  return ref
      .watch(deviceRepositoryProvider)
      .watchHealth(link.deviceId)
      .map((h) => h != null && h.assignmentId == link.assignmentId ? h : null);
});

/// History of the current assignment for a time window.
final historyProvider = StreamProvider.autoDispose.family<List<HistoryPoint>, Duration>((ref, window) {
  final link = ref.watch(attendeeLinkProvider).valueOrNull;
  if (link == null) return Stream.value(const []);
  return ref.watch(deviceRepositoryProvider).watchHistory(link.assignmentId, window);
});

/// Public info of the linked event.
final eventPublicProvider = StreamProvider.autoDispose<EventPublicInfo?>((ref) {
  final link = ref.watch(attendeeLinkProvider).valueOrNull;
  if (link == null) return Stream.value(null);
  return ref.watch(attendeeRepositoryProvider).watchEventPublic(link.eventId);
});

/// Recent SOS requests of this account with their backend status.
final sosRequestsProvider = StreamProvider.autoDispose<List<SosRequestStatus>>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return Stream.value(const []);
  return ref.watch(attendeeRepositoryProvider).watchSosRequests(user.uid);
});

/// Whether the app is currently connected to the FestNet database (`.info/connected`).
final connectedProvider = StreamProvider.autoDispose<bool>(
  (ref) => ref.watch(databaseServiceProvider).ref('.info/connected').onValue.map((e) => e.snapshot.value == true),
);

/// Ticks every second so "x s ago" labels and freshness refresh.
final clockProvider = StreamProvider.autoDispose<DateTime>(
  (ref) => Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now()),
);
