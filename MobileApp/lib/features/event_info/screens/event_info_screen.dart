import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/attendee.dart';
import '../../../providers/device_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/status_widgets.dart';

/// Event & safety information from eventsPublic/{eventId} (no health data).
class EventInfoScreen extends ConsumerWidget {
  const EventInfoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final link = ref.watch(attendeeLinkProvider).valueOrNull;
    final info = ref.watch(eventPublicProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Event & Safety')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          if (link == null)
            const NotLinkedCard()
          else
            info.when(
              loading: () => const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
              error: (_, __) => const Text('Could not load event information.'),
              data: (i) => i == null ? const Text('The organisers have not published event information yet.') : _EventInfo(info: i),
            ),
          const SizedBox(height: 16),
          Text('More from FestNet', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Card(
            child: Column(children: [
              ListTile(
                leading: const Icon(Icons.map_outlined),
                title: const Text('Festival map'),
                subtitle: const Text('Component 3 · in development'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.goNamed(Routes.map),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.water_drop_outlined),
                title: const Text('Heat & hydration'),
                subtitle: const Text('Component 4 · in development'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.goNamed(Routes.wellness),
              ),
            ]),
          ),
        ],
      ),
    );
  }
}

class _EventInfo extends StatelessWidget {
  const _EventInfo({required this.info});

  final EventPublicInfo info;

  @override
  Widget build(BuildContext context) {
    final muted = context.festnet.muted;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionCard(
          title: info.name,
          icon: Icons.festival,
          trailing: info.demo ? const StatusChip(label: 'DEMO ONLY', icon: Icons.science_outlined, tone: ChipTone.warning) : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Status: ${info.status}', style: TextStyle(color: muted)),
              if (info.contact != null) ...[const SizedBox(height: 6), Text('Emergency contact: ${info.contact}')],
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Help points',
          icon: Icons.local_hospital_outlined,
          child: info.helpPoints.isEmpty
              ? Text('No help points published yet. Ask any staff member.', style: TextStyle(color: muted))
              : Column(
                  children: [
                    for (final h in info.helpPoints)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.place_outlined),
                        title: Text(h.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text([h.description, if (h.zone != null) 'Zone: ${h.zone}'].whereType<String>().join(' · ')),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Stay safe',
          icon: Icons.health_and_safety_outlined,
          child: info.safetyInfo.isEmpty
              ? Text('Drink water regularly, take breaks in the shade and look out for each other.', style: TextStyle(color: muted))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final s in info.safetyInfo)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('•  '),
                          Expanded(child: Text(s)),
                        ]),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
