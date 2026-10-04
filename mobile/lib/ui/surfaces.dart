import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/text.dart';
import '../core/theme.dart';
import '../data/api.dart';
import 'buttons.dart';

enum Surface { card, surface, featured, well, live }

BoxDecoration surfaceDecoration(Surface surface, {double radius = AppRadius.lg}) {
  switch (surface) {
    case Surface.card:
      return BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: const Color(0x17FFFFFF)),
        boxShadow: AppShadows.card,
      );
    case Surface.surface:
      return BoxDecoration(
        color: const Color(0xF20D0D0D),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: const Color(0x12FFFFFF)),
      );
    case Surface.featured:
      return BoxDecoration(
        color: AppColors.raised,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: const Color(0x1FFFFFFF)),
        boxShadow: AppShadows.raised,
      );
    case Surface.well:
      return BoxDecoration(
        color: AppColors.well,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: const Color(0x99000000)),
      );
    case Surface.live:
      return BoxDecoration(
        color: AppColors.raised,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: const Color(0x52F07C6C)),
        boxShadow: AppShadows.raised,
      );
  }
}

/// A panel in one of the National Park surfaces; tappable when [onTap] is set.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.surface = Surface.card,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.accent,
    this.radius = AppRadius.lg,
  });

  final Widget child;
  final Surface surface;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  /// A coloured stripe down the left edge (check-ins, as on the web).
  final Color? accent;
  final double radius;

  @override
  Widget build(BuildContext context) {
    Widget content = Padding(padding: padding, child: child);
    if (accent != null) {
      content = Stack(
        children: [
          content,
          Positioned(left: 0, top: 0, bottom: 0, child: Container(width: 4, color: accent)),
        ],
      );
    }
    final decorated = DecoratedBox(
      decoration: surfaceDecoration(surface, radius: radius),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: onTap == null
            ? content
            : Material(
                type: MaterialType.transparency,
                child: InkWell(onTap: onTap, child: content),
              ),
      ),
    );
    return decorated;
  }
}

/// A network photo with the app's placeholder and error look.
class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.width, this.height, this.radius = 0, this.placeholderColor = AppColors.well});

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final double radius;
  final Color placeholderColor;

  @override
  Widget build(BuildContext context) {
    final empty = Container(
      width: width,
      height: height,
      color: placeholderColor,
      alignment: Alignment.center,
      child: const Icon(LucideIcons.image, size: 22, color: AppColors.moss),
    );
    final source = url;
    Widget image = (source == null || source.isEmpty)
        ? empty
        : CachedNetworkImage(
            imageUrl: source,
            fit: fit,
            width: width,
            height: height,
            fadeInDuration: const Duration(milliseconds: 150),
            placeholder: (_, _) => Container(width: width, height: height, color: placeholderColor),
            errorWidget: (_, _, _) => empty,
          );
    if (radius > 0) image = ClipRRect(borderRadius: BorderRadius.circular(radius), child: image);
    return image;
  }
}

/// A round profile photo; the initial when there is none.
class AppAvatar extends StatelessWidget {
  const AppAvatar({super.key, this.url, required this.name, this.size = 40, this.ring = false, this.square = false});

  final String? url;
  final String name;
  final double size;

  /// A cream ring (on covers and photos).
  final bool ring;

  /// Rounded square instead of a circle.
  final bool square;

  @override
  Widget build(BuildContext context) {
    final radius = square ? BorderRadius.circular(size * 0.28) : BorderRadius.circular(size / 2);
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: AppColors.raised,
      child: Text(
        initialOf(name),
        style: TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w700, fontSize: size * 0.4, color: AppColors.cream),
      ),
    );
    final source = url;
    final picture = ClipRRect(
      borderRadius: radius,
      child: source == null || source.isEmpty
          ? fallback
          : CachedNetworkImage(
              imageUrl: source,
              width: size,
              height: size,
              fit: BoxFit.cover,
              placeholder: (_, _) => Container(width: size, height: size, color: AppColors.raised),
              errorWidget: (_, _, _) => fallback,
            ),
    );
    if (!ring) return picture;
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: AppColors.cream, borderRadius: square ? BorderRadius.circular(size * 0.3) : BorderRadius.circular(size)),
      child: picture,
    );
  }
}

enum BadgeTone { neutral, primary, social, live, success, danger, overlay, outline }

/// A small label pill.
class AppBadge extends StatelessWidget {
  const AppBadge(this.label, {super.key, this.tone = BadgeTone.neutral, this.icon, this.uppercase = false});

