import 'package:flutter/material.dart';

/// Rounded card with an optional title row — the standard container on every screen.
/// Styling comes from the theme's CardThemeData (light / night).
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, this.trailing, this.icon, required this.child});

  final String? title;
  final Widget? trailing;
  final IconData? icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null) ...[
              Row(
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 20, color: theme.colorScheme.primary),
                    const SizedBox(width: 8),
                  ],
                  Expanded(child: Text(title!, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: 14),
            ],
            child,
          ],
        ),
      ),
    );
  }
}
