/// Helpers for parsing Firebase RTDB values, which arrive as `Map<Object?, Object?>`,
/// int or double interchangeably, and with fields missing.
///
/// Rule: a missing, wrong-typed, NaN/Infinity or out-of-range value becomes null — never 0.
library;

Map<String, dynamic> asMap(Object? value) {
  if (value is Map) return value.map((k, v) => MapEntry(k.toString(), v));
  return const {};
}

/// Finite number within [min, max], otherwise null.
double? asDouble(Object? value, {double min = double.negativeInfinity, double max = double.infinity}) {
  if (value is! num) return null;
  final d = value.toDouble();
  if (d.isNaN || d.isInfinite || d < min || d > max) return null;
  return d;
}

int? asInt(Object? value, {int? min, int? max}) {
  final d = asDouble(value);
  if (d == null) return null;
  final i = d.round();
  if ((min != null && i < min) || (max != null && i > max)) return null;
  return i;
}

bool asBool(Object? value, {bool fallback = false}) => value is bool ? value : fallback;

bool? asBoolOrNull(Object? value) => value is bool ? value : null;

String? asString(Object? value) => value is String && value.isNotEmpty ? value : null;

List<String> asStringList(Object? value) {
  if (value is List) return value.whereType<String>().toList();
  // RTDB may return arrays as maps with integer keys.
  if (value is Map) return value.values.whereType<String>().toList();
  return const [];
}

const _minValidEpochMs = 1700000000000; // Nov 2023 — earlier means the device clock is not synced

/// Plausible epoch ms (after Nov 2023, not more than a day in the future), else null.
DateTime? asEpoch(Object? value, {DateTime? now}) {
  final ms = asInt(value);
  if (ms == null || ms < _minValidEpochMs) return null;
  final limit = (now ?? DateTime.now()).add(const Duration(days: 1));
  final t = DateTime.fromMillisecondsSinceEpoch(ms);
  return t.isAfter(limit) ? null : t;
}
