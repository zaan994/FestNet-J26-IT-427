import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/device_health.dart';
import '../../../shared/widgets/section_card.dart';

/// Chart tokens (same as the dashboard's VitalChart).
// Chart colours follow the active theme (light / night): series = brand, grid = line, axis = muted.

class ChartThreshold {
  const ChartThreshold(this.value, this.label);
  final double value;
  final String label;
}

/// One vital over time: single series, one y-axis, threshold lines with labels,
/// touch tooltip, and a min / avg / max summary underneath.
class VitalHistoryChart extends StatelessWidget {
  const VitalHistoryChart({
    super.key,
    required this.title,
    required this.unit,
    required this.points,
    required this.value,
    this.decimals = 0,
    this.minY,
    this.maxY,
    this.thresholds = const [],
  });

  final String title;
  final String unit;
  final List<HistoryPoint> points;
  final double? Function(HistoryPoint) value;
  final int decimals;
  final double? minY;
  final double? maxY;
  final List<ChartThreshold> thresholds;

  @override
  Widget build(BuildContext context) {
    final values = points.map(value).whereType<double>().toList();
    final theme = Theme.of(context);

    return SectionCard(
      title: title,
      trailing: Text(unit, style: theme.textTheme.bodySmall),
      child: values.isEmpty
          ? const SizedBox(height: 160, child: Center(child: Text('No data in this range')))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 180, child: LineChart(_chartData(context, values))),
                const SizedBox(height: 8),
                Text(
                  'min ${formatNumber(values.reduce(math.min), decimals: decimals)} · '
                  'avg ${formatNumber(values.reduce((a, b) => a + b) / values.length, decimals: decimals)} · '
                  'max ${formatNumber(values.reduce(math.max), decimals: decimals)} $unit',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
    );
  }

  LineChartData _chartData(BuildContext context, List<double> values) {
    final scheme = Theme.of(context).colorScheme;
    final series = scheme.primary;
    final grid = context.festnet.line;
    final axis = context.festnet.muted;

    // Missing readings break the line instead of being joined across the gap.
    final spots = points.map((p) {
      final v = value(p);
      return v == null ? FlSpot.nullSpot : FlSpot(p.ts.millisecondsSinceEpoch.toDouble(), v);
    }).toList();

    final lo = minY ?? (values.reduce(math.min) - 2).floorToDouble();
    final hi = maxY ?? (values.reduce(math.max) + 2).ceilToDouble();
    final spanMs = points.last.ts.difference(points.first.ts).inMilliseconds.toDouble();
    final timeFormat = DateFormat.Hm();

    return LineChartData(
      minY: lo,
      maxY: hi,
      clipData: const FlClipData.all(),
      gridData: FlGridData(
        drawVerticalLine: false,
        getDrawingHorizontalLine: (_) => FlLine(color: grid, strokeWidth: 1),
      ),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 36,
            getTitlesWidget: (v, meta) => Text(
              v.toStringAsFixed(decimals),
              style: TextStyle(color: axis, fontSize: 10),
            ),
          ),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 22,
            interval: spanMs > 0 ? spanMs / 3 : null,
            getTitlesWidget: (v, meta) => Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                timeFormat.format(DateTime.fromMillisecondsSinceEpoch(v.toInt())),
                style: TextStyle(color: axis, fontSize: 10),
              ),
            ),
          ),
        ),
      ),
      extraLinesData: ExtraLinesData(
        horizontalLines: [
          for (final t in thresholds)
            HorizontalLine(
              y: t.value,
              color: AppColors.critical,
              strokeWidth: 1,
              dashArray: const [4, 4],
              label: HorizontalLineLabel(
                show: true,
                alignment: Alignment.topRight,
                style: TextStyle(color: axis, fontSize: 10),
                labelResolver: (_) => t.label,
              ),
            ),
        ],
      ),
      lineTouchData: LineTouchData(
        touchTooltipData: LineTouchTooltipData(
          getTooltipColor: (_) => scheme.surface,
          tooltipBorder: BorderSide(color: grid),
          getTooltipItems: (spots) => spots
              .map((s) => LineTooltipItem(
                    '${DateFormat.Hms().format(DateTime.fromMillisecondsSinceEpoch(s.x.toInt()))}\n',
                    TextStyle(color: axis, fontSize: 11),
                    children: [
                      TextSpan(
                        text: '${s.y.toStringAsFixed(decimals)} $unit',
                        style: TextStyle(color: scheme.onSurface, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ],
                  ))
              .toList(),
        ),
      ),
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          preventCurveOverShooting: true,
          color: series,
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [series.withValues(alpha: 0.25), series.withValues(alpha: 0)],
            ),
          ),
          barWidth: 2,
          dotData: const FlDotData(show: false),
        ),
      ],
    );
  }
}
