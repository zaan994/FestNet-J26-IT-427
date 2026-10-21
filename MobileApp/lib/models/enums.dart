/// Enums mirroring Backend/functions/src/shared/schema.ts (lowercase/snake_case strings in RTDB).
library;

T _parse<T extends Enum>(List<T> values, Object? raw, String Function(T) key, T fallback) =>
    values.firstWhere((v) => key(v) == raw, orElse: () => fallback);

/// Quality grade of a derived metric. `unavailable` means: do not show a number.
enum MetricQuality {
  valid('valid'),
  lowQuality('low_quality'),
  unavailable('unavailable');

  const MetricQuality(this.key);
  final String key;
  static MetricQuality parse(Object? v) => _parse(values, v, (e) => e.key, MetricQuality.unavailable);
}

enum ActivityLevel {
  unknown('Unknown'),
  rest('Rest'),
  light('Light'),
  moderate('Moderate'),
  vigorous('Vigorous');

  const ActivityLevel(this.label);
  final String label;
  static ActivityLevel parse(Object? v) => _parse(values, v, (e) => e.name, ActivityLevel.unknown);
}

enum HriStatus {
  insufficientData('insufficient_data', 'Insufficient data'),
  low('low', 'Low'),
  elevated('elevated', 'Elevated'),
  high('high', 'High');

  const HriStatus(this.key, this.label);
  final String key;
  final String label;
  static HriStatus parse(Object? v) => _parse(values, v, (e) => e.key, HriStatus.insufficientData);
}

enum ConfidenceLevel {
  none('None'),
  low('Low'),
  medium('Medium'),
  high('High');

  const ConfidenceLevel(this.label);
  final String label;
  bool get isLow => this == ConfidenceLevel.none || this == ConfidenceLevel.low;
  static ConfidenceLevel parse(Object? v) => _parse(values, v, (e) => e.name, ConfidenceLevel.none);
}

enum EmergencyStatus {
  open('open', 'Sent — waiting for staff'),
  escalated('escalated', 'Escalated — more responders notified'),
  acknowledged('acknowledged', 'Staff acknowledged'),
  inProgress('in_progress', 'Help is on the way'),
  resolved('resolved', 'Resolved');

  const EmergencyStatus(this.key, this.label);
  final String key;
  final String label;
  static EmergencyStatus? tryParse(Object? v) => values.where((e) => e.key == v).firstOrNull;
}

/// C2 alert severity. SOS is always critical.
enum AlertSeverity {
  warning('Warning'),
  danger('Danger'),
  critical('Critical');

  const AlertSeverity(this.label);
  final String label;
  static AlertSeverity parse(Object? v) => _parse(values, v, (e) => e.name, AlertSeverity.critical);
}

/// Freshness from the time telemetry was RECEIVED, never from the band's `online` flag.
enum Freshness {
  live('Live'),
  stale('Stale'),
  offline('Offline'),
  unknown('No recent data');

  const Freshness(this.label);
  final String label;
}
