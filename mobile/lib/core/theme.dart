/// ChillnGo design tokens: the web app's "void" theme (web/src/styles/
/// theme-void.css, turned on by data-theme="void" in web/index.html). True
/// black, flat #111 panels with hairlines, white type, one blue action colour
/// (#0099FF), coral only for live, monospace for labels and figures.
///
/// The token names come from the earlier "National Park" theme, so every
/// screen picks the new look up from here. Elevation, darkest to lightest:
/// canopy = ground < well < surface < card < raised < hover.
library;

import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

abstract final class AppColors {
  static const canopy = Color(0xFF000000);
  static const well = Color(0xFF080808);
  static const ground = Color(0xFF000000);
  static const surface = Color(0xFF0D0D0D);
  static const card = Color(0xFF111111);
  static const raised = Color(0xFF1E1E1E);
  static const hover = Color(0xFF262626);

  /// Tags and secondary icons: neutral grey.
  static const sage = Color(0xFF999999);

  /// Status-good and photo actions.
  static const moss = Color(0xFF00BB88);
  static const teal = Color(0xFF00BB88);

  /// The accent as text (7.8:1 on black).
  static const ochre = Color(0xFF33ADFF);

  /// Highlights: white, used at low alpha.
  static const beige = Color(0xFFFFFFFF);

  /// Headings.
  static const cream = Color(0xFFFFFFFF);

  /// Running text.
  static const body = Color(0xFFE6E6E6);

  /// Metadata, captions (6.4:1 on #111).
  static const meta = Color(0xFF999999);

  /// The single action colour. Labels on it are black (7:1), not white (3:1).
  static const primary = Color(0xFF0099FF);
  static const primaryPress = Color(0xFF0080D6);
  static const onPrimary = Color(0xFF000000);

  /// Live status only: a signal, not decoration.
  static const social = Color(0xFFF07C6C);
  static const live = Color(0xFFE11D48);

  static const destructive = Color(0xFFE5534B);
  static const success = Color(0xFF00BB88);

  /// Hairlines: resting lines, then stronger ones (fields, hover).
  static const border = Color(0x14FFFFFF);
  static const borderStrong = Color(0x29FFFFFF);
  static const scrim = Color(0xB3000000);
  static const shadow = Color(0xFF000000);
  static const white = Color(0xFFFFFFFF);
  static const black = Color(0xFF000000);
  static const overlay = Color(0x73000000);
}

abstract final class AppFonts {
  static const display = 'PlusJakartaSans';
  static const body = 'Inter';

  /// Labels, figures and status chips read as tool UI.
  static const mono = 'JetBrainsMono';
}

/// Slight corners throughout (web: --radius 8px, buttons 10px); chips stay round.
abstract final class AppRadius {
  static const sm = 6.0;
  static const md = 10.0;
  static const lg = 14.0;
  static const xl = 18.0;
  static const pill = 999.0;
}

/// The horizontal padding every screen uses.
const double kGutter = 16;

/// Display type is medium-weight with tight negative tracking; tighter than
/// this and Vietnamese diacritics start to touch.
abstract final class AppText {
  static const hero = TextStyle(
    fontFamily: AppFonts.display,
    fontWeight: FontWeight.w600,
    fontSize: 34,
    height: 1.15,
    color: AppColors.cream,
    letterSpacing: -1.2,
  );
  static const h1 = TextStyle(
    fontFamily: AppFonts.display,
    fontWeight: FontWeight.w600,
    fontSize: 28,
    height: 1.2,
    color: AppColors.cream,
    letterSpacing: -0.95,
  );
  static const h2 = TextStyle(
    fontFamily: AppFonts.display,
    fontWeight: FontWeight.w600,
    fontSize: 21,
    height: 1.28,
    color: AppColors.cream,
    letterSpacing: -0.5,
  );
  static const h3 = TextStyle(
    fontFamily: AppFonts.display,
    fontWeight: FontWeight.w600,
    fontSize: 17,
    height: 1.32,
    color: AppColors.cream,
    letterSpacing: -0.4,
  );
  static const body = TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w400, fontSize: 15, height: 1.5, color: AppColors.body);
  static const bodySmall = TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w400, fontSize: 13, height: 1.45, color: AppColors.body);
  static const meta = TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w400, fontSize: 13, height: 1.4, color: AppColors.meta);
  static const label = TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, fontSize: 14, height: 1.35, color: AppColors.cream);
  static const caps = TextStyle(fontFamily: AppFonts.mono, fontWeight: FontWeight.w700, fontSize: 11, height: 1.27, letterSpacing: 0.8, color: AppColors.meta);

  /// Figures and stat labels (web: .np-stat, .tabular-nums in JetBrains Mono).
  static const mono = TextStyle(fontFamily: AppFonts.mono, fontWeight: FontWeight.w400, fontSize: 12, height: 1.35, color: AppColors.meta);
}

