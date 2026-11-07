/// The landing page's scroll effects, after the web's GSAP ScrollTrigger
/// (web/src/app/landing/home): scrubs tied to where a widget is on the
/// screen, pins, reveals that play when a widget comes into view, words
/// sliding in, and pen scribbles drawing on.
library;

import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../core/theme.dart';

/// Where a widget is as the page scrolls (web: a ScrollTrigger's trigger box).
class Pass {
  const Pass({required this.top, required this.height, required this.screen, this.still = false});

  /// Not measured yet: as if far below the screen.
  const Pass.unknown(this.screen) : top = 1e9, height = 0, still = false;

  /// The widget's top, from the top of the screen; negative once scrolled past.
  final double top;
  final double height;
  final double screen;

  /// Reduced motion: scrubs and reveals sit at their end. Pins still follow the scroll.
  final bool still;

  /// 0 → 1 as the top moves from [from] px to [to] px down the screen.
  double between(double from, double to) => still ? 1 : unit((from - top) / (from - to));

  /// 'top 88%' → 'top 45%' is topBetween(0.88, 0.45).
  double topBetween(double from, double to) => between(from * screen, to * screen);

  /// 0 → 1 from the top entering at the bottom to the bottom leaving at the top ('top bottom' → 'bottom top').
  double get through => still ? 0.5 : unit((screen - top) / (screen + height));

  /// Has the top risen above [at] of the screen (a reveal's start, 'top 88%')?
  bool above(double at) => still || top < at * screen;

  /// How far a pinned frame has to move down to stay put, over [length] px of scroll.
  double stuck(double length) => (-top).clamp(0.0, length);

  /// 0 → 1 over [length] px of scroll once the top reaches the top of the screen.
  double pinned(double length) => unit(-top / length);
}

double unit(double v) => v.isNaN ? 0 : v.clamp(0.0, 1.0);

/// [t] for one of [count] tweens of one length each, started [gap] of a length
/// apart and run as one (web: a stagger).
double stagger(double t, int index, int count, double gap, [Curve curve = Curves.linear]) => curve.transform(unit(t * (1 + (count - 1) * gap) - index * gap));

/// Rebuilds [builder] with this widget's [Pass] as the page scrolls.
class ScrollPass extends StatefulWidget {
  const ScrollPass({super.key, required this.builder, this.child});

  final Widget Function(BuildContext context, Pass pass, Widget? child) builder;

  /// The part that doesn't change with the scroll, built once.
  final Widget? child;

  @override
  State<ScrollPass> createState() => _ScrollPassState();
}

class _ScrollPassState extends State<ScrollPass> {
  ScrollPosition? _position;
  Pass? _pass;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_measure);
      _position = position?..addListener(_measure);
    }
  }

  @override
  void dispose() {
    _position?.removeListener(_measure);
    super.dispose();
  }

  void _measure() {
    final box = mounted ? context.findRenderObject() : null;
    final position = _position;
    if (box is! RenderBox || !box.attached || !box.hasSize || position == null || !position.hasViewportDimension) return;
    final viewport = RenderAbstractViewport.maybeOf(box);
    if (viewport == null) return;
    final top = viewport.getOffsetToReveal(box, 0).offset - position.pixels;
    final old = _pass;
    if (old != null && old.top == top && old.height == box.size.height && old.screen == position.viewportDimension) return;
    setState(() => _pass = Pass(top: top, height: box.size.height, screen: position.viewportDimension, still: MediaQuery.disableAnimationsOf(context)));
  }

  @override
  Widget build(BuildContext context) {
    // Again after layout: what's above may have changed height without a scroll.
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
    return widget.builder(context, _pass ?? Pass.unknown(MediaQuery.sizeOf(context).height), widget.child);
  }
}

/// Plays 0 → 1 once the widget's top rises above [at] of the screen, and back
/// when it drops below again (web: toggleActions 'play none none reverse').
class Reveal extends StatelessWidget {
  const Reveal({super.key, required this.builder, this.child, this.at = 0.88, this.duration = const Duration(milliseconds: 1200), this.curve = Curves.easeOutExpo, this.back});

  final Widget Function(BuildContext context, double t, Widget? child) builder;
  final Widget? child;
  final double at;
  final Duration duration;
  final Curve curve;

  /// How it goes back, when not the same way (web: onLeaveBack).
  final (Duration, Curve)? back;

  @override
  Widget build(BuildContext context) => ScrollPass(
    child: child,
    builder: (context, pass, child) {
      final shown = pass.above(at);
      final (time, ease) = shown || back == null ? (duration, curve) : back!;
      return TweenAnimationBuilder<double>(
        tween: Tween(end: shown ? 1 : 0),
        duration: time,
        curve: ease,
        builder: builder,
        child: child,
      );
    },
  );
}

