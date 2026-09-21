import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/firebase_providers.dart';
import '../../../shared/dialogs/confirm_dialog.dart';
import '../../../shared/extensions/context_extensions.dart';
import '../../../shared/widgets/festnet_logo.dart';
import '../../../shared/widgets/gradient_button.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/theme_mode_selector.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _unpair(BuildContext context, WidgetRef ref, String uid, String deviceId) async {
    final ok = await showConfirmDialog(
      context,
      title: 'Unpair band?',
      message: 'You will stop receiving health data from $deviceId.',
      confirmLabel: 'Unpair',
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(userRepositoryProvider).unpairDevice(uid: uid, deviceId: deviceId);
    } catch (e) {
      if (context.mounted) context.showSnack(AppException.from(e).message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (profile) {
          if (profile == null) {
            return const Center(child: Text('Profile not found.'));
          }
          final name = profile.name.isEmpty ? profile.email : profile.name;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(24)),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: Colors.white.withValues(alpha: 0.2),
                      child: Text(name.characters.first.toUpperCase(),
                          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
                              overflow: TextOverflow.ellipsis),
                          Text(profile.email, style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(profile.role.name.toUpperCase(),
                                style: const TextStyle(
                                    color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SectionCard(
                title: 'My band',
                icon: Icons.watch_outlined,
                child: profile.hasBand
                    ? ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const FestNetLogo(size: 40, wordmark: false),
                        title: Text(profile.deviceId!, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: const Text('Paired'),
                        trailing: TextButton(
                          onPressed: () => _unpair(context, ref, profile.uid, profile.deviceId!),
                          child: const Text('Unpair'),
                        ),
                      )
                    : GradientButton(
                        label: 'Pair band',
                        icon: Icons.link,
                        onPressed: () => context.goNamed(Routes.pairDevice),
                      ),
              ),
              const SizedBox(height: 16),
              const SectionCard(
                title: 'Appearance',
                icon: Icons.palette_outlined,
                child: SizedBox(width: double.infinity, child: ThemeModeSelector()),
              ),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () => ref.read(authServiceProvider).signOut(),
                icon: const Icon(Icons.logout),
                label: const Text('Sign out'),
              ),
            ],
          );
        },
      ),
    );
  }
}
