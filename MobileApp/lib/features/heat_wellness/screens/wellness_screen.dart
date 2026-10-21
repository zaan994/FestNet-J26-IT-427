import 'package:flutter/material.dart';

import '../../../shared/widgets/component_placeholder.dart';

/// C4 — Hydration & Wellness Management (Bandara W.M.T.N.)
class WellnessScreen extends StatelessWidget {
  const WellnessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Heat & Wellness')),
      body: const ComponentPlaceholder(
        icon: Icons.water_drop,
        component: 'Component 4 — Hydration & Wellness',
        owner: 'Bandara W.M.T.N.',
        planned: [
          'Colour-coded heat stress indicator (Low / Moderate / High / Critical)',
          'Personalised hydration reminders and water intake log',
          'Wellness dashboard and post-event wellness report',
        ],
      ),
    );
  }
}
