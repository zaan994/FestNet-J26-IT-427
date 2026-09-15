import 'package:flutter/material.dart';

/// Shared layout for the login and register screens.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({super.key, required this.title, required this.subtitle, required this.children});

  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.watch_outlined, size: 56, color: theme.colorScheme.primary),
                  const SizedBox(height: 12),
                  Text(title, style: theme.textTheme.headlineSmall, textAlign: TextAlign.center),
                  Text(subtitle, style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
                  const SizedBox(height: 32),
                  ...children,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
