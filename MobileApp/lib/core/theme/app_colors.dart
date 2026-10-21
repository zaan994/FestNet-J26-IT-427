import 'package:flutter/material.dart';

/// FestNet palette — identical to the dashboard tokens (Dashboard/src/styles/index.css).
/// Brand = teal (primary) → sky (secondary).
class AppColors {
  AppColors._();

  // ---- Light ----
  static const lightBg = Color(0xFFF5F8FC);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurface2 = Color(0xFFEDF3F8); // surface-secondary
  static const lightElevated = Color(0xFFFFFFFF);
  static const lightPrimary = Color(0xFF0D9488);
  static const lightPrimaryHover = Color(0xFF0F766E);
  static const lightSecondary = Color(0xFF0284C7);
  static const lightInk = Color(0xFF0F172A);
  static const lightMuted = Color(0xFF475569);
  static const lightLine = Color(0xFFDCE5EF);
  static const lightNormal = Color(0xFF15803D);
  static const lightWarning = Color(0xFFA16207);
  static const lightDanger = Color(0xFFC2410C);
  static const lightCritical = Color(0xFFDC2626);

  // ---- Dark ----
  static const darkBg = Color(0xFF0B1220);
  static const darkSurface = Color(0xFF172337);
  static const darkSurface2 = Color(0xFF111C2E);
  static const darkElevated = Color(0xFF202E43);
  static const darkPrimary = Color(0xFF14B8A6);
  static const darkPrimaryHover = Color(0xFF2DD4BF);
  static const darkSecondary = Color(0xFF38BDF8);
  static const darkInk = Color(0xFFF8FAFC);
  static const darkMuted = Color(0xFF94A3B8);
  static const darkLine = Color(0xFF26364B);
  static const darkNormal = Color(0xFF34D399);
  static const darkWarning = Color(0xFFFBBF24);
  static const darkDanger = Color(0xFFFB923C);
  static const darkCritical = Color(0xFFF87171);

  /// Brand colour for artwork that is the same in both themes (logo, gradient buttons).
  static const brand = lightPrimary;

  static const brandGradient = LinearGradient(
    colors: [lightPrimary, lightSecondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
