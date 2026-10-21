import 'package:flutter/material.dart';

import '../../../shared/widgets/component_placeholder.dart';

/// C3 — Location & Crowd Tracking (Pemarathna P.A.J.)
class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Festival Map')),
      body: const ComponentPlaceholder(
        icon: Icons.map,
        component: 'Component 3 — Location & Crowd',
        owner: 'Pemarathna P.A.J.',
        planned: [
          'Google Maps with my live location and friend locator',
          'Crowd density heatmap',
          'Event zones (stages, exits, first aid, toilets) from events/{id}/zones',
        ],
      ),
    );
  }
}
