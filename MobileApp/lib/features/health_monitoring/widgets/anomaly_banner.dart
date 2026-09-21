import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/device_health.dart';

/// Red banner listing the active anomalies (icon + text — never colour alone).
class AnomalyBanner extends StatelessWidget {
  const AnomalyBanner({super.key, required this.anomaly});

  final HealthAnomaly anomaly;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.forSeverity(anomaly.severity);
    final names = anomaly.types.map((t) => anomalyLabels[t] ?? t).join(' · ');
    return Card(
      elevation: 0,
      color: color.withAlpha(31), // ~12 % tint
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: color, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.warning_amber_rounded, color: color, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${anomaly.severity.label.toUpperCase()} — $names',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  if (anomaly.since != null)
                    Text('Since ${DateFormat.Hms().format(anomaly.since!)}', style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Text(
                    'The medical team has been notified. Stay where you are if you feel unwell.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
