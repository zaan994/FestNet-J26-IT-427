import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_router.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/device_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../widgets/band_status_card.dart';

/// C1 — Real-Time Health Monitoring (Rizvi M.Z.M.)
///
/// FOUNDATION STATUS: shows the paired band's connection and raw sensor status.
/// C1 adds live vitals here: BPM, SpO2, body temperature, HRV stress gauge,
/// motion state and the anomaly banner (all available in DeviceLatest.vitals / .anomaly).
class HealthScreen extends ConsumerWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final device = ref.watch(pairedDeviceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Health'),
        actions: [
          IconButton(
            tooltip: 'History',
            icon: const Icon(Icons.show_chart),
            onPressed: () => context.goNamed(Routes.healthAnalysis),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (profile != null && !profile.hasBand)
            SectionCard(
              title: 'No band paired',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Pair your FestNet band to see your live health data.'),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () => context.goNamed(Routes.pairDevice),
                    icon: const Icon(Icons.link),
                    label: const Text('Pair band'),
                  ),
                ],
              ),
            )
          else
            device.when(
              data: (snapshot) => snapshot == null
                  ? const SizedBox.shrink()
                  : BandStatusCard(deviceId: profile!.deviceId!, snapshot: snapshot),
              loading: () => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())),
              error: (e, _) => SectionCard(title: 'Could not load band', child: Text('$e')),
            ),
        ],
      ),
    );
  }
}
