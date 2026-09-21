import 'package:flutter/material.dart';

import '../../models/enums.dart';

/// FestNet palette — shared with the dashboard (Dashboard/src/styles/index.css).
/// Light = "Festival Day", dark = "Festival Night". Brand = violet → magenta gradient.
class AppColors {
  AppColors._();

  // Brand
  static const violet = Color(0xFF7C3AED);
  static const violetLight = Color(0xFFA78BFA); // brand on dark backgrounds
  static const magenta = Color(0xFFDB2777);
  static const magentaLight = Color(0xFFEC4899);
  static const cyan = Color(0xFF0891B2);
  static const cyanLight = Color(0xFF22D3EE);
  static const brand = violet;

  static const brandGradient = LinearGradient(
    colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Festival Day (light)
  static const lightBg = Color(0xFFFAF7FF);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurface2 = Color(0xFFF3EEFF);
  static const lightLine = Color(0xFFE5DEF5);
  static const lightInk = Color(0xFF1B1033);
  static const lightMuted = Color(0xFF6B6085);

  // Festival Night (dark)
  static const darkBg = Color(0xFF0B0B1F);
  static const darkSurface = Color(0xFF15152E);
  static const darkSurface2 = Color(0xFF1E1E3E);
  static const darkLine = Color(0xFF2E2E56);
  static const darkInk = Color(0xFFF4F4FF);
  static const darkMuted = Color(0xFF9CA3C7);

  // Status — fixed in both themes, always shown with an icon + label.
  static const normal = Color(0xFF16A34A);
  static const warning = Color(0xFFF5A524);
  static const danger = Color(0xFFF97316);
  static const critical = Color(0xFFE11D48);
  static const offline = Color(0xFF94A3B8);

  static Color forSeverity(Severity severity) => switch (severity) {
        Severity.none => normal,
        Severity.warning => warning,
        Severity.danger => danger,
        Severity.critical => critical,
      };
}
