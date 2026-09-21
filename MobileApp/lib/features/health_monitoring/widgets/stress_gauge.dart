import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/enums.dart';
import '../../../shared/widgets/section_card.dart';

/// HRV-based stress score (0–100) as a bar with Low / Medium / High bands.
class StressGauge extends StatelessWidget {
  const StressGauge({
    super.key,
    required this.score,
    required this.level,
    required this.baselineReady,
    this.rmssdMs,
  });

  final double? score;
  final StressLevel level;
  final bool baselineReady;
  final double? rmssdMs;

  Color get _color => switch (level) {
        StressLevel.low => AppColors.normal,
        StressLevel.medium => AppColors.warning,
        StressLevel.high => AppColors.critical,
        StressLevel.unknown => AppColors.offline,
      };

  String get _label => switch (level) {
        StressLevel.low => 'Low',
        StressLevel.medium => 'Medium',
        StressLevel.high => 'High',
        StressLevel.unknown => 'Measuring…',
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SectionCard(
      title: 'Stress (HRV)',
      trailing: Text(_label, style: theme.textTheme.titleMedium?.copyWith(color: _color, fontWeight: FontWeight.bold)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: score == null ? 0 : (score! / 100).clamp(0, 1),
              minHeight: 12,
              color: _color,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Low', style: theme.textTheme.labelSmall),
              Text('Medium', style: theme.textTheme.labelSmall),
              Text('High', style: theme.textTheme.labelSmall),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Score ${formatNumber(score)} / 100 · RMSSD ${formatNumber(rmssdMs, unit: ' ms')} · '
            '${baselineReady ? 'compared with your personal baseline' : 'learning your baseline (first 2 min)'}',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
