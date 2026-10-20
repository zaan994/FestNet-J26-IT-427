import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Bottom navigation shell. Tab order matches the branches in core/routing/app_router.dart.
/// SOS is always one tap away, independent of the health screens.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.favorite_border), selectedIcon: Icon(Icons.favorite), label: 'My Health'),
          NavigationDestination(icon: Icon(Icons.sos_outlined), selectedIcon: Icon(Icons.sos), label: 'SOS'),
          NavigationDestination(icon: Icon(Icons.watch_outlined), selectedIcon: Icon(Icons.watch), label: 'My Device'),
          NavigationDestination(icon: Icon(Icons.festival_outlined), selectedIcon: Icon(Icons.festival), label: 'Event'),
          NavigationDestination(icon: Icon(Icons.shield_outlined), selectedIcon: Icon(Icons.shield), label: 'Privacy'),
        ],
      ),
    );
  }
}
