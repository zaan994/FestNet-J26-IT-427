import 'package:flutter/material.dart';

import '../../../shared/widgets/component_placeholder.dart';

/// C1 — health history & analysis (Rizvi M.Z.M.)
class HealthAnalysisScreen extends StatelessWidget {
  const HealthAnalysisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Health History')),
      body: const ComponentPlaceholder(
        icon: Icons.show_chart,
        component: 'Component 1 — Health Analysis',
        owner: 'Rizvi M.Z.M.',
        planned: [
          'BPM, SpO2, temperature and HRV (RMSSD) charts from devices/{id}/history (fl_chart)',
          '10 min / 1 h / whole event ranges',
          'Min / max / average summary',
        ],
      ),
    );
  }
}
