/// Helpers for parsing Firebase RTDB values, which arrive as Map<Object?, Object?>,
/// int or double interchangeably, and with fields missing.
library;

Map<String, dynamic> asMap(Object? value) {
  if (value is Map) return value.map((k, v) => MapEntry(k.toString(), v));
  return const {};
}

double? asDouble(Object? value) => value is num ? value.toDouble() : null;

int? asInt(Object? value) => value is num ? value.toInt() : null;

bool asBool(Object? value, {bool fallback = false}) => value is bool ? value : fallback;

String? asString(Object? value) => value is String ? value : null;

List<String> asStringList(Object? value) {
  if (value is List) return value.whereType<String>().toList();
  // RTDB may return arrays as maps with integer keys.
  if (value is Map) return value.values.whereType<String>().toList();
  return const [];
}
