import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/thresholds.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/device_health.dart';
import '../../../models/enums.dart';
import '../../../providers/device_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../widgets/anomaly_banner.dart';
import '../widgets/band_status_card.dart';
import '../widgets/pulse_heart.dart';
import '../widgets/stress_gauge.dart';
import '../widgets/vital_card.dart';

/// C1 — Real-Time Health Monitoring (Rizvi M.Z.M.)
///
/// Live vitals of the paired band. The band uploads raw signals; the values shown here are
/// computed by the backend (devices/{id}/health) and update every ~2 s.
class HealthScreen extends ConsumerWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deviceId = ref.watch(pairedDeviceIdProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Health'),
        actions: [
          if (deviceId != null)
            IconButton(
              tooltip: 'History',
              icon: const Icon(Icons.show_chart),
              onPressed: () => context.goNamed(Routes.healthAnalysis),
            ),
        ],
      ),
      body: deviceId == null ? const _NoBand() : _LiveVitals(deviceId: deviceId),
    );
  }
}

class _NoBand extends StatelessWidget {
  const _NoBand();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
        ),
      ],
    );
  }
}

class _LiveVitals extends ConsumerWidget {
  const _LiveVitals({required this.deviceId});

  final String deviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshotAsync = ref.watch(deviceSnapshotProvider(deviceId));
    final healthAsync = ref.watch(deviceHealthProvider(deviceId));
    final now = ref.watch(clockProvider).valueOrNull ?? DateTime.now();

    // Vibrate when the anomaly severity goes up.
    ref.listen(deviceHealthProvider(deviceId), (previous, next) {
      final before = previous?.valueOrNull?.anomaly.severity ?? Severity.none;
      final after = next.valueOrNull?.anomaly.severity ?? Severity.none;
      if (after.index > before.index) HapticFeedback.heavyImpact();
    });

    final snapshot = snapshotAsync.valueOrNull;
    final health = healthAsync.valueOrNull;
    final online = snapshot?.isOnline(AppConfig.deviceOfflineAfter, now: now) ?? false;

    if (snapshotAsync.isLoading && healthAsync.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(deviceSnapshotProvider(deviceId));
        ref.invalidate(deviceHealthProvider(deviceId));
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (online && health != null && health.anomaly.active) ...[
            AnomalyBanner(anomaly: health.anomaly),
            const SizedBox(height: 12),
          ],
          if (!online && snapshot?.receivedAt != null)
            _InfoCard(
              icon: Icons.cloud_off,
              text: 'Band offline — last update ${timeAgo(snapshot!.receivedAt, now: now)}. Values below may be outdated.',
            ),
          if (online && health != null && !health.worn)
            const _InfoCard(icon: Icons.touch_app, text: 'Band is not touching your skin. Wear it snugly on your wrist.'),
          if (health == null)
            const _InfoCard(
              icon: Icons.hourglass_empty,
              text: 'Waiting for your health data… it appears a few seconds after the band starts sending.',
            )
          else
            _VitalsGrid(health: health, dimmed: !online),
          const SizedBox(height: 16),
          if (snapshot != null) BandStatusCard(deviceId: deviceId, snapshot: snapshot),
        ],
      ),
    );
  }
}

class _VitalsGrid extends StatelessWidget {
  const _VitalsGrid({required this.health, required this.dimmed});

  final DeviceHealth health;
  final bool dimmed;

  bool _has(String type) => health.anomaly.types.contains(type);

  @override
  Widget build(BuildContext context) {
    final v = health.vitals;
    final t = health.temperature;
    final theme = Theme.of(context);

    return Column(
      children: [
        // Heart rate hero
        Opacity(
          opacity: dimmed ? 0.5 : 1,
          child: Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(color: AppColors.violet.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 10)),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), shape: BoxShape.circle),
                  child: PulseHeart(bpm: dimmed ? null : v.bpm, color: Colors.white, size: 48),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('HEART RATE',
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.2)),
                      Text.rich(
                        TextSpan(
                          text: formatNumber(v.bpm),
                          style: theme.textTheme.displayMedium
                              ?.copyWith(fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -1),
                          children: [
                            if (v.bpm != null)
                              TextSpan(
                                text: ' bpm',
                                style: TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.85)),
                              ),
                          ],
                        ),
                      ),
                      Text(
                        _has('bpm_spike')
                            ? '⚠ Sudden rise in heart rate'
                            : (health.worn ? 'Live from your FestNet band' : 'Band not touching your skin'),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: _has('bpm_spike') ? 1 : 0.85),
                          fontWeight: _has('bpm_spike') ? FontWeight.w800 : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.15,
          children: [
            VitalCard(
              icon: Icons.bloodtype_outlined,
              label: 'Blood oxygen',
              value: formatNumber(v.spo2),
              unit: '%',
              detail: 'Normal ≥ ${Thresholds.spo2Low}%',
              alert: _has('low_spo2'),
              dimmed: dimmed,
            ),
            VitalCard(
              icon: Icons.thermostat,
              label: 'Body temperature',
              value: formatNumber(t.coreEstC, decimals: 1),
              unit: '°C',
              detail: 'Skin ${formatNumber(t.skinC, decimals: 1, unit: '°C')}',
              alert: _has('high_temp'),
              dimmed: dimmed,
            ),
            VitalCard(
              icon: Icons.monitor_heart_outlined,
              label: 'Heart-rate variability',
              value: formatNumber(v.rmssdMs),
              unit: 'ms',
              detail: 'RMSSD · ${v.ibiCount} beats',
              dimmed: dimmed,
            ),
            VitalCard(
              icon: _motionIcon(health.motion.state),
              label: 'Movement',
              value: _motionLabel(health.motion.state),
              detail: health.motion.stillSec > 0 ? 'Still for ${health.motion.stillSec} s' : null,
              alert: _has('fall') || _has('stillness'),
              dimmed: dimmed,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Opacity(
          opacity: dimmed ? 0.5 : 1,
          child: StressGauge(
            score: v.stressScore,
            level: v.stressLevel,
            baselineReady: v.baselineReady,
            rmssdMs: v.rmssdMs,
          ),
        ),
      ],
    );
  }

  static IconData _motionIcon(MotionState s) => switch (s) {
        MotionState.fall => Icons.personal_injury_outlined,
        MotionState.still => Icons.airline_seat_flat_outlined,
        MotionState.active => Icons.directions_walk,
        MotionState.unknown => Icons.help_outline,
      };

  static String _motionLabel(MotionState s) => switch (s) {
        MotionState.fall => 'Fall!',
        MotionState.still => 'Still',
        MotionState.active => 'Moving',
        MotionState.unknown => '—',
      };
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SectionCard(
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(child: Text(text)),
          ],
        ),
      ),
    );
  }
}
