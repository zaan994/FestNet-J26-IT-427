import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/enums.dart';
import '../../../models/responder.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/device_providers.dart';
import '../../../providers/responder_providers.dart';
import '../../../shared/extensions/context_extensions.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/status_widgets.dart';

/// C2 — Respond tab (medical, secondary, operators and volunteers).
/// Duty status + location sharing for nearby routing, push registration, and the alerts sent to me.
class RespondScreen extends ConsumerStatefulWidget {
  const RespondScreen({super.key});

  @override
  ConsumerState<RespondScreen> createState() => _RespondScreenState();
}

class _RespondScreenState extends ConsumerState<RespondScreen> {
  StreamSubscription<RemoteMessage>? _sub;
  final List<RemoteMessage> _live = [];

  @override
  void initState() {
    super.initState();
    _sub = ref.read(pushServiceProvider).foreground.listen((m) {
      if (mounted) setState(() => _live.insert(0, m));
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final roles = ref.watch(responderRolesProvider).valueOrNull ?? ResponderRoles.none;
    final inbox = ref.watch(inboxProvider);
    final location = ref.watch(dutyLocationProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Respond')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          if (!roles.isResponder)
            Text('This account has no responder role. Event staff can add you as a volunteer or responder.', style: TextStyle(color: context.festnet.muted))
          else ...[
            Text(roles.describe(), style: TextStyle(color: context.festnet.muted, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            for (final m in _live.take(2))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: StatusChip(label: '${m.notification?.title ?? 'New alert'} — ${m.notification?.body ?? ''}', icon: Icons.notifications_active, tone: ChipTone.critical),
              ),
            const _DutyCard(),
            const SizedBox(height: 16),
            Text('Alerts sent to me', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            inbox.when(
              loading: () => const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
              error: (_, __) => const Text('Could not load your alerts.'),
              data: (items) => items.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text('No alerts have been sent to you.', style: TextStyle(color: context.festnet.muted)),
                    )
                  : Column(children: [for (final a in items) _AlertCard(alert: a, me: location.position, canResolve: roles.canResolve(a.eventId))]),
            ),
          ],
        ],
      ),
    );
  }
}

class _DutyCard extends ConsumerWidget {
  const _DutyCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;
    final record = ref.watch(responderRecordProvider).valueOrNull ?? ResponderRecord.empty;
    final location = ref.watch(dutyLocationProvider);
    final push = ref.watch(pushRegistrationProvider);
    final now = ref.watch(clockProvider).valueOrNull ?? DateTime.now();
    final muted = context.festnet.muted;

    return SectionCard(
      title: 'On duty',
      icon: Icons.badge_outlined,
      trailing: Switch(
        value: record.onDuty,
        onChanged: user == null
            ? null
            : (v) async {
                try {
                  await ref.read(responderRepositoryProvider).setOnDuty(user.uid, v);
                } catch (e) {
                  if (context.mounted) context.showSnack(AppException.from(e).message, error: true);
                }
              },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            record.onDuty
                ? (location.error ?? (location.position != null ? 'Sharing your location (±${location.position!.accuracy.round()} m). Saved ${timeAgo(record.locationUpdatedAt, now: now)}.' : 'Waiting for your location…'))
                : 'Off duty — your location is not shared and you will not be picked for nearby alerts.',
            style: TextStyle(color: location.error != null ? context.festnet.warning : muted),
          ),
          const SizedBox(height: 10),
          push.when(
            loading: () => Text('Setting up notifications…', style: TextStyle(color: muted)),
            error: (_, __) => Text('Notifications could not be set up.', style: TextStyle(color: context.festnet.warning)),
            data: (msg) => Row(children: [
              Icon(msg == null ? Icons.notifications_active : Icons.notifications_off, size: 18, color: msg == null ? context.festnet.normal : context.festnet.warning),
              const SizedBox(width: 6),
              Expanded(child: Text(msg ?? 'Alert notifications are on for this phone.', style: TextStyle(color: muted, fontSize: 12))),
              if (msg != null) TextButton(onPressed: () => ref.invalidate(pushRegistrationProvider), child: const Text('Retry')),
            ]),
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends ConsumerStatefulWidget {
  const _AlertCard({required this.alert, required this.me, required this.canResolve});

  final InboxAlert alert;
  final Position? me;
  final bool canResolve;

  @override
  ConsumerState<_AlertCard> createState() => _AlertCardState();
}

class _AlertCardState extends ConsumerState<_AlertCard> {
  bool _busy = false;

  Future<void> _run(String type, {String? note}) async {
    final user = ref.read(authStateProvider).valueOrNull;
    if (user == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(responderRepositoryProvider).sendCommand(user.uid, type, {
        'eventId': widget.alert.eventId,
        'alertId': widget.alert.alertId,
        if (note != null) 'note': note,
      });
    } on AppException catch (e) {
      if (mounted) context.showSnack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resolve() async {
    final controller = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Resolve alert'),
        content: TextField(controller: controller, maxLength: 500, autofocus: true, decoration: const InputDecoration(labelText: 'What happened? (required)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Resolve')),
        ],
      ),
    );
    controller.dispose();
    if (note != null && note.isNotEmpty) await _run('resolveAlert', note: note);
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.alert;
    final now = ref.watch(clockProvider).valueOrNull ?? DateTime.now();
    final fx = context.festnet;
    final tone = switch (a.severity) {
      AlertSeverity.critical => ChipTone.critical,
      AlertSeverity.danger => ChipTone.danger,
      AlertSeverity.warning => ChipTone.warning,
    };
    final distance = widget.me != null && a.hasLocation
        ? Geolocator.distanceBetween(widget.me!.latitude, widget.me!.longitude, a.latitude!, a.longitude!).round()
        : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: a.unacknowledged ? fx.critical : fx.line, width: a.unacknowledged ? 2 : 1),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                StatusChip(label: a.severity.label, icon: Icons.warning_amber_rounded, tone: tone),
                Text(a.isSos ? 'SOS' : 'Health alert', style: const TextStyle(fontWeight: FontWeight.w800)),
                if (a.deviceId != null) Text(a.deviceId!, style: TextStyle(color: fx.muted)),
              ]),
              const SizedBox(height: 8),
              Text(a.summary),
              const SizedBox(height: 4),
              Text(
                [
                  a.status.label,
                  timeAgo(a.createdAt, now: now),
                  if (distance != null) 'about $distance m away',
                  if (a.fixAt != null) 'location ${timeAgo(a.fixAt, now: now)}' else 'no GPS fix',
                ].join(' · '),
                style: TextStyle(fontSize: 12, color: fx.muted),
              ),
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                if (a.unacknowledged)
                  FilledButton.icon(
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                    onPressed: _busy ? null : () => _run('acknowledgeAlert'),
                    icon: const Icon(Icons.check),
                    label: const Text('Acknowledge'),
                  ),
                if (a.unacknowledged || a.status == EmergencyStatus.acknowledged)
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
                    onPressed: _busy ? null : () => _run('markAlertInProgress'),
                    icon: const Icon(Icons.directions_run),
                    label: const Text('On my way'),
                  ),
                if (a.hasLocation)
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
                    onPressed: () => launchUrl(
                      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}'),
                      mode: LaunchMode.externalApplication,
                    ),
                    icon: const Icon(Icons.navigation_outlined),
                    label: const Text('Directions'),
                  ),
                if (widget.canResolve && (a.status == EmergencyStatus.acknowledged || a.status == EmergencyStatus.inProgress))
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
                    onPressed: _busy ? null : _resolve,
                    icon: const Icon(Icons.task_alt),
                    label: const Text('Resolve'),
                  ),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}
