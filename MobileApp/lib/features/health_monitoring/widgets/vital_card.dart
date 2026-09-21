import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';

/// One live vital: icon chip, label, large value + unit, optional detail. When [alert] is true
/// the card shows a red frame, warning icon and "Out of range" (not colour alone).
class VitalCard extends StatelessWidget {
  const VitalCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.unit,
    this.detail,
    this.alert = false,
    this.dimmed = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? unit;
  final String? detail;
  final bool alert;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fx = context.festnet;
    final accent = alert ? AppColors.critical : theme.colorScheme.primary;

    return Opacity(
      opacity: dimmed ? 0.5 : 1,
      child: Container(
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: alert ? AppColors.critical : fx.line, width: alert ? 2 : 1),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(color: accent.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
                  child: Icon(icon, size: 18, color: accent),
                ),
                const Spacer(),
                if (alert) const Icon(Icons.warning_amber_rounded, size: 20, color: AppColors.critical),
              ],
            ),
            const Spacer(),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fx.muted)),
            Text.rich(
              TextSpan(
                text: value,
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
                children: [
                  if (unit != null && value != '—')
                    TextSpan(text: ' $unit', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fx.muted)),
                ],
              ),
            ),
            if (alert)
              const Text('Out of range',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.critical))
            else if (detail != null)
              Text(detail!, style: TextStyle(fontSize: 11, color: fx.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}
