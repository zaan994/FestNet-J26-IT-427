import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/config/app_config.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/attendee.dart';
import '../../../models/device_latest.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/device_providers.dart';
import '../../../providers/firebase_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/status_widgets.dart';

/// My Device — link a band with the ONE-TIME claim code that staff show at the desk.
/// Attendees can never claim a band by typing its device ID.
class MyDeviceScreen extends ConsumerWidget {
  const MyDeviceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final link = ref.watch(attendeeLinkProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Device')),
      body: link.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Padding(padding: EdgeInsets.all(24), child: Text('Could not load your device link.')),
        data: (l) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
          children: [
            if (l == null) const _ClaimCard() else _LinkedDevice(link: l),
          ],
        ),
      ),
    );
  }
}

class _LinkedDevice extends ConsumerWidget {
  const _LinkedDevice({required this.link});

  final AttendeeLink link;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(clockProvider).valueOrNull ?? DateTime.now();
    final snapshot = ref.watch(linkedSnapshotProvider).valueOrNull;
    final latest = snapshot?.latest;
    final lastSeen = snapshot?.lastSeenAt;
    final fmt = DateFormat.yMMMd().add_Hm();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionCard(
          title: link.deviceId,
          icon: Icons.watch,
          trailing: FreshnessChip(freshness: freshnessOf(lastSeen, now), age: timeAgo(lastSeen, now: now)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Row('Participant ID', link.participantId),
              _Row('Linked', link.linkedAt == null ? '—' : fmt.format(link.linkedAt!)),
              _Row('Firmware', latest?.fwVersion ?? unavailable),
              _Row('Battery', latest?.batteryPct == null ? 'Not measured by this band' : '${latest!.batteryPct} %'),
              _Row('Band clock', latest == null ? unavailable : (latest.clockSynced ? 'Synchronised' : 'Not synchronised')),
              _Row('GPS', _gpsText(latest, lastSeen, now)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Sensors',
          icon: Icons.memory,
          trailing: const InfoButton(
            title: 'Sensors',
            text: '"Detected" means the sensor answered when the band started. It does not mean the current reading is valid — '
                'see Signal quality on My Health.',
          ),
          child: Column(
            children: [
              _SensorRow('Pulse sensor (MAX30102)', latest?.sensors.ppg),
              _SensorRow('Motion sensor (MPU6050)', latest?.sensors.imu),
              _SensorRow('Temperature sensor (MLX90614)', latest?.sensors.temperature),
              _SensorRow('GPS fix', latest?.sensors.gps),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Returning the band at the desk ends the link automatically. Your data stays tied to this assignment only and is never mixed with the next wearer.',
          style: TextStyle(fontSize: 12, color: context.festnet.muted),
        ),
      ],
    );
  }

  String _gpsText(DeviceLatest? latest, DateTime? lastSeen, DateTime now) {
    if (latest == null) return unavailable;
    if (latest.latitude == null) return 'No fix';
    if (lastSeen == null || now.difference(lastSeen) > AppConfig.gpsStaleAfter) return 'Fix is out of date';
    return 'Current fix';
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          SizedBox(width: 120, child: Text(label, style: TextStyle(color: context.festnet.muted))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ]),
      );
}

class _SensorRow extends StatelessWidget {
  const _SensorRow(this.label, this.detected);

  final String label;
  final bool? detected;

  @override
  Widget build(BuildContext context) {
    final chip = switch (detected) {
      true => const StatusChip(label: 'Detected', icon: Icons.check, tone: ChipTone.normal),
      false => const StatusChip(label: 'Not detected', icon: Icons.close, tone: ChipTone.danger),
      null => const StatusChip(label: 'Unknown', icon: Icons.help_outline),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [Expanded(child: Text(label)), chip]),
    );
  }
}

class _ClaimCard extends ConsumerStatefulWidget {
  const _ClaimCard();

  @override
  ConsumerState<_ClaimCard> createState() => _ClaimCardState();
}

class _ClaimCardState extends ConsumerState<_ClaimCard> {
  final _code = TextEditingController();
  bool _busy = false;
  bool _scanning = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _claim(String code) async {
    final user = ref.read(authStateProvider).valueOrNull;
    if (user == null || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _scanning = false;
    });
    try {
      await ref.read(attendeeRepositoryProvider).claimDevice(user.uid, code);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Band linked.')));
    } on AppException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Something went wrong. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Link your band',
      icon: Icons.qr_code_scanner,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'At the FestNet desk, staff give you a band and show a one-time code (valid 15 minutes). Scan it or type it here.',
            style: TextStyle(color: context.festnet.muted),
          ),
          const SizedBox(height: 16),
          if (_scanning)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: SizedBox(
                height: 260,
                child: MobileScanner(
                  onDetect: (capture) {
                    final value = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
                    if (value != null && !_busy) _claim(value);
                  },
                ),
              ),
            )
          else
            OutlinedButton.icon(
              onPressed: _busy ? null : () => setState(() => _scanning = true),
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan claim code'),
            ),
          if (_scanning)
            TextButton(onPressed: () => setState(() => _scanning = false), child: const Text('Cancel scanning')),
          const SizedBox(height: 16),
          TextField(
            controller: _code,
            textCapitalization: TextCapitalization.characters,
            maxLength: 12,
            decoration: const InputDecoration(labelText: 'Or type the 8-character claim code', counterText: ''),
            onSubmitted: _claim,
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ? null : () => _claim(_code.text),
            child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)) : const Text('Link band'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: context.festnet.critical, fontWeight: FontWeight.w600)),
          ],
        ],
      ),
    );
  }
}
