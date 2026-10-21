import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Extra FestNet colours that Material's ColorScheme has no slot for.
/// Use: `context.festnet.muted`, `context.festnet.critical` ...
/// Status colours are theme-specific (darker in light mode, lighter in dark mode for contrast)
/// and are always shown together with an icon and a text label.
@immutable
class FestNetColors extends ThemeExtension<FestNetColors> {
  const FestNetColors({
    required this.background,
    required this.surface2,
    required this.elevated,
    required this.line,
    required this.muted,
    required this.normal,
    required this.warning,
    required this.danger,
    required this.critical,
  });

  final Color background;
  final Color surface2;
  final Color elevated;
  final Color line;
  final Color muted;
  final Color normal;
  final Color warning;
  final Color danger;
  final Color critical;

  static const light = FestNetColors(
    background: AppColors.lightBg,
    surface2: AppColors.lightSurface2,
    elevated: AppColors.lightElevated,
    line: AppColors.lightLine,
    muted: AppColors.lightMuted,
    normal: AppColors.lightNormal,
    warning: AppColors.lightWarning,
    danger: AppColors.lightDanger,
    critical: AppColors.lightCritical,
  );

  static const dark = FestNetColors(
    background: AppColors.darkBg,
    surface2: AppColors.darkSurface2,
    elevated: AppColors.darkElevated,
    line: AppColors.darkLine,
    muted: AppColors.darkMuted,
    normal: AppColors.darkNormal,
    warning: AppColors.darkWarning,
    danger: AppColors.darkDanger,
    critical: AppColors.darkCritical,
  );

  @override
  FestNetColors copyWith({
    Color? background,
    Color? surface2,
    Color? elevated,
    Color? line,
    Color? muted,
    Color? normal,
    Color? warning,
    Color? danger,
    Color? critical,
  }) =>
      FestNetColors(
        background: background ?? this.background,
        surface2: surface2 ?? this.surface2,
        elevated: elevated ?? this.elevated,
        line: line ?? this.line,
        muted: muted ?? this.muted,
        normal: normal ?? this.normal,
        warning: warning ?? this.warning,
        danger: danger ?? this.danger,
        critical: critical ?? this.critical,
      );

  @override
  FestNetColors lerp(FestNetColors? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return FestNetColors(
      background: l(background, other.background),
      surface2: l(surface2, other.surface2),
      elevated: l(elevated, other.elevated),
      line: l(line, other.line),
      muted: l(muted, other.muted),
      normal: l(normal, other.normal),
      warning: l(warning, other.warning),
      danger: l(danger, other.danger),
      critical: l(critical, other.critical),
    );
  }
}

class AppTheme {
  AppTheme._();

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final fx = isDark ? FestNetColors.dark : FestNetColors.light;
    final ink = isDark ? AppColors.darkInk : AppColors.lightInk;
    final surface = isDark ? AppColors.darkSurface : AppColors.lightSurface;
    final primary = isDark ? AppColors.darkPrimary : AppColors.lightPrimary;

    final scheme = ColorScheme.fromSeed(seedColor: AppColors.lightPrimary, brightness: brightness).copyWith(
      primary: primary,
      onPrimary: isDark ? AppColors.darkBg : Colors.white,
      secondary: isDark ? AppColors.darkSecondary : AppColors.lightSecondary,
      onSecondary: isDark ? AppColors.darkBg : Colors.white,
      surface: surface,
      onSurface: ink,
      onSurfaceVariant: fx.muted,
      surfaceContainerLowest: fx.background,
      surfaceContainerLow: surface,
      surfaceContainer: surface,
      surfaceContainerHigh: fx.surface2,
      surfaceContainerHighest: fx.elevated,
      outline: fx.muted,
      outlineVariant: fx.line,
      error: fx.critical,
      onError: isDark ? AppColors.darkBg : Colors.white,
    );

    final radius = BorderRadius.circular(14);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: fx.background,
      extensions: [fx],
      dividerColor: fx.line,
      appBarTheme: AppBarTheme(
        backgroundColor: fx.background,
        foregroundColor: ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: ink, letterSpacing: -0.5),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: fx.line)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: primary.withValues(alpha: isDark ? 0.22 : 0.14),
        height: 70,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? primary : fx.muted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? primary : fx.muted),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: fx.line)),
        enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: fx.line)),
        focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: primary, width: 2)),
        labelStyle: TextStyle(color: fx.muted),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: radius),
          side: BorderSide(color: fx.line),
          foregroundColor: ink,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: fx.surface2,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        labelStyle: TextStyle(color: ink, fontWeight: FontWeight.w600, fontSize: 12),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: radius),
      ),
      textTheme: Typography.material2021(platform: TargetPlatform.android).black.apply(
            bodyColor: ink,
            displayColor: ink,
          ),
    );
  }
}

extension FestNetThemeX on BuildContext {
  FestNetColors get festnet => Theme.of(this).extension<FestNetColors>()!;
}
