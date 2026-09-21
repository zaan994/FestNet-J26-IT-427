import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/theme_provider.dart';

/// Light / Night / Auto segmented control (Profile → Appearance).
class ThemeModeSelector extends ConsumerWidget {
  const ThemeModeSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return SegmentedButton<ThemeMode>(
      showSelectedIcon: false,
      segments: const [
        ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Light')),
        ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Night')),
        ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('Auto')),
      ],
      selected: {mode},
      onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).setMode(s.first),
    );
  }
}

/// Compact icon button that cycles Light → Night → Auto (used on the sign-in screens).
class ThemeModeCycleButton extends ConsumerWidget {
  const ThemeModeCycleButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final (icon, label, next) = switch (mode) {
      ThemeMode.light => (Icons.light_mode_outlined, 'Light theme', ThemeMode.dark),
      ThemeMode.dark => (Icons.dark_mode_outlined, 'Night theme', ThemeMode.system),
      ThemeMode.system => (Icons.brightness_auto_outlined, 'Automatic theme', ThemeMode.light),
    };
    return IconButton.filledTonal(
      tooltip: label,
      icon: Icon(icon),
      onPressed: () => ref.read(themeModeProvider.notifier).setMode(next),
    );
  }
}
