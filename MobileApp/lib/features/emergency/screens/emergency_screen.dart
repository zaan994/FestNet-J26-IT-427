import 'package:flutter/material.dart';

import '../../../shared/widgets/component_placeholder.dart';

/// C2 — Emergency Alert System (Manubasha K.D.C.)
class EmergencyScreen extends StatelessWidget {
  const EmergencyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: const ComponentPlaceholder(
        icon: Icons.sos,
        component: 'Component 2 — Emergency Alerts',
        owner: 'Manubasha K.D.C.',
        planned: [
          'SOS status of my band and in-app SOS trigger',
          'FCM push alerts (Warning / Danger / Critical) for medical team and volunteers',
          'Volunteer view: nearby emergencies within 50 m, one-tap acknowledge, navigate to location',
        ],
      ),
    );
  }
}
