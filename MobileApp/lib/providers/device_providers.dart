import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/device_latest.dart';
import 'auth_providers.dart';
import 'firebase_providers.dart';

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
