import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/festnet_logo.dart';
import '../../../shared/widgets/theme_mode_selector.dart';

/// Shared layout for the login and register screens: stage-light background, logo,
/// title, form card and a theme switch.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({super.key, required this.title, required this.subtitle, required this.children});

  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Stack(
        children: [
          // Festival stage lights
          const Positioned(top: -120, left: -100, child: _Glow(color: AppColors.lightPrimary, size: 340)),
          const Positioned(bottom: -140, right: -120, child: _Glow(color: AppColors.lightSecondary, size: 380)),
          SafeArea(
            child: Stack(
              children: [
                const Positioned(top: 8, right: 8, child: ThemeModeCycleButton()),
                Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Center(child: FestNetLogo(size: 52, subtitle: 'Festival safety wearable')),
                          const SizedBox(height: 32),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(title,
                                      style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 4),
                                  Text(subtitle, style: TextStyle(color: context.festnet.muted)),
                                  const SizedBox(height: 24),
                                  ...children,
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Research prototype — not a medical device and not a diagnosis',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11, color: context.festnet.muted),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color.withValues(alpha: 0.35), color.withValues(alpha: 0)]),
        ),
      ),
    );
  }
}
