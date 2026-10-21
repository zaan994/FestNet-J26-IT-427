import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/labels.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/device_health.dart';
import '../../../providers/device_providers.dart';
import '../../../shared/widgets/section_card.dart';
import '../../../shared/widgets/status_widgets.dart';

/// C1 — HRI explanation: trend, contributing factors, confidence, inputs and disclaimer.
class HriScreen extends ConsumerStatefulWidget {
  const HriScreen({super.key});

  @override
  ConsumerState<HriScreen> createState() => _HriScreenState();
}

class _HriScreenState extends ConsumerState<HriScreen> {
  Duration _window = const Duration(hours: 1);

  @override
  Widget build(BuildContext context) {
    final health = ref.watch(linkedHealthProvider).valueOrNull;
    final history = ref.watch(historyProvider(_window));
    final hri = health?.hri;

    return Scaffold(
      appBar: AppBar(title: const Text('About my HRI')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: [
          const InfoBanner(text: AppConfig.hriDisclaimer),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Trend',
            icon: Icons.show_chart,
            trailing: SegmentedButton<Duration>(
              showSelectedIcon: false,
              style: const ButtonStyle(visualDensity: VisualDensity.compact),
              segments: const [
                ButtonSegment(value: Duration(minutes: 10), label: Text('10m')),
                ButtonSegment(value: Duration(hours: 1), label: Text('1h')),
                ButtonSegment(value: Duration(hours: 6), label: Text('6h')),
              ],
              selected: {_window},
              onSelectionChanged: (s) => setState(() => _window = s.first),
            ),
            child: history.when(
              loading: () => const SizedBox(height: 180, child: Center(child: CircularProgressIndicator())),
              error: (_, __) => const Text('Could not load your history.'),
              data: (points) => _HriChart(points: points),
            ),
          ),
          const SizedBox(height: 16),
          if (hri == null)
            const SectionCard(title: 'No indicator yet', child: Text('FestNet has not computed an indicator for your band yet.'))
          else ...[
            SectionCard(
              title: 'Right now',
              icon: Icons.insights,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(spacing: 8, runSpacing: 8, children: [HriChip(hri: hri), ConfidenceChip(level: hri.confidence)]),
                  const SizedBox(height: 10),
                  if (hri.score == null) const Text('No score: there is not enough good-quality data. This does not mean low risk.'),
                  if (hri.score != null && hri.confidence.isLow) const Text('Low confidence: the data quality is poor, so do not rely on this.'),
                  const SizedBox(height: 6),
                  Text(
                    hri.baselineAvailable ? 'Compared with your own resting baseline.' : 'Your personal baseline is still being learned.',
                    style: TextStyle(color: context.festnet.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SectionCard(
              title: 'Why',
              icon: Icons.list_alt,
              child: hri.factors.isEmpty
                  ? const Text('No rule is contributing at the moment.')
                  : Column(children: [for (final f in hri.factors) _FactorRow(factor: f)]),
            ),
            const SizedBox(height: 16),
            SectionCard(
              title: 'What was used',
              icon: Icons.sensors,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Used: ${hri.availableInputs.map(inputLabel).join(', ').ifEmpty('nothing')}'),
                  const SizedBox(height: 6),
                  Text('Missing: ${hri.missingInputs.map(inputLabel).join(', ').ifEmpty('nothing')}', style: TextStyle(color: context.festnet.muted)),
                  if (hri.flags.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text('Data quality issues: ${hri.flags.map(flagLabel).join('; ')}', style: TextStyle(color: context.festnet.warning)),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

class _FactorRow extends StatelessWidget {
  const _FactorRow({required this.factor});

  final HriFactor factor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(factor.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(factor.detail, style: TextStyle(fontSize: 12, color: context.festnet.muted)),
              ],
            ),
          ),
          Text('+${factor.points}', style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

/// HRI score over time. Gaps (no score) stay gaps — they are never drawn as 0.
class _HriChart extends StatelessWidget {
  const _HriChart({required this.points});

  final List<HistoryPoint> points;

  @override
  Widget build(BuildContext context) {
    final scored = points.where((p) => p.hriScore != null).toList();
    if (scored.isEmpty) {
      return SizedBox(
        height: 160,
        child: Center(child: Text('No indicator values in this period.', style: TextStyle(color: context.festnet.muted))),
      );
    }
    final primary = Theme.of(context).colorScheme.primary;
    final fx = context.festnet;
    final t0 = points.first.ts.millisecondsSinceEpoch.toDouble();
    // Break the line wherever a point has no score.
    final spots = <FlSpot>[
      for (final p in points) p.hriScore == null ? FlSpot.nullSpot : FlSpot((p.ts.millisecondsSinceEpoch - t0) / 60000, p.hriScore!.toDouble()),
    ];
    final fmt = DateFormat.Hm();
    return SizedBox(
      height: 190,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: 100,
          gridData: FlGridData(drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: fx.line, strokeWidth: 1)),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(),
            rightTitles: const AxisTitles(),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(showTitles: true, reservedSize: 30, interval: 25, getTitlesWidget: (v, _) => Text('${v.toInt()}', style: TextStyle(fontSize: 10, color: fx.muted))),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 22,
                getTitlesWidget: (v, meta) => v == meta.min || v == meta.max
                    ? Text(fmt.format(DateTime.fromMillisecondsSinceEpoch((t0 + v * 60000).round())), style: TextStyle(fontSize: 10, color: fx.muted))
                    : const SizedBox.shrink(),
              ),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: false,
              color: primary,
              barWidth: 2,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(show: true, color: primary.withValues(alpha: 0.12)),
            ),
          ],
        ),
      ),
    );
  }
}
