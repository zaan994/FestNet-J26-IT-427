import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/authentication/screens/login_screen.dart';
import '../../features/authentication/screens/register_screen.dart';
import '../../features/emergency/screens/emergency_screen.dart';
import '../../features/festival_location/screens/map_screen.dart';
import '../../features/health_analysis/screens/health_analysis_screen.dart';
import '../../features/health_monitoring/screens/health_screen.dart';
import '../../features/heat_wellness/screens/wellness_screen.dart';
import '../../features/home/screens/home_shell.dart';
import '../../features/profile_settings/screens/pair_device_screen.dart';
import '../../features/profile_settings/screens/profile_screen.dart';
import '../../providers/firebase_providers.dart';

/// Route names — use `context.goNamed(Routes.health)` instead of raw paths.
class Routes {
  Routes._();

  static const login = 'login';
  static const register = 'register';
  static const health = 'health'; // C1
  static const healthAnalysis = 'health-analysis'; // C1
  static const emergency = 'emergency'; // C2
  static const map = 'map'; // C3
  static const wellness = 'wellness'; // C4
  static const profile = 'profile';
  static const pairDevice = 'pair-device';
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
              routes: [
                GoRoute(
                  path: 'analysis',
                  name: Routes.healthAnalysis,
                  builder: (_, __) => const HealthAnalysisScreen(),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/emergency', name: Routes.emergency, builder: (_, __) => const EmergencyScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/map', name: Routes.map, builder: (_, __) => const MapScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/wellness', name: Routes.wellness, builder: (_, __) => const WellnessScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/profile',
              name: Routes.profile,
              builder: (_, __) => const ProfileScreen(),
              routes: [
                GoRoute(path: 'pair', name: Routes.pairDevice, builder: (_, __) => const PairDeviceScreen()),
              ],
            ),
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
