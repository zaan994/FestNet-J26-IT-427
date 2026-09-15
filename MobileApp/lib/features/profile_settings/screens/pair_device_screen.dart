import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_exception.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/firebase_providers.dart';
import '../../../shared/extensions/context_extensions.dart';

/// Pair a band by its ID (printed on the band / shown on its OLED, e.g. FESTNET_001).
class PairDeviceScreen extends ConsumerStatefulWidget {
  const PairDeviceScreen({super.key});

  @override
  ConsumerState<PairDeviceScreen> createState() => _PairDeviceScreenState();
}

class _PairDeviceScreenState extends ConsumerState<PairDeviceScreen> {
  final _controller = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _pair() async {
    final user = ref.read(authStateProvider).valueOrNull;
    final deviceId = _controller.text.trim();
    if (user == null || deviceId.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(userRepositoryProvider).pairDevice(uid: user.uid, deviceId: deviceId);
      if (!mounted) return;
      context.showSnack('Band paired');
      context.pop();
    } catch (e) {
      if (mounted) context.showSnack(AppException.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pair band')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text('Enter the ID of your FestNet band.'),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Band ID', hintText: 'FESTNET_001'),
            onSubmitted: (_) => _pair(),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy ? null : _pair,
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Pair'),
          ),
        ],
      ),
    );
  }
}
