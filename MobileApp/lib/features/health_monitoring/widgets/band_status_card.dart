import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/device_latest.dart';
import '../../../providers/device_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/status_dot.dart';

/// Connection + raw sensor status of the paired band (foundation-level view).
class BandStatusCard extends ConsumerWidget {
  const BandStatusCard({super.key, required this.deviceId, required this.snapshot});

  final String deviceId;
  final DeviceSnapshot snapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(clockProvider).valueOrNull ?? DateTime.now();
    final latest = snapshot.latest;
    final online = snapshot.isOnline(AppConfig.deviceOfflineAfter, now: now);
    final theme = Theme.of(context);

    return SectionCard(
      title: deviceId,
      trailing: StatusDot(
        online: online,
        label: latest == null ? 'No data' : (snapshot.receivedAt == null ? 'Waiting…' : null),
      ),
      child: latest == null
          ? const Text('This band has not sent any data yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Last update: ${timeAgo(snapshot.receivedAt, now: now)}', style: theme.textTheme.bodySmall),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _SensorChip('Pulse', latest.sensors.max30102),
                    _SensorChip('Temp', latest.sensors.mlx90614),
                    _SensorChip('Motion', latest.sensors.mpu6050),
                    _SensorChip('Display', latest.sensors.oled),
                    _SensorChip('GPS fix', latest.gps.fix),
                  ],
                ),
                const SizedBox(height: 12),
                _Row('Skin temperature', formatNumber(latest.temperature.objectC, decimals: 1, unit: ' °C')),
                _Row('Ambient', formatNumber(latest.temperature.ambientC, decimals: 1, unit: ' °C')),
                _Row('SOS', latest.sosActive ? 'ACTIVE' : 'Normal'),
              ],
            ),
    );
  }
}

class _SensorChip extends StatelessWidget {
  const _SensorChip(this.label, this.ok);

  final String label;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    return Chip(
      visualDensity: VisualDensity.compact,
      avatar: Icon(ok ? Icons.check_circle : Icons.cancel, size: 16, color: ok ? Colors.green : Colors.grey),
      label: Text(label),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