  final String label;
  final BadgeTone tone;
  final IconData? icon;
  final bool uppercase;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, Color? border) = switch (tone) {
      BadgeTone.neutral => (const Color(0x14FFFFFF), AppColors.body, null),
      BadgeTone.primary => (AppColors.primary, AppColors.onPrimary, null),
      BadgeTone.social => (const Color(0x29F07C6C), AppColors.social, const Color(0x59F07C6C)),
      BadgeTone.live => (AppColors.live, AppColors.white, null),
      BadgeTone.success => (const Color(0x2900BB88), AppColors.teal, null),
      BadgeTone.danger => (const Color(0x24E5534B), AppColors.destructive, null),
      BadgeTone.overlay => (const Color(0xBF000000), AppColors.cream, null),
      BadgeTone.outline => (Colors.transparent, AppColors.meta, AppColors.borderStrong),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: border == null ? null : Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 12, color: fg), const SizedBox(width: 4)],
          Text(
            uppercase ? label.toUpperCase() : label,
            style: TextStyle(
              fontFamily: AppFonts.body,
              fontWeight: FontWeight.w700,
              fontSize: uppercase ? 10 : 11.5,
              letterSpacing: uppercase ? 0.8 : 0,
              color: fg,
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}

/// A filter or tag chip.
class AppChip extends StatelessWidget {
  const AppChip({super.key, required this.label, this.selected = false, this.onTap, this.icon, this.leading, this.onRemove, this.enabled = true});

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;
  final Widget? leading;

  /// A small × after the label (remove a tag).
  final VoidCallback? onRemove;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppColors.ground : AppColors.cream;
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: selected ? AppColors.cream : AppColors.well,
        shape: StadiumBorder(side: BorderSide(color: selected ? AppColors.cream : AppColors.borderStrong)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: EdgeInsets.fromLTRB(12, 7, onRemove != null ? 6 : 12, 7),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (leading != null) ...[leading!, const SizedBox(width: 6)],
                if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 6)],
                Text(label, style: AppText.label.copyWith(fontSize: 13, color: fg)),
                if (onRemove != null) ...[
                  const SizedBox(width: 2),
                  InkResponse(
                    onTap: onRemove,
                    radius: 14,
                    child: Icon(LucideIcons.x, size: 15, color: fg),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A gently pulsing placeholder block.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius = AppRadius.md});

  final double? width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.45, end: 0.9).animate(_controller),
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(color: AppColors.raised, borderRadius: BorderRadius.circular(widget.radius)),
      ),
    );
  }
}

/// "Nothing here yet", with an icon and an optional action.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, this.icon, required this.title, this.description, this.action, this.compact = false});

  final IconData? icon;
  final String title;
  final String? description;
  final Widget? action;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 20, vertical: compact ? 20 : 32),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: const Color(0x29FFFFFF)),
        color: const Color(0x0DFFFFFF),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(color: AppColors.well, shape: BoxShape.circle),
              child: Icon(icon, size: 24, color: AppColors.sage),
            ),
            const SizedBox(height: 12),
          ],
          Text(title, style: AppText.h3, textAlign: TextAlign.center),
          if (description != null) ...[const SizedBox(height: 6), Text(description!, style: AppText.meta, textAlign: TextAlign.center)],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

/// A failed load, with "Thử lại".
class ErrorPanel extends StatelessWidget {
  const ErrorPanel({super.key, required this.error, this.onRetry, this.title = 'Không tải được dữ liệu'});

  final Object? error;
  final VoidCallback? onRetry;
  final String title;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: LucideIcons.triangleAlert,
      title: title,
      description: errorMessage(error),
      compact: true,
      action: onRetry == null
          ? null
          : AppButton(label: 'Thử lại', icon: LucideIcons.refreshCw, variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: onRetry),
    );
  }
}

/// A centred spinner with an optional line of text.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5)),
            if (message != null) ...[const SizedBox(height: 12), Text(message!, style: AppText.meta, textAlign: TextAlign.center)],
          ],
        ),
      ),
    );
  }
}

/// A section title with an optional action on the right.
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.subtitle, this.icon, this.action, this.iconColor = AppColors.sage});

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? action;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (icon != null) ...[Icon(icon, size: 19, color: iconColor), const SizedBox(width: 8)],
                  Flexible(child: Text(title, style: AppText.h2)),
                ],
              ),
              if (subtitle != null) ...[const SizedBox(height: 3), Text(subtitle!, style: AppText.meta)],
            ],
          ),
        ),
        ?action,
      ],
    );
  }
}

/// Tabs in a pill track, with optional counts (web: Tabs).
class SegmentTabs<T> extends StatelessWidget {
  const SegmentTabs({super.key, required this.items, required this.value, required this.onChanged, this.scrollable = true});

  final List<({T value, String label, int? count})> items;
  final T value;
  final ValueChanged<T> onChanged;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final buttons = [
      for (final item in items)
        _TabButton(label: item.label, count: item.count, selected: item.value == value, onTap: () => onChanged(item.value), expand: !scrollable),
    ];
    final track = Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.well, borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Row(mainAxisSize: scrollable ? MainAxisSize.min : MainAxisSize.max, children: buttons),
    );
    if (!scrollable) return track;
    return SingleChildScrollView(scrollDirection: Axis.horizontal, child: track);
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.label, required this.count, required this.selected, required this.onTap, required this.expand});

  final String label;
  final int? count;
  final bool selected;
  final VoidCallback onTap;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final button = Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? AppColors.cream : Colors.transparent,
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.label.copyWith(fontSize: 13, color: selected ? AppColors.ground : AppColors.body),
                  ),
                ),
                if (count != null && count! > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    constraints: const BoxConstraints(minWidth: 18),
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(color: AppColors.social, borderRadius: BorderRadius.circular(9)),
                    child: Text(
                      '${count!}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 10, color: AppColors.onPrimary),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
    return expand ? Expanded(child: button) : button;
  }
}

/// A full-width hairline.
class AppDivider extends StatelessWidget {
  const AppDivider({super.key, this.vertical = 0});

  final double vertical;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: vertical),
    child: const Divider(height: 1, color: AppColors.border),
  );
}
