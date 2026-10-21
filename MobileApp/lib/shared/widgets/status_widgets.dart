import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../models/device_health.dart';
import '../../models/enums.dart';

enum ChipTone { neutral, normal, warning, danger, critical, brand }

/// Status chip — colour is never the only signal: every chip has an icon and a text label.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.icon, this.tone = ChipTone.neutral});

  final String label;
  final IconData icon;
  final ChipTone tone;

  @override
  Widget build(BuildContext context) {
    final fx = context.festnet;
    final color = switch (tone) {
      ChipTone.neutral => fx.muted,
      ChipTone.normal => fx.normal,
      ChipTone.warning => fx.warning,
      ChipTone.danger => fx.danger,
      ChipTone.critical => fx.critical,
      ChipTone.brand => Theme.of(context).colorScheme.primary,
    };
    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.45)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 5),
            Flexible(
              child: Text(label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.onSurface)),
            ),
          ],
        ),
      ),
    );
  }
}

class FreshnessChip extends StatelessWidget {
  const FreshnessChip({super.key, required this.freshness, this.age});

  final Freshness freshness;
  final String? age;

  @override
  Widget build(BuildContext context) {
    final (tone, icon) = switch (freshness) {
      Freshness.live => (ChipTone.normal, Icons.sensors),
      Freshness.stale => (ChipTone.warning, Icons.schedule),
      Freshness.offline => (ChipTone.neutral, Icons.sensors_off),
      Freshness.unknown => (ChipTone.neutral, Icons.hourglass_empty),
    };
    return StatusChip(
      tone: tone,
      icon: icon,
      label: age != null && freshness != Freshness.unknown ? '${freshness.label} · $age' : freshness.label,
    );
  }
}

class HriChip extends StatelessWidget {
  const HriChip({super.key, required this.hri});

  final HriResult? hri;

  @override
  Widget build(BuildContext context) {
    final h = hri;
    if (h == null) return const StatusChip(label: 'No HRI yet', icon: Icons.hourglass_empty);
    final (tone, icon) = switch (h.status) {
      HriStatus.insufficientData => (ChipTone.neutral, Icons.help_outline),
      HriStatus.low => (ChipTone.normal, Icons.check_circle_outline),
      HriStatus.elevated => (ChipTone.warning, Icons.error_outline),
      HriStatus.high => (ChipTone.danger, Icons.warning_amber_rounded),
    };
    final text = h.score == null ? h.status.label : '${h.status.label} · ${h.score}';
    return Opacity(
      opacity: h.confidence.isLow ? 0.65 : 1,
      child: StatusChip(tone: tone, icon: icon, label: text),
    );
  }
}

class ConfidenceChip extends StatelessWidget {
  const ConfidenceChip({super.key, required this.level});

  final ConfidenceLevel level;

  @override
  Widget build(BuildContext context) {
    final tone = switch (level) {
      ConfidenceLevel.none => ChipTone.neutral,
      ConfidenceLevel.low => ChipTone.warning,
      ConfidenceLevel.medium => ChipTone.brand,
      ConfidenceLevel.high => ChipTone.normal,
    };
    return StatusChip(tone: tone, icon: Icons.verified_outlined, label: '${level.label} confidence');
  }
}

/// A labelled value. "Not available yet" values are rendered muted, never as 0.
class MetricTile extends StatelessWidget {
  const MetricTile({super.key, required this.label, required this.value, required this.icon, this.caption, this.info});

  final String label;
  final String value;
  final IconData icon;
  final String? caption;

  /// Optional explanation shown in a dialog from the (i) button.
  final String? info;

  @override
  Widget build(BuildContext context) {
    final fx = context.festnet;
    final missing = value == unavailable;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: fx.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 6),
              Expanded(child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fx.muted))),
              if (info != null) InfoButton(title: label, text: info!),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(fontSize: missing ? 15 : 22, fontWeight: FontWeight.w800, color: missing ? fx.muted : null),
          ),
          if (caption != null) ...[
            const SizedBox(height: 2),
            Text(caption!, style: TextStyle(fontSize: 11, color: fx.muted)),
          ],
        ],
      ),
    );
  }
}

class InfoButton extends StatelessWidget {
  const InfoButton({super.key, required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'About $title',
      visualDensity: VisualDensity.compact,
      iconSize: 18,
      icon: const Icon(Icons.info_outline),
      onPressed: () => showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(title),
          content: Text(text),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
        ),
      ),
    );
  }
}

/// Shown on screens that need a linked band.
class NotLinkedCard extends StatelessWidget {
  const NotLinkedCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.watch_outlined, size: 36, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 10),
            Text('No FestNet band linked', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              'Collect a band at a FestNet desk. Staff will show you a one-time code — scan it in My Device to see your band here.',
              style: TextStyle(color: context.festnet.muted),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: () => context.goNamed(Routes.device),
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Link my band'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small information banner (used next to the Health Risk Indicator).
class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 18, color: primary),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }
}
