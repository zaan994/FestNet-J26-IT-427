import 'package:flutter/material.dart';

import '../../models/enums.dart';

/// Palette shared with the dashboard (Dashboard/tailwind.config.ts).
class AppColors {
  AppColors._();

  static const brand = Color(0xFF4F46E5);
  static const brandDark = Color(0xFF1E1B4B);

  static const normal = Color(0xFF16A34A);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEA580C);
  static const critical = Color(0xFFDC2626);
  static const offline = Color(0xFF94A3B8);

  static Color forSeverity(Severity severity) => switch (severity) {
        Severity.none => normal,
        Severity.warning => warning,
        Severity.danger => danger,
        Severity.critical => critical,
      };
}
