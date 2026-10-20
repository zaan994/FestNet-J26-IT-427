import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/labels.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/device_health.dart';
import '../../../models/device_latest.dart';
import '../../../models/enums.dart';
import '../../../providers/device_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/status_widgets.dart';

/// C1 — My Health (Rizvi M.Z.M.). Shows ONLY values derived by the trusted backend.
class HealthScreen extends ConsumerWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final link = ref.watch(attendeeLinkProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Health')),
      body: link.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => const _Message(text:'Could not load your band link. Check your connection.'),
        data: (l) => l == null
            ? ListView(padding: const EdgeInsets.all(20), children: const [NotLinkedCard()])
            : const _HealthBody(),
      ),
    );
  }
}

class _HealthBody extends ConsumerWidget {
  const _HealthBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(clockProvider).valueOrNull ?? DateTime.now();
    final snapshot = ref.watch(linkedSnapshotProvider).valueOrNull;
    final healthAsync = ref.watch(linkedHealthProvider);
    final health = healthAsync.valueOrNull;
    final lastSeen = snapshot?.lastSeenAt;
    final freshness = freshnessOf(lastSeen, now);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(linkedHealthProvider),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            FreshnessChip(freshness: freshness, age: timeAgo(lastSeen, now: now)),
            if (health != null && !health.worn) const StatusChip(label: 'Band not worn', icon: Icons.back_hand_outlined, tone: ChipTone.warning),
            if (snapshot?.latest?.sosActive == true) const StatusChip(label: 'SOS active on band', icon: Icons.sos, tone: ChipTone.critical),
          ]),
          if (freshness == Freshness.stale || freshness == Freshness.offline) ...[
            const SizedBox(height: 10),
            Text(
              'Your band has not sent data recently. Values below may be out of date.',
              style: TextStyle(color: context.festnet.warning, fontWeight: FontWeight.w600),
            ),
          ],
          const SizedBox(height: 16),
          if (healthAsync.hasError)
            const _Message(text: 'Could not load your health data.')
          else if (health == null)
            const SectionCard(
              title: 'Waiting for your first readings',
              icon: Icons.hourglass_top,
              child: Text('Values appear here once FestNet has processed data from your band. Keep the band snug on your wrist.'),
            )
          else ...[
            _HriSummary(health: health),
            const SizedBox(height: 16),
            _Metrics(health: health, latest: snapshot?.latest),
            const SizedBox(height: 16),
            _DataQuality(flags: health.flags),
          ],
          const SizedBox(height: 16),
          Text(
            'FestNet is a research prototype, not a medical device. If you feel unwell, use SOS or go to a help point.',
            style: TextStyle(fontSize: 12, color: context.festnet.muted),
          ),
        ],
      ),
    );
  }
}

class _HriSummary extends StatelessWidget {
  const _HriSummary({required this.health});

  final DeviceHealth health;

  @override
  Widget build(BuildContext context) {
    final hri = health.hri;
    return SectionCard(
      title: 'Health Risk Indicator',
      icon: Icons.insights,
      trailing: TextButton(onPressed: () => context.goNamed(Routes.hri), child: const Text('Explain')),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 8, runSpacing: 8, children: [HriChip(hri: hri), ConfidenceChip(level: hri.confidence)]),
          const SizedBox(height: 10),
          Text(
            hri.score == null
                ? 'Not enough good-quality data for an indicator right now. This does not mean low risk.'
                : hri.confidence.isLow
                    ? 'Data quality is poor, so this indicator is not reliable right now.'
                    : '${hri.factors.length} contributing factor${hri.factors.length == 1 ? '' : 's'}. Tap Explain to see why.',
            style: TextStyle(color: context.festnet.muted),
          ),
          const SizedBox(height: 10),
          const ExperimentalBanner(text: 'Experimental research indicator — not a diagnosis.'),
        ],
      ),
    );
  }
}

class _Metrics extends StatelessWidget {
  const _Metrics({required this.health, required this.latest});

  final DeviceHealth health;
  final DeviceLatest? latest;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      MetricTile(
        label: 'Heart rate',
        value: bpmText(health),
        icon: Icons.favorite_outline,
        info: 'Calculated by FestNet from your band\'s pulse sensor. Shown only when the signal quality is good. '
            'It is a prototype measurement, not a medical reading.',
      ),
      MetricTile(
        label: 'Surface temperature',
        value: surfaceTempText(health.temperature.surfaceC ?? latest?.surfaceC),
        icon: Icons.thermostat,
        caption: 'Skin/band surface — not body temperature',
        info: 'Measured by an infrared sensor at the band. Sun, sweat and how the band sits all affect it. '
            'It is NOT your core body temperature.',
      ),
      MetricTile(
        label: 'Movement',
        value: health.activity.level.label,
        icon: Icons.directions_walk,
        caption: health.activity.impactDetected ? 'Possible impact detected' : null,
      ),
      MetricTile(
        label: 'Heart-rate variability',
        value: hrvText(health),
        icon: Icons.monitor_heart_outlined,
        info: 'Variation between heartbeats (RMSSD) over the last minute. Needs a steady, good-quality signal.',
      ),
      MetricTile(
        label: 'SpO2',
        value: spo2Text(health),
        icon: Icons.bloodtype_outlined,
        info: 'Blood-oxygen estimates from this prototype have not been validated against a medical pulse oximeter, so they are not shown.',
      ),
      MetricTile(
        label: 'Air temperature',
        value: surfaceTempText(health.temperature.ambientC ?? latest?.ambientC),
        icon: Icons.wb_sunny_outlined,
        caption: 'Near the band',
      ),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.25,
      children: tiles,
    );
  }
}

class _DataQuality extends StatelessWidget {
  const _DataQuality({required this.flags});

  final List<String> flags;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Signal quality',
      icon: Icons.network_check,
      child: flags.isEmpty
          ? const Text('✓ Good signal in the latest reading.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final f in flags)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: [
                      Icon(Icons.error_outline, size: 16, color: context.festnet.warning),
                      const SizedBox(width: 6),
                      Expanded(child: Text(flagLabel(f))),
                    ]),
                  ),
              ],
            ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Text(text, style: TextStyle(color: context.festnet.critical)),
      );
}
