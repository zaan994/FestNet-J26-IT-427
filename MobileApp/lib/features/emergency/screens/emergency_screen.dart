import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/attendee.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/device_providers.dart';
import '../../../providers/firebase_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/status_widgets.dart';

/// Manual SOS — independent of HRI, sensors and data quality: it works without a linked band
/// and is never suppressed by a low score or low confidence. Press and hold to avoid accidental
/// triggers. Requests are queued offline and delivered automatically when the phone reconnects.
class EmergencyScreen extends ConsumerWidget {
  const EmergencyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(sosRequestsProvider).valueOrNull ?? const <SosRequestStatus>[];
    final connected = ref.watch(connectedProvider).valueOrNull;
    final now = ref.watch(clockProvider).valueOrNull ?? DateTime.now();
    final latest = requests.isEmpty ? null : requests.first;
    final linked = ref.watch(attendeeLinkProvider).valueOrNull != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Emergency')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          if (connected == false)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: StatusChip(
                label: 'You are offline — SOS will be sent automatically when you reconnect',
                icon: Icons.cloud_off,
                tone: ChipTone.warning,
              ),
            ),
          const SizedBox(height: 12),
          const Center(child: _HoldToSos()),
          const SizedBox(height: 20),
          Text(
            'Press and hold for 2 seconds. Event staff will see your request with your band\'s last GPS fix (if available).',
            textAlign: TextAlign.center,
            style: TextStyle(color: context.festnet.muted),
          ),
          if (!linked) ...[
            const SizedBox(height: 8),
            Text(
              'No band is linked to this app, so staff will not see a location. SOS still works.',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.festnet.warning, fontSize: 12),
            ),
          ],
          const SizedBox(height: 24),
          if (latest != null) _StatusCard(request: latest, now: now),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Immediate danger?',
            icon: Icons.local_phone_outlined,
            child: Text(
              'If someone\'s life is at risk, also call the local emergency number and alert the nearest staff member or help point.',
              style: TextStyle(color: context.festnet.muted),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.request, required this.now});

  final SosRequestStatus request;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final (label, tone, icon) = request.rejected
        ? (request.error ?? 'Request could not be processed — try again or find staff.', ChipTone.critical, Icons.error_outline)
        : !request.delivered
            ? ('Sending… waiting for FestNet', ChipTone.warning, Icons.schedule_send)
            : (request.alertStatus?.label ?? 'Received by FestNet', request.closed ? ChipTone.normal : ChipTone.brand, Icons.mark_email_read_outlined);
    return SectionCard(
      title: 'Your latest SOS',
      icon: Icons.sos,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatusChip(label: label, icon: icon, tone: tone),
          const SizedBox(height: 8),
          Text('Pressed ${timeAgo(request.clientCreatedAt, now: now)}', style: TextStyle(fontSize: 12, color: context.festnet.muted)),
          if (!request.delivered && !request.rejected && now.difference(request.clientCreatedAt).inSeconds > 20)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Not confirmed yet. Keep the app open; if you can, go to the nearest staff member or help point.',
                style: TextStyle(color: context.festnet.warning, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
    );
  }
}

class _HoldToSos extends ConsumerStatefulWidget {
  const _HoldToSos();

  @override
  ConsumerState<_HoldToSos> createState() => _HoldToSosState();
}

class _HoldToSosState extends ConsumerState<_HoldToSos> with SingleTickerProviderStateMixin {
  late final AnimationController _hold = AnimationController(vsync: this, duration: const Duration(seconds: 2))
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) unawaited(_send());
    });
  bool _sending = false;

  Future<void> _send() async {
    final user = ref.read(authStateProvider).valueOrNull;
    if (user == null || _sending) return;
    setState(() => _sending = true);
    HapticFeedback.heavyImpact();
    try {
      await ref.read(attendeeRepositoryProvider).sendSos(user.uid);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('SOS sent to event staff.')));
      }
    } finally {
      _hold.reset();
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _hold.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final critical = context.festnet.critical;
    return Semantics(
      button: true,
      label: 'SOS. Press and hold for two seconds to alert event staff.',
      child: GestureDetector(
        onTapDown: (_) => _hold.forward(),
        onTapUp: (_) => _hold.isCompleted ? null : _hold.reverse(),
        onTapCancel: () => _hold.isCompleted ? null : _hold.reverse(),
        child: AnimatedBuilder(
          animation: _hold,
          builder: (context, _) => SizedBox(
            width: 220,
            height: 220,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox.expand(
                  child: CircularProgressIndicator(
                    value: _hold.value,
                    strokeWidth: 10,
                    color: critical,
                    backgroundColor: critical.withValues(alpha: 0.15),
                  ),
                ),
                Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: critical,
                    boxShadow: [BoxShadow(color: critical.withValues(alpha: 0.4), blurRadius: 30, spreadRadius: 2)],
                  ),
                  child: Center(
                    child: _sending
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.sos, size: 56, color: Colors.white),
                              Text('HOLD', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 2)),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
