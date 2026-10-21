import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../providers/responder_providers.dart';

/// Bottom navigation shell. Branch indexes match core/routing/app_router.dart:
///   0 My Health · 1 SOS · 2 My Device · 3 Event · 4 Privacy · 5 Respond (C2)
/// Responders see Respond in place of My Device (still reachable from My Health / Privacy).
/// SOS is always one tap away.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  StreamSubscription<Object?>? _opened;

  @override
  void initState() {
    super.initState();
    // Tapping an alert notification opens the Respond tab.
    final push = ref.read(pushServiceProvider);
    _opened = push.opened.listen((_) => _openRespond());
    unawaited(push.initialMessage().then((m) {
      if (m != null) _openRespond();
    }).catchError((Object _) {}));
  }

  void _openRespond() {
    if (mounted) widget.shell.goBranch(5);
  }

  @override
  void dispose() {
    _opened?.cancel();
    super.dispose();
  }

  static const _health = NavigationDestination(icon: Icon(Icons.favorite_border), selectedIcon: Icon(Icons.favorite), label: 'My Health');
  static const _sos = NavigationDestination(icon: Icon(Icons.sos_outlined), selectedIcon: Icon(Icons.sos), label: 'SOS');
  static const _device = NavigationDestination(icon: Icon(Icons.watch_outlined), selectedIcon: Icon(Icons.watch), label: 'My Device');
  static const _event = NavigationDestination(icon: Icon(Icons.festival_outlined), selectedIcon: Icon(Icons.festival), label: 'Event');
  static const _privacy = NavigationDestination(icon: Icon(Icons.shield_outlined), selectedIcon: Icon(Icons.shield), label: 'Privacy');
  static const _respond = NavigationDestination(icon: Icon(Icons.medical_services_outlined), selectedIcon: Icon(Icons.medical_services), label: 'Respond');

  @override
  Widget build(BuildContext context) {
    final isResponder = ref.watch(isResponderProvider);
    // Keep push registration alive for responders while signed in.
    if (isResponder) ref.watch(pushRegistrationProvider);
    final branches = isResponder ? const [0, 1, 5, 3, 4] : const [0, 1, 2, 3, 4];
    final destinations = isResponder ? const [_health, _sos, _respond, _event, _privacy] : const [_health, _sos, _device, _event, _privacy];
    final selected = branches.indexOf(widget.shell.currentIndex);

    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected < 0 ? 0 : selected,
        onDestinationSelected: (i) => widget.shell.goBranch(branches[i], initialLocation: branches[i] == widget.shell.currentIndex),
        destinations: destinations,
      ),
    );
  }
}
