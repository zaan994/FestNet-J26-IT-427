import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/device_health.dart';
import '../models/device_latest.dart';
import 'auth_providers.dart';
import 'firebase_providers.dart';

/// Device id of the signed-in user's paired band, or null.
final pairedDeviceIdProvider = Provider.autoDispose<String?>((ref) {
  final profile = ref.watch(currentProfileProvider).valueOrNull;
  return profile != null && profile.hasBand ? profile.deviceId : null;
});

/// Computed C1 health of any band by id.
final deviceHealthProvider = StreamProvider.autoDispose.family<DeviceHealth?, String>(
  (ref, deviceId) => ref.watch(deviceRepositoryProvider).watchHealth(deviceId),
);

/// History of a band: (deviceId, number of 10-s points).
final deviceHistoryProvider = StreamProvider.autoDispose.family<List<HistoryPoint>, (String, int)>(
  (ref, args) => ref.watch(deviceRepositoryProvider).watchHistory(args.$1, args.$2),
);

/// Live snapshot of any band by id.
final deviceSnapshotProvider = StreamProvider.autoDispose.family<DeviceSnapshot, String>(
  (ref, deviceId) => ref.watch(deviceRepositoryProvider).watchLatest(deviceId),
);

/// Live snapshot of the signed-in user's paired band (null when not paired).
final pairedDeviceProvider = Provider.autoDispose<AsyncValue<DeviceSnapshot?>>((ref) {
  final profile = ref.watch(currentProfileProvider);
  return profile.when(
    data: (p) => p == null || !p.hasBand
        ? const AsyncValue<DeviceSnapshot?>.data(null)
        : ref.watch(deviceSnapshotProvider(p.deviceId!)).whenData<DeviceSnapshot?>((s) => s),
    loading: () => const AsyncValue<DeviceSnapshot?>.loading(),
    error: (e, st) => AsyncValue<DeviceSnapshot?>.error(e, st),
  );
});

/// Ticks every second so "x s ago" labels and online/offline status refresh.
final clockProvider = StreamProvider.autoDispose<DateTime>(
  (ref) => Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now()),
);
