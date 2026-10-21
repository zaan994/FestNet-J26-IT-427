import '../../models/device_health.dart';
import '../../models/enums.dart';

const unavailable = 'Not available yet';

/// Formats a possibly-missing number: formatNumber(36.456, decimals: 1, unit: ' °C') -> '36.5 °C'.
String formatNumber(num? value, {int decimals = 0, String unit = '', String fallback = unavailable}) {
  if (value == null || value.isNaN || value.isInfinite) return fallback;
  return '${value.toStringAsFixed(decimals)}$unit';
}

/// 'just now', '12 s ago', '3 min ago', '2 h ago'.
String timeAgo(DateTime? time, {DateTime? now}) {
  if (time == null) return 'never';
  final diff = (now ?? DateTime.now()).difference(time);
  if (diff.inSeconds < 3) return 'just now';
  if (diff.inSeconds < 60) return '${diff.inSeconds} s ago';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
  if (diff.inHours < 48) return '${diff.inHours} h ago';
  return '${diff.inDays} d ago';
}

// ---- Display rules (same as the dashboard) ----

/// Heart rate only when the backend graded it valid and the band is worn.
String bpmText(DeviceHealth? h) {
  if (h == null || !h.worn || h.heartRate.quality != MetricQuality.valid) return unavailable;
  return formatNumber(h.heartRate.bpm, unit: ' bpm');
}

/// SpO2 is never shown unless the backend explicitly enables display.
/// Research note (code only): the SpO2 curve is uncalibrated; UI wording stays neutral by design.
String spo2Text(DeviceHealth? h) {
  if (h == null || !h.spo2.displayEnabled) return unavailable;
  if (!h.worn || h.heartRate.quality != MetricQuality.valid) return unavailable;
  return formatNumber(h.spo2.value, unit: ' %');
}

String hrvText(DeviceHealth? h) {
  if (h == null || h.hrv.quality != MetricQuality.valid) return unavailable;
  return formatNumber(h.hrv.rmssdMs, unit: ' ms');
}

String surfaceTempText(double? c) => formatNumber(c, decimals: 1, unit: ' °C');
