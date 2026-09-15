/// Enums mirroring docs/database/schema.md (lowercase string values in RTDB).
library;

enum Role {
  participant,
  volunteer,
  medical,
  organiser;

  static Role parse(Object? value) =>
      Role.values.firstWhere((r) => r.name == value, orElse: () => Role.participant);
}

enum Severity {
  none,
  warning,
  danger,
  critical;

  static Severity parse(Object? value) =>
      Severity.values.firstWhere((s) => s.name == value, orElse: () => Severity.none);

  String get label => this == Severity.none ? 'Normal' : name[0].toUpperCase() + name.substring(1);
}

enum StressLevel {
  unknown,
  low,
  medium,
  high;

  static StressLevel parse(Object? value) =>
      StressLevel.values.firstWhere((s) => s.name == value, orElse: () => StressLevel.unknown);
}

enum MotionState {
  unknown,
  active,
  still,
  fall;

  static MotionState parse(Object? value) =>
      MotionState.values.firstWhere((s) => s.name == value, orElse: () => MotionState.unknown);
}
