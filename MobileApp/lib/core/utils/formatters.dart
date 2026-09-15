/// Formats a possibly-missing number: formatNumber(36.456, 1, '°C') -> '36.5°C', null -> '—'.
String formatNumber(num? value, {int decimals = 0, String unit = ''}) {
  if (value == null || value.isNaN || value.isInfinite) return '—';
  return '${value.toStringAsFixed(decimals)}$unit';
}

/// 'just now', '12 s ago', '3 min ago', '2 h ago'.
String timeAgo(DateTime? time, {DateTime? now}) {
  if (time == null) return 'never';
  final diff = (now ?? DateTime.now()).difference(time);
  if (diff.inSeconds < 3) return 'just now';
  if (diff.inSeconds < 60) return '${diff.inSeconds} s ago';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
  return '${diff.inHours} h ago';
}
