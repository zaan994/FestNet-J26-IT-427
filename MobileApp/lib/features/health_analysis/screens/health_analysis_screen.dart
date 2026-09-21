import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/thresholds.dart';
import '../../../providers/device_providers.dart';
import '../widgets/vital_history_chart.dart';

/// C1 — health history & analysis (Rizvi M.Z.M.)
///
/// Charts of the computed history (devices/{id}/history, one point every 10 s).
class HealthAnalysisScreen extends ConsumerStatefulWidget {
  const HealthAnalysisScreen({super.key});

  @override
  ConsumerState<HealthAnalysisScreen> createState() => _HealthAnalysisScreenState();
}

class _HealthAnalysisScreenState extends ConsumerState<HealthAnalysisScreen> {
  /// Number of 10-s history points: 10 min, 1 h, 6 h.
  int _points = 60;

  @override
  Widget build(BuildContext context) {
    final deviceId = ref.watch(pairedDeviceIdProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Health History')),
      body: deviceId == null
          ? const Center(child: Text('Pair a band to see your history.'))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 60, label: Text('10 min')),
                      ButtonSegment(value: 360, label: Text('1 hour')),
                      ButtonSegment(value: 2160, label: Text('6 hours')),
                    ],
                    selected: {_points},
                    onSelectionChanged: (s) => setState(() => _points = s.first),
                  ),
                ),
                Expanded(child: _HistoryCharts(deviceId: deviceId, points: _points)),
              ],
            ),
    );
  }
}

class _HistoryCharts extends ConsumerWidget {
  const _HistoryCharts({required this.deviceId, required this.points});

  final String deviceId;
  final int points;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(deviceHistoryProvider((deviceId, points)));

    return history.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Could not load history: $e')),
      data: (data) {
        if (data.length < 2) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Not enough data yet — a point is recorded every 10 seconds while your band is on.',
                  textAlign: TextAlign.center),
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            VitalHistoryChart(title: 'Heart rate', unit: 'bpm', points: data, value: (p) => p.bpm),
            const SizedBox(height: 12),
            VitalHistoryChart(
              title: 'Blood oxygen (SpO2)',
              unit: '%',
              points: data,
              value: (p) => p.spo2,
              minY: 80,
              maxY: 100,
              thresholds: const [ChartThreshold(94, 'alert < 94 %')],
            ),
            const SizedBox(height: 12),
            VitalHistoryChart(
              title: 'Body temperature (estimated core)',
              unit: '°C',
              points: data,
              value: (p) => p.coreEstC,
              decimals: 1,
              thresholds: const [ChartThreshold(Thresholds.coreTempHighC, 'alert > 38 °C')],
            ),
            const SizedBox(height: 12),
            VitalHistoryChart(title: 'Heart-rate variability (RMSSD)', unit: 'ms', points: data, value: (p) => p.rmssdMs),
            const SizedBox(height: 12),
            VitalHistoryChart(
              title: 'Stress score',
              unit: '/ 100',
              points: data,
              value: (p) => p.stressScore,
              minY: 0,
              maxY: 100,
            ),
          ],
        );
      },
    );
  }
}
