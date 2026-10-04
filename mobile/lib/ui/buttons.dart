import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';

enum ButtonVariant { primary, secondary, outline, ghost, destructive, social }

enum ButtonSize { sm, md, lg }

class _Palette {
  const _Palette(this.bg, this.pressed, this.fg, [this.border]);

  final Color bg;
  final Color pressed;
  final Color fg;
  final Color? border;
}

const _palettes = {
  ButtonVariant.primary: _Palette(AppColors.primary, AppColors.primaryPress, AppColors.onPrimary),
  ButtonVariant.secondary: _Palette(AppColors.raised, AppColors.hover, AppColors.cream, AppColors.border),
  ButtonVariant.outline: _Palette(Colors.transparent, Color(0x14FFFFFF), AppColors.cream, AppColors.borderStrong),
  ButtonVariant.ghost: _Palette(Colors.transparent, Color(0x14FFFFFF), AppColors.body),
  ButtonVariant.destructive: _Palette(AppColors.destructive, Color(0xFFC8443D), AppColors.white),
  ButtonVariant.social: _Palette(AppColors.social, Color(0xFFD96A5B), AppColors.onPrimary),
};

const _sizes = {
  ButtonSize.sm: (height: 36.0, px: 12.0, font: 13.0, icon: 16.0),
  ButtonSize.md: (height: 44.0, px: 16.0, font: 15.0, icon: 18.0),
  ButtonSize.lg: (height: 52.0, px: 20.0, font: 16.0, icon: 20.0),
};

/// The app's button (web: Button / GlassButton).
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = ButtonVariant.primary,
    this.size = ButtonSize.md,
    this.icon,
    this.iconRight = false,
    this.loading = false,
    this.fullWidth = false,
    this.haptic,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final ButtonSize size;
  final IconData? icon;
  final bool iconRight;
  final bool loading;
  final bool fullWidth;

  /// A light tap on press (on by default for primary actions).
  final bool? haptic;

  @override
  Widget build(BuildContext context) {
    final p = _palettes[variant]!;
    final s = _sizes[size]!;
    final inactive = onPressed == null || loading;

    final leading = loading
        ? SizedBox(
            width: s.icon,
            height: s.icon,
            child: CircularProgressIndicator(strokeWidth: 2, color: p.fg),
          )
        : icon != null
        ? Icon(icon, size: s.icon, color: p.fg)
        : null;

    final text = Flexible(
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: s.font, color: p.fg, height: 1.2),
      ),
    );

    final children = <Widget>[?leading, if (leading != null) const SizedBox(width: 8), text];

    return Semantics(
      button: true,
      enabled: !inactive,
      label: label,
      excludeSemantics: true,
      child: Opacity(
        opacity: inactive && !loading ? 0.5 : 1,
        child: Material(
          color: p.bg,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
            side: p.border == null ? BorderSide.none : BorderSide(color: p.border!, width: 1),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: inactive
                ? null
                : () {
                    if (haptic ?? variant == ButtonVariant.primary) HapticFeedback.selectionClick();
                    onPressed!();
                  },
            highlightColor: p.pressed,
            splashColor: p.pressed,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: s.height, minWidth: fullWidth ? double.infinity : 0),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: s.px),
                child: Row(
                  mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: iconRight ? children.reversed.toList() : children,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum IconTone { ghost, well, overlay, primary, social, danger }

const _tones = {
  IconTone.ghost: _Palette(Colors.transparent, Color(0x1AFFFFFF), AppColors.body),
  IconTone.well: _Palette(AppColors.well, AppColors.hover, AppColors.body, Color(0x99000000)),
  IconTone.overlay: _Palette(Color(0x8C000000), Color(0xBF000000), AppColors.white),
  IconTone.primary: _Palette(AppColors.primary, AppColors.primaryPress, AppColors.onPrimary),
  IconTone.social: _Palette(AppColors.social, Color(0xFFD96A5B), AppColors.onPrimary),
  IconTone.danger: _Palette(Color(0x26E5534B), Color(0x4DE5534B), AppColors.destructive),
};

/// A round icon-only button with a spoken label.
class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    required this.label,
    this.onPressed,
    this.tone = IconTone.ghost,
    this.size = 40,
    this.iconSize,
    this.color,
    this.loading = false,
    this.dot = false,
    this.badge,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final IconTone tone;
  final double size;
  final double? iconSize;
  final Color? color;
  final bool loading;

  /// A small coral dot (unread).
  final bool dot;

  /// A count bubble in the corner.
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final t = _tones[tone]!;
    final fg = color ?? t.fg;
    final disabled = onPressed == null;
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        label: label,
        enabled: !disabled,
        excludeSemantics: true,
        child: Opacity(
          opacity: disabled && !loading ? 0.45 : 1,
          child: SizedBox(
            width: size,
            height: size,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Material(
                  color: t.bg,
                  shape: CircleBorder(side: t.border == null ? BorderSide.none : BorderSide(color: t.border!)),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: loading ? null : onPressed,
                    highlightColor: t.pressed,
                    splashColor: t.pressed,
                    child: Center(
                      child: loading
                          ? SizedBox(
                              width: size * 0.42,
                              height: size * 0.42,
                              child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                            )
                          : Icon(icon, size: iconSize ?? (size * 0.48).roundToDouble(), color: fg),
                    ),
                  ),
                ),
                if (dot)
                  Positioned(
                    top: size * 0.18,
                    right: size * 0.18,
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: AppColors.social,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.ground, width: 2),
                      ),
                    ),
                  ),
                if (badge != null && badge! > 0) Positioned(top: -4, right: -6, child: CountBubble(count: badge!)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A small coral count ("3", "9+").
class CountBubble extends StatelessWidget {
  const CountBubble({super.key, required this.count, this.borderColor = AppColors.ground});

  final int count;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 18),
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.social,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: borderColor, width: 2),
      ),
      child: Text(
        count > 9 ? '9+' : '$count',
        style: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 9, color: AppColors.onPrimary, height: 1),
      ),
    );
  }
}

/// A text-only link-style button.
class TextLink extends StatelessWidget {
  const TextLink({super.key, required this.label, required this.onPressed, this.color = AppColors.primary, this.icon});

  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 15, color: color), const SizedBox(width: 6)],
            Flexible(
              child: Text(label, style: AppText.label.copyWith(color: color)),
            ),
          ],
        ),
      ),
    );
  }
}

/// The web's "light beam" button (styles/light-beam.css in the void theme): a
/// dark key with a hairline and a soft blue glow, for "Bắt đầu ngay".
class BeamButton extends StatelessWidget {
  const BeamButton({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: const [BoxShadow(color: Color(0x800099FF), blurRadius: 22, spreadRadius: -6)],
      ),
      child: Material(
        color: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: const BorderSide(color: Color(0x1FFFFFFF)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.md),
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            child: Text(label, style: AppText.label.copyWith(fontSize: 13.5)),
          ),
        ),
      ),
    );
  }
}
