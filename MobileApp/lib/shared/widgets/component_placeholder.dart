import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Placeholder body for a component that has not been built yet.
class ComponentPlaceholder extends StatelessWidget {
  const ComponentPlaceholder({
    super.key,
    required this.icon,
    required this.component,
    required this.owner,
    required this.planned,
  });

  final IconData icon;
  final String component;
  final String owner;
  final List<String> planned;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(24)),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), shape: BoxShape.circle),
                child: Icon(icon, size: 40, color: Colors.white),
              ),
              const SizedBox(height: 14),
              Text(component,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Owner: $owner', style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
                child: const Text('Coming soon', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Text('Planned features', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        for (final item in planned)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.auto_awesome, size: 18, color: theme.colorScheme.primary),
                    const SizedBox(width: 10),
                    Expanded(child: Text(item, style: TextStyle(color: context.festnet.muted))),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
