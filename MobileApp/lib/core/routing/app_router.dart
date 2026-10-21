import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/authentication/screens/login_screen.dart';
import '../../features/authentication/screens/register_screen.dart';
import '../../features/device/screens/my_device_screen.dart';
import '../../features/emergency/screens/emergency_screen.dart';
import '../../features/event_info/screens/event_info_screen.dart';
import '../../features/festival_location/screens/map_screen.dart';
import '../../features/health_analysis/screens/hri_screen.dart';
import '../../features/health_monitoring/screens/health_screen.dart';
import '../../features/heat_wellness/screens/wellness_screen.dart';
import '../../features/home/screens/home_shell.dart';
import '../../features/profile_settings/screens/profile_screen.dart';
import '../../features/responder/screens/respond_screen.dart';
import '../../providers/firebase_providers.dart';

/// Route names — use `context.goNamed(Routes.health)` instead of raw paths.
class Routes {
  Routes._();

  static const login = 'login';
  static const register = 'register';
  static const health = 'health'; // C1 — My Health
  static const hri = 'hri'; // C1 — HRI explanation
  static const sos = 'sos'; // C1/C2 — Emergency
  static const device = 'device'; // My Device (claim code)
  static const event = 'event'; // Event & safety info
  static const map = 'map'; // C3
  static const wellness = 'wellness'; // C4
  static const settings = 'settings'; // Privacy & settings
  static const respond = 'respond'; // C2 — responders
}

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authServiceProvider);
  final refresh = _StreamListenable(auth.authStateChanges());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/health',
    refreshListenable: refresh,
    redirect: (context, state) {
      final signedIn = auth.currentUser != null;
      final onAuthPage = state.matchedLocation == '/login' || state.matchedLocation == '/register';
      if (!signedIn && !onAuthPage) return '/login';
      if (signedIn && onAuthPage) return '/health';
      return null;
    },
    routes: [
      GoRoute(path: '/login', name: Routes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', name: Routes.register, builder: (_, __) => const RegisterScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/health',
              name: Routes.health,
              builder: (_, __) => const HealthScreen(),
              routes: [GoRoute(path: 'hri', name: Routes.hri, builder: (_, __) => const HriScreen())],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/sos', name: Routes.sos, builder: (_, __) => const EmergencyScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/device', name: Routes.device, builder: (_, __) => const MyDeviceScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/event',
              name: Routes.event,
              builder: (_, __) => const EventInfoScreen(),
              routes: [
                GoRoute(path: 'map', name: Routes.map, builder: (_, __) => const MapScreen()),
                GoRoute(path: 'wellness', name: Routes.wellness, builder: (_, __) => const WellnessScreen()),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/settings', name: Routes.settings, builder: (_, __) => const ProfileScreen()),
          ]),
          // C2 — shown in the navigation only for responder accounts (HomeShell).
          StatefulShellBranch(routes: [
            GoRoute(path: '/respond', name: Routes.respond, builder: (_, __) => const RespondScreen()),
          ]),
        ],
      ),
    ],
  );
});

/// Lets GoRouter re-run `redirect` whenever the auth state changes.
class _StreamListenable extends ChangeNotifier {
  _StreamListenable(Stream<Object?> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<Object?> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