/// A heading whose words slide in sideways out of masks with the scroll, and
/// back out when you scroll up (web: parts/slideInWords.ts).
class SlideInWords extends StatelessWidget {
  const SlideInWords(this.text, {super.key, required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final words = text.split(' ');
    return ScrollPass(
      builder: (context, pass, _) {
        final p = pass.topBetween(0.88, 0.45);
        return Semantics(
          label: text,
          excludeSemantics: true,
          child: Wrap(
            spacing: (style.fontSize ?? 14) * 0.26,
            children: [
              for (final (i, word) in words.indexed)
                ClipRect(
                  child: Builder(
                    builder: (context) {
                      final q = stagger(p, i, words.length, 0.06, Curves.easeOutCubic);
                      return Opacity(
                        opacity: q,
                        child: FractionalTranslation(
                          translation: Offset(0.6 * (1 - q), 0.4 * (1 - q)),
                          child: Text(word, style: style),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// A loose pen loop drawn on under [child] as it scrolls into view (web:
/// Scribble + drawScribbles). [place] puts the 320×64 drawing against the child's size.
class Scribbled extends StatelessWidget {
  const Scribbled({super.key, required this.child, required this.place});

  final Widget child;
  final Rect Function(Size size) place;

  @override
  Widget build(BuildContext context) => ScrollPass(
    child: child,
    builder: (context, pass, child) => CustomPaint(foregroundPainter: _ScribblePainter(pass.topBetween(0.9, 0.55), place), child: child),
  );
}

class _ScribblePainter extends CustomPainter {
  _ScribblePainter(this.t, this.place);

  final double t;
  final Rect Function(Size size) place;

  /// web: "M6 40c48-16 118-24 190-20 46 3 96 12 112 24 10 8-12 13-44 14-70 3-162-2-214-12", in a 320×64 box.
  static final _path = Path()
    ..moveTo(6, 40)
    ..relativeCubicTo(48, -16, 118, -24, 190, -20)
    ..relativeCubicTo(46, 3, 96, 12, 112, 24)
    ..relativeCubicTo(10, 8, -12, 13, -44, 14)
    ..relativeCubicTo(-70, 3, -162, -2, -214, -12);

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0) return;
    final box = place(size);
    final metric = _path.computeMetrics().first;
    canvas
      ..save()
      ..translate(box.left, box.top)
      ..scale(box.width / 320)
      ..drawPath(
        metric.extractPath(0, metric.length * t),
        Paint()
          ..color = AppColors.primary
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round,
      )
      ..restore();
  }

  @override
  bool shouldRepaint(_ScribblePainter old) => old.t != t;
}

/// A rounded window cut [inset] (fractions of each side) into the child (web: clip-path inset(… round …)).
class InsetClip extends CustomClipper<RRect> {
  InsetClip(this.inset, this.radius);

  /// From [from] to [to] at [t].
  InsetClip.lerp(EdgeInsets from, EdgeInsets to, double fromRadius, double toRadius, double t) : inset = EdgeInsets.lerp(from, to, t)!, radius = lerpDouble(fromRadius, toRadius, t)!;

  final EdgeInsets inset;
  final double radius;

  @override
  RRect getClip(Size s) => RRect.fromLTRBR(inset.left * s.width, inset.top * s.height, s.width * (1 - inset.right), s.height * (1 - inset.bottom), Radius.circular(radius));

  @override
  bool shouldReclip(InsetClip old) => old.inset != inset || old.radius != radius;
}

/// An arch rising from the bottom edge: an ellipse [rx] of the width wide and
/// the full height tall, centred on the bottom edge (web: clip-path ellipse(rx 100% at 50% 100%)).
class ArchClip extends CustomClipper<Path> {
  ArchClip(this.rx);

  final double rx;

  @override
  Path getClip(Size s) => Path()..addOval(Rect.fromCenter(center: Offset(s.width / 2, s.height), width: 2 * rx * s.width, height: 2 * s.height));

  @override
  bool shouldReclip(ArchClip old) => old.rx != rx;
}

/// Tipped back and lowered at 0, upright at 1 (web: rotationX -12, y 70, transformPerspective 1100).
Matrix4 tiltUp(double t) => Matrix4.identity()
  ..setEntry(3, 2, 1 / 1100)
  ..translateByDouble(0, 70 * (1 - t), 0, 1)
  ..rotateX(-12 * (1 - t) * math.pi / 180);
