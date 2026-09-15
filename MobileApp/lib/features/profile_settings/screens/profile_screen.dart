import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/routing/app_router.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/firebase_providers.dart';
import '../../../shared/dialogs/confirm_dialog.dart';
import '../../../shared/extensions/context_extensions.dart';
import '../../../shared/widgets/section_card.dart';

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
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionCard(
                title: profile.name.isEmpty ? profile.email : profile.name,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(profile.email),
                    const SizedBox(height: 8),
                    Chip(label: Text(profile.role.name)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'My band',
                child: profile.hasBand
                    ? ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.watch),
                        title: Text(profile.deviceId!),
                        trailing: TextButton(
                          onPressed: () => _unpair(context, ref, profile.uid, profile.deviceId!),
                          child: const Text('Unpair'),
                        ),
                      )
                    : FilledButton.icon(
                        onPressed: () => context.goNamed(Routes.pairDevice),
                        icon: const Icon(Icons.link),
                        label: const Text('Pair band'),
                      ),
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
