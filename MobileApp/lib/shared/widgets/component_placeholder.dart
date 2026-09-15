import 'package:flutter/material.dart';

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
      padding: const EdgeInsets.all(24),
      children: [
        Icon(icon, size: 56, color: theme.colorScheme.primary),
        const SizedBox(height: 16),
        Text(component, style: theme.textTheme.titleLarge, textAlign: TextAlign.center),
        Text('Owner: $owner', style: theme.textTheme.bodySmall, textAlign: TextAlign.center),
        const SizedBox(height: 24),
        Text('Coming soon:', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        for (final item in planned)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('•  '),
                Expanded(child: Text(item, style: theme.textTheme.bodyMedium)),
              ],
            ),
          ),
      ],
    );
  }
}
