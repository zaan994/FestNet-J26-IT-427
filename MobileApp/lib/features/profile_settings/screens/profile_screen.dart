import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/device_providers.dart';
import '../../../providers/firebase_providers.dart';
import '../../../providers/responder_providers.dart';
import '../../../shared/extensions/context_extensions.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/theme_mode_selector.dart';

/// Privacy & Settings: what FestNet stores about you, who can see it, display name and theme.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _editName(BuildContext context, WidgetRef ref, String uid, String current) async {
    final controller = TextEditingController(text: current);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Display name'),
        content: TextField(controller: controller, maxLength: 80, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.isEmpty) return;
    try {
      await ref.read(userRepositoryProvider).saveProfile(uid: uid, displayName: name);
    } catch (e) {
      if (context.mounted) context.showSnack(AppException.from(e).message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final link = ref.watch(attendeeLinkProvider).valueOrNull;
    final event = ref.watch(eventPublicProvider).valueOrNull;
    final muted = context.festnet.muted;
    final name = (profile?.displayName.isNotEmpty ?? false) ? profile!.displayName : (user?.email ?? 'FestNet user');

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(24)),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  child: Text(name.characters.first.toUpperCase(),
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white)),
                      if (user?.email != null) Text(user!.email!, style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
                    ],
                  ),
                ),
                if (user != null)
                  IconButton(
                    tooltip: 'Edit display name',
                    icon: const Icon(Icons.edit, color: Colors.white),
                    onPressed: () => _editName(context, ref, user.uid, profile?.displayName ?? ''),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Your data',
            icon: Icons.privacy_tip_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('• Your band sends raw sensor data. FestNet\'s server turns it into the values you see; this app never calculates health values.'),
                const SizedBox(height: 6),
                Text(
                  link == null
                      ? '• No band is linked, so no health data is connected to this account.'
                      : '• Your band data is stored under a pseudonymous participant ID (${link.participantId}) — not your name.',
                ),
                const SizedBox(height: 6),
                const Text('• Event operators and medical responders of your event can see your band\'s health status and last GPS fix to help you. Device administrators manage the hardware and cannot see health data.'),
                const SizedBox(height: 6),
                const Text('• If you raise an SOS or an alert is triggered, nearby on-duty volunteers may receive the location and a short reason — never your health details or name.'),
                const SizedBox(height: 6),
                const Text('• Research use only happens with the consent you gave at the desk, using de-identified data.'),
                if (event?.dataRetention != null) ...[const SizedBox(height: 6), Text('• Retention: ${event!.dataRetention}')],
                if (event?.privacyContact != null) ...[const SizedBox(height: 6), Text('• Privacy questions: ${event!.privacyContact}')],
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'About the Health Risk Indicator',
            icon: Icons.insights,
            child: Text(AppConfig.hriDisclaimer, style: TextStyle(color: muted)),
          ),
          const SizedBox(height: 16),
          const SectionCard(
            title: 'Appearance',
            icon: Icons.palette_outlined,
            child: SizedBox(width: double.infinity, child: ThemeModeSelector()),
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.watch_outlined),
              title: const Text('My Device'),
              subtitle: Text(link == null ? 'Link a FestNet band' : link.deviceId),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.goNamed(Routes.device),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () async {
              // Responders: stop push to this phone and go off duty before signing out.
              if (user != null && ref.read(isResponderProvider)) {
                try {
                  await ref.read(responderRepositoryProvider).setOnDuty(user.uid, false);
                } catch (_) {}
                await ref.read(pushServiceProvider).unregister();
              }
              await ref.read(authServiceProvider).signOut();
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