/// Cards are flat panels with a hairline, not lit objects.
abstract final class AppShadows {
  static const card = [BoxShadow(color: Color(0x66000000), blurRadius: 2, offset: Offset(0, 1))];
  static const raised = [BoxShadow(color: Color(0x40000000), blurRadius: 8, offset: Offset(0, 4))];
}

/// Colour per day on maps and timelines (web/src/features/map/geometry.ts).
const _dayColors = [
  Color(0xFFD60072),
  Color(0xFF2563EB),
  Color(0xFF059669),
  Color(0xFFD97706),
  Color(0xFF7C3AED),
  Color(0xFF0891B2),
  Color(0xFFDC2626),
  Color(0xFF4D7C0F),
];

Color dayColor(int day) => _dayColors[((day < 1 ? 1 : day) - 1) % _dayColors.length];

ThemeData buildTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.dark,
    primary: AppColors.primary,
    onPrimary: AppColors.onPrimary,
    secondary: AppColors.sage,
    onSecondary: AppColors.ground,
    tertiary: AppColors.social,
    onTertiary: AppColors.onPrimary,
    error: AppColors.destructive,
    onError: AppColors.white,
    surface: AppColors.ground,
    onSurface: AppColors.body,
    surfaceContainerLowest: AppColors.canopy,
    surfaceContainerLow: AppColors.well,
    surfaceContainer: AppColors.surface,
    surfaceContainerHigh: AppColors.card,
    surfaceContainerHighest: AppColors.raised,
    onSurfaceVariant: AppColors.meta,
    outline: AppColors.borderStrong,
    outlineVariant: AppColors.border,
    shadow: AppColors.shadow,
    scrim: AppColors.scrim,
    inverseSurface: AppColors.cream,
    onInverseSurface: AppColors.ground,
    inversePrimary: AppColors.primaryPress,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    brightness: Brightness.dark,
    fontFamily: AppFonts.body,
    scaffoldBackgroundColor: AppColors.ground,
    canvasColor: AppColors.ground,
    splashFactory: InkSparkle.splashFactory,
  );

  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: AppColors.body, displayColor: AppColors.cream, fontFamily: AppFonts.body),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.ground,
      foregroundColor: AppColors.cream,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w700, fontSize: 18, color: AppColors.cream),
      systemOverlayStyle: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: AppColors.ground,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1, space: 1),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.primary),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.cream,
      contentTextStyle: AppText.label.copyWith(color: AppColors.ground),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: AppColors.borderStrong,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.xl)),
      titleTextStyle: AppText.h3,
      contentTextStyle: AppText.body,
    ),
    textSelectionTheme: const TextSelectionThemeData(
      cursorColor: AppColors.primary,
      selectionColor: Color(0x660099FF),
      selectionHandleColor: AppColors.primary,
    ),
    datePickerTheme: DatePickerThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      headerBackgroundColor: AppColors.card,
      headerForegroundColor: AppColors.cream,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.xl)),
    ),
    sliderTheme: const SliderThemeData(activeTrackColor: AppColors.primary, inactiveTrackColor: AppColors.raised, thumbColor: AppColors.primary),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? AppColors.primary : Colors.transparent),
      checkColor: const WidgetStatePropertyAll(AppColors.onPrimary),
      side: const BorderSide(color: AppColors.borderStrong, width: 1.5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? AppColors.onPrimary : AppColors.meta),
      trackColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? AppColors.primary : AppColors.raised),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(backgroundColor: AppColors.ground),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
