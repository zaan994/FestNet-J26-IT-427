import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Extra FestNet colours that Material's ColorScheme has no slot for.
/// Use: `context.festnet.muted`, `context.festnet.surface2` ...
@immutable
class FestNetColors extends ThemeExtension<FestNetColors> {
  const FestNetColors({required this.background, required this.surface2, required this.line, required this.muted});

  final Color background;
  final Color surface2;
  final Color line;
  final Color muted;

  static const light = FestNetColors(
    background: AppColors.lightBg,
    surface2: AppColors.lightSurface2,
    line: AppColors.lightLine,
    muted: AppColors.lightMuted,
  );

  static const dark = FestNetColors(
    background: AppColors.darkBg,
    surface2: AppColors.darkSurface2,
    line: AppColors.darkLine,
    muted: AppColors.darkMuted,
  );

  @override
  FestNetColors copyWith({Color? background, Color? surface2, Color? line, Color? muted}) => FestNetColors(
        background: background ?? this.background,
        surface2: surface2 ?? this.surface2,
        line: line ?? this.line,
        muted: muted ?? this.muted,
      );

  @override
  FestNetColors lerp(FestNetColors? other, double t) {
    if (other == null) return this;
    return FestNetColors(
      background: Color.lerp(background, other.background, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      line: Color.lerp(line, other.line, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
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

    final scheme = ColorScheme.fromSeed(seedColor: AppColors.violet, brightness: brightness).copyWith(
      primary: isDark ? AppColors.violetLight : AppColors.violet,
      onPrimary: isDark ? AppColors.lightInk : Colors.white,
      secondary: isDark ? AppColors.magentaLight : AppColors.magenta,
      onSecondary: Colors.white,
      tertiary: isDark ? AppColors.cyanLight : AppColors.cyan,
      surface: surface,
      onSurface: ink,
      onSurfaceVariant: fx.muted,
      surfaceContainerLowest: fx.background,
      surfaceContainerLow: surface,
      surfaceContainer: surface,
      surfaceContainerHigh: fx.surface2,
      surfaceContainerHighest: fx.surface2,
      outline: fx.muted,
      outlineVariant: fx.line,
      error: AppColors.critical,
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
        indicatorColor: scheme.primary.withValues(alpha: isDark ? 0.25 : 0.14),
        height: 70,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? scheme.primary : fx.muted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? scheme.primary : fx.muted),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: fx.line)),
        enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: fx.line)),
        focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.primary, width: 2)),
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
