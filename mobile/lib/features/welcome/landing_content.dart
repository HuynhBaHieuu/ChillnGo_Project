import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:video_player/video_player.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/labels.dart';
import '../../core/photos.dart';
import '../../core/text.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/discovery_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/navigation.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import 'scroll_fx.dart';

/// The hero's footage and the films behind "Xem phim" (web/src/app/landing/home/videos.ts).
const _heroVideo = 'https://assets.mixkit.co/videos/39912/39912-720.mp4';
const _films = [(title: 'Vịnh Hạ Long', id: 44915), (title: 'Hồ Gươm về đêm', id: 27694), (title: 'Xuôi dòng', id: 27664), (title: 'Hoàng hôn trên vịnh', id: 20198)];
String _mixkit(int id) => 'https://assets.mixkit.co/videos/$id/$id-720.mp4';

String _lat(double v) => '${v.abs().toStringAsFixed(4)}° ${v >= 0 ? 'N' : 'S'}';
String _lng(double v) => '${v.abs().toStringAsFixed(4)}° ${v >= 0 ? 'E' : 'W'}';

/// "Hà Giang Loop 4N3Đ — …" → "Hà Giang Loop".
String _tripPlace(String title) => title.replaceFirst(RegExp(r'\s*\d+N\d+Đ.*$', caseSensitive: false, unicode: true), '');

const _display = TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w700, color: AppColors.cream, letterSpacing: -1, height: 1);
const _monoCaps = TextStyle(fontFamily: AppFonts.mono, fontSize: 12, letterSpacing: 1.4, height: 1.2, color: AppColors.primary);

/// Oswald at 400, the web's font-condensed.
const _condensed = TextStyle(fontFamily: 'Oswald', fontVariations: [FontVariation.weight(400)], height: 1, color: AppColors.white);
const _bodyMedium = TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w500, fontSize: 14, height: 1.5, color: AppColors.cream);

/// Faded in and risen [by] px into place as [t] goes 0 → 1.
Widget _rise(double t, Widget child, {double by = 40}) => Opacity(
  opacity: t,
  child: Transform.translate(offset: Offset(0, by * (1 - t)), child: child),
);

/// The web home page (web/src/app/landing/home) on a phone, stage by stage,
/// with its scroll effects (scroll_fx.dart): the footage closing into a card,
/// the statement brightening, the photos drifting, the stops pinned and slid
/// sideways, headings and the wordmark rising in. The desktop-only ones
/// (cards opening on hover, the sticky step index, tilt and magnetic hovers)
/// have no phone version on the web either.
class LandingContent extends ConsumerStatefulWidget {
  const LandingContent({super.key, this.welcome = false});

  /// First launch: no way back in the navbar.
  final bool welcome;

  @override
  ConsumerState<LandingContent> createState() => _LandingContentState();
}

class _LandingContentState extends ConsumerState<LandingContent> {
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stats = ref.watch(landingStatsProvider).value;
    final posts = ref.watch(discoverProvider(const DiscoverFilters())).value ?? const <TripPost>[];
    final rows = ref.watch(destinationRowsProvider).value ?? const <DestinationRow>[];

    return Stack(
      children: [
        ListView(
          controller: _scroll,
          padding: EdgeInsets.zero,
          // ponytail: no smoothing on the scrubs (web: Lenis + scrub 0.6); a phone's own scroll is smooth.
          children: [
            const _Hero(),
            if (stats != null) _Statement(stats: stats),
            if (posts.isNotEmpty) _Journeys(posts: posts.take(5).toList()),
            if (stats != null && rows.isNotEmpty) _Stops(rows: rows, stats: stats),
            const _HowItWorks(),
            if (posts.isNotEmpty) _MostSaved(posts: posts.take(4).toList()),
            _Footer(
              onTop: () => _scroll.animateTo(0, duration: const Duration(milliseconds: 1200), curve: Curves.easeInOutCubic),
            ),
          ],
        ),
        Positioned(top: 0, left: 0, right: 0, child: _NavBar(back: !widget.welcome)),
      ],
    );
  }
}

/// The web's navbar, pinned over every stage: the logo, the language, and
/// "Bắt đầu ngay" while signed out. A shade behind it keeps it readable over photos.
class _NavBar extends ConsumerWidget {
  const _NavBar({required this.back});

  /// Opened from the menu ("Về ChillnGo"): a way back first.
  final bool back;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(sessionProvider.select((s) => s.signedIn));
    return Container(
      padding: EdgeInsets.fromLTRB(back ? 4 : kGutter, MediaQuery.paddingOf(context).top + 10, kGutter, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xD9000000), Color(0x00000000)]),
      ),
      child: Row(
        children: [
          if (back) const BackOrHome(),
          Image.asset('assets/images/logo.png', height: 28, semanticLabel: 'ChillnGo'),
          const Spacer(),
          const LanguageButton(),
          if (!signedIn) ...[const SizedBox(width: 8), BeamButton(label: t('Bắt đầu ngay'), onPressed: () => context.push('/register'))],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ hero */

/// Full-screen footage, the tagline, "Xem phim" and a giant condensed "Việt Nam" (web: HeroStage).
///
/// Two screens tall with the frame held still over the first: as you scroll,
/// the copy rises faster than the page, the footage pushes in, closes into a
/// rounded card and fades out. The copy rises in when the page opens.
class _Hero extends StatefulWidget {
  const _Hero();

  @override
  State<_Hero> createState() => _HeroState();
}

class _HeroState extends State<_Hero> {
  late final _video = VideoPlayerController.networkUrl(Uri.parse(_heroVideo));

  @override
  void initState() {
    super.initState();
    _video
      ..setVolume(0)
      ..setLooping(true)
      ..initialize().then((_) {
        if (!mounted) return;
        _video.play();
        setState(() {});
      });
  }

  @override
  void dispose() {
    _video.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context).height;
    final still = MediaQuery.disableAnimationsOf(context);
    final footage = Stack(
      fit: StackFit.expand,
      children: [
        // The still until the footage plays (web: the video's poster).
        NetImage(landingPhoto(LandingPhoto.mountainRoad, 1200, 1800), placeholderColor: AppColors.canopy),
        if (_video.value.isInitialized)
          FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(width: _video.value.size.width, height: _video.value.size.height, child: VideoPlayer(_video)),
          ),
        const ColoredBox(color: Color(0x33000000)),
      ],
    );
    // The load-in: tagline, film bar, title, 0.12 s apart after 0.2 s, 1.6 s each.
    final copy = TweenAnimationBuilder<double>(
      tween: Tween(begin: still ? 1 : 0, end: 1),
      duration: const Duration(milliseconds: 2040),
      builder: (context, clock, _) {
        double at(int i) => Curves.easeOutExpo.transform(unit((clock * 2.04 - 0.2 - 0.12 * i) / 1.6));
        return Column(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(52, 0, 52, 32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    _rise(
                      at(0),
                      Text(
                        t('Những chuyến đi có thật, kể lại bởi chính người đã đi'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w500, fontSize: 20, height: 1.2, color: AppColors.white),
                      ),
                    ),
                    const SizedBox(height: 40),
                    _rise(at(1), _FilmButton(onTap: () => _showFilms(context))),
                  ],
                ),
              ),
            ),
            Expanded(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 0, 12, MediaQuery.paddingOf(context).bottom + 48),
                  child: _rise(
                    at(2),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(t('Việt Nam').toUpperCase(), style: _condensed.copyWith(fontSize: 80)),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );

    // Reduced motion: one screen, nothing held or closed (web: motion-reduce:h-svh).
    if (still) {
      return SizedBox(
        height: screen,
        child: Stack(fit: StackFit.expand, children: [footage, copy]),
      );
    }
    return SizedBox(
      height: screen * 2,
      child: ScrollPass(
        builder: (context, pass, _) {
          final p = pass.pinned(screen);
          final close = Curves.easeInOutQuad.transform(unit(p / 0.75));
          return Align(
            alignment: Alignment.topCenter,
            child: Transform.translate(
              offset: Offset(0, pass.stuck(screen)),
              child: SizedBox(
                height: screen,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Opacity(
                      opacity: 1 - unit((p - 0.75) / 0.25),
                      child: ClipRRect(
                        clipper: InsetClip.lerp(EdgeInsets.zero, const EdgeInsets.fromLTRB(0.32, 0.28, 0.32, 0.28), 0, 24, close),
                        child: Transform.scale(scale: 1 + 0.12 * p, child: footage),
                      ),
                    ),
                    Transform.translate(offset: Offset(0, -0.6 * screen * p), child: copy),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A hairline-bordered bar: "Xem phim" and a play mark (web: FilmButton).
class _FilmButton extends StatelessWidget {
  const _FilmButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Container(
      constraints: const BoxConstraints(minHeight: 44),
      padding: const EdgeInsets.symmetric(horizontal: 32),
      decoration: const BoxDecoration(
        border: Border.symmetric(horizontal: BorderSide(color: Color(0x33FFFFFF), width: 0.5)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(t('Xem phim'), style: _bodyMedium.copyWith(color: AppColors.white)),
          ),
          const Icon(Icons.play_arrow_rounded, size: 18, color: AppColors.white),
        ],
      ),
    ),
  );
}

Future<void> _showFilms(BuildContext context) => showDialog<void>(
  context: context,
  barrierColor: const Color(0xE6000000),
  builder: (_) => const Dialog(backgroundColor: Colors.black, insetPadding: EdgeInsets.all(12), child: _Films()),
);

/// The film box: one film playing, chips to pick another (web: the hero's Dialog).
class _Films extends StatefulWidget {
  const _Films();

  @override
  State<_Films> createState() => _FilmsState();
}

class _FilmsState extends State<_Films> {
  var _index = 0;
  VideoPlayerController? _video;

  @override
  void initState() {
    super.initState();
    _open(0);
  }

  void _open(int index) {
    _video?.dispose();
    final video = VideoPlayerController.networkUrl(Uri.parse(_mixkit(_films[index].id)));
    setState(() {
      _index = index;
      _video = video;
    });
    video.initialize().then((_) {
      if (!mounted || _video != video) return;
      video.play();
      setState(() {});
    });
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final video = _video;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: video != null && video.value.isInitialized
                ? GestureDetector(
                    onTap: () => setState(() {
                      video.value.isPlaying ? video.pause() : video.play();
                    }),
                    child: VideoPlayer(video),
                  )
                : const Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final (i, film) in _films.indexed) AppChip(label: film.title, selected: i == _index, onTap: () => _open(i))],
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------- statement */

/// The statement, then the rice terraces with the real numbers (web: StatementStage).
///
/// The statement brightens top-down as it passes and a scribble draws on under
/// the kicker; over the terraces, the photo and the copy drift apart.
class _Statement extends StatelessWidget {
  const _Statement({required this.stats});

  final LandingStats stats;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(size.width / 8, 96, kGutter, 48),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Scribbled(
                place: (s) {
                  final w = (s.width * 1.3).clamp(192.0, double.infinity);
                  return Rect.fromLTWH(s.width * 1.12 - w, s.height * 1.95 - w * 0.2, w, w * 0.2);
                },
                child: Text(
                  t('Mạng xã hội của những chuyến đi'),
                  style: AppText.h3.copyWith(fontWeight: FontWeight.w500, color: AppColors.meta),
                ),
              ),
              const SizedBox(height: 40),
              ScrollPass(
                // The first line indented a quarter (web: indent-[25%]). The padding
                // keeps the last line's descenders inside the mask.
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        WidgetSpan(child: SizedBox(width: size.width * 0.2)),
                        TextSpan(
                          text: t(
                            'ChillnGo là nơi những chuyến đi có thật được kể lại trọn vẹn — từng ngày, từng điểm dừng, từng khoản chi. Thấy một hành trình hợp ý? Sao chép về làm của bạn chỉ với một chạm, rồi sửa theo cách bạn muốn đi.',
                          ),
                        ),
                      ],
                    ),
                    style: _display.copyWith(fontSize: 26, height: 1.05),
                  ),
                ),
                // Bright above a line that runs down it, from its top at 85% of the
                // screen to its bottom at 40% (web: .xp-fade and --mask).
                builder: (context, pass, child) {
                  final m = -0.4 + 1.4 * pass.between(0.85 * size.height, 0.4 * size.height - pass.height);
                  return ShaderMask(
                    blendMode: BlendMode.dstIn,
                    shaderCallback: (r) => ui.Gradient.linear(
                      Offset(0, r.top + m * r.height),
                      Offset(0, r.top + (m + 0.4) * r.height),
                      const [Color(0xFFFFFFFF), Color(0x99FFFFFF), Color(0x1AFFFFFF)],
                      const [0, 0.5, 1],
                    ),
                    child: child,
                  );
                },
              ),
            ],
          ),
        ),
        SizedBox(
          height: size.height,
          child: ScrollPass(
            builder: (context, pass, _) => Stack(
              fit: StackFit.expand,
              children: [
                Positioned(
                  left: 0,
                  right: 0,
                  top: (-0.1 + (-0.1 + 0.2 * pass.through) * 1.2) * size.height,
                  height: 1.2 * size.height,
                  child: NetImage(landingPhoto(LandingPhoto.riceTerraces, 1200, 1800), placeholderColor: AppColors.canopy),
                ),
                const ColoredBox(color: Color(0x40000000)),
                Positioned(
                  left: size.width / 8,
                  right: size.width / 8,
                  top: size.height * (0.35 + 0.25 - 0.5 * pass.through),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Con số thật').toUpperCase(), style: _monoCaps),
                      const SizedBox(height: 12),
                      Text(
                        t(
                          'Không có lịch trình dựng sẵn, chỉ có người đã đi và kể lại. Đến nay cộng đồng đã chia sẻ {trips} hành trình với {stops} điểm dừng có toạ độ, được sao chép {clones} lần và lưu lại {bookmarks} lần.',
                          {'trips': formatNumber(stats.tripCount), 'stops': formatNumber(stats.stopCount), 'clones': formatNumber(stats.cloneCount), 'bookmarks': formatNumber(stats.bookmarkCount)},
                        ),
                        style: _bodyMedium.copyWith(color: AppColors.white),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/* -------------------------------------------------------------- journeys */

/// The journeys as tall photo cards, then the team's note (web: TripsFlickStage).
/// Scribbles draw on under the heading and the team's name.
class _Journeys extends StatelessWidget {
  const _Journeys({required this.posts});

  final List<TripPost> posts;

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * 0.65;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 160, kGutter, 48),
          child: Center(
            child: Scribbled(
              place: (s) {
                final w = (s.width * 1.6).clamp(0.0, 640.0);
                return Rect.fromLTWH((s.width - w) / 2, s.height * 0.85, w, w * 0.2);
              },
              child: Text(t('Hành trình'), textAlign: TextAlign.center, style: _display.copyWith(fontSize: 32)),
            ),
          ),
        ),
        for (final post in posts)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: GestureDetector(
              onTap: () => context.push('/posts/${post.id}'),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: SizedBox(
                  height: height,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x4D000000), Color(0x0D000000), Color(0x8C000000)]),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 30),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              shortTitle(post.title),
                              style: _display.copyWith(fontSize: 22, fontWeight: FontWeight.w600, letterSpacing: -0.4, color: AppColors.white),
                            ),
                            const Spacer(),
                            Wrap(
                              spacing: 14,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                for (final (i, part) in [formatVndShort(post.totalEstCost), tripLengthLabel(post.days.length), regionLabel(post.region)].indexed) ...[
                                  if (i > 0) Container(width: 1, height: 16, color: AppColors.white),
                                  Text(
                                    part,
                                    style: _bodyMedium.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.white),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 20),
                            Text(
                              post.summary,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: _bodyMedium.copyWith(fontSize: 15, height: 1.45, color: AppColors.white),
                            ),
                            const SizedBox(height: 20),
                            const _UnderlinedLink(),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        _TeamQuote(),
      ],
    );
  }
}

/// "Xem hành trình →" over a photo, underlined.
class _UnderlinedLink extends StatelessWidget {
  const _UnderlinedLink();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.only(bottom: 3),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: Color(0x66FFFFFF))),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(t('Xem hành trình'), style: _bodyMedium.copyWith(color: AppColors.white)),
        const SizedBox(width: 6),
        const Icon(LucideIcons.arrowRight, size: 14, color: AppColors.white),
      ],
    ),
  );
}

/// The team's note: the mark, the words with their first line indented, "-", who said it.
class _TeamQuote extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return Padding(
      padding: EdgeInsets.fromLTRB(width / 8, 120, kGutter, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('“', style: _display.copyWith(fontSize: 36, height: 0.6)),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(
              children: [
                WidgetSpan(child: SizedBox(width: width * 0.12)),
                TextSpan(
                  text: t(
                    'Lịch trình hay nhất không nằm trong cẩm nang, mà nằm trong chuyến đi của ai đó vừa trở về. Chúng tôi làm ChillnGo để những chuyến đi ấy được kể lại đủ chi tiết, và người đi sau chỉ cần một chạm để bắt đầu.',
                  ),
                ),
              ],
            ),
            style: _display.copyWith(fontSize: 24, fontWeight: FontWeight.w500, height: 1.2, letterSpacing: -0.4),
          ),
          const SizedBox(height: 6),
          const Text('-', style: _bodyMedium),
          Scribbled(
            place: (s) {
              final w = (s.width * 1.6).clamp(140.0, double.infinity);
              return Rect.fromLTWH(-0.2 * s.width, s.height * 0.7, w, w * 0.2);
            },
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t('Đội ngũ ChillnGo'), style: _bodyMedium),
                Text(t('Những người làm ra ChillnGo'), style: _bodyMedium.copyWith(color: AppColors.meta)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ----------------------------------------------------------------- stops */

/// Share of the pin spent opening the first panel's window, before the slide.
const _reveal = 0.15;

/// The route (web: RouteScrollStage): pinned, a window of one photo opens over
/// another, then the track slides sideways through three stops to the
/// community's line over Sa Pa. "Bắc / Nam" then rises letter by letter over
/// the same photo, and an arch of the dark ground rises over it all.
class _Stops extends StatelessWidget {
  const _Stops({required this.rows, required this.stats});

  final List<DestinationRow> rows;
  final LandingStats stats;

  /// Three trips spread north to south, by the first stop of each, and the route's two ends (web: pickStops).
  ({List<DestinationRow> stops, DestinationRow? north, DestinationRow? south}) _pick() {
    final trips = <String, List<DestinationRow>>{};
    for (final row in rows) {
      (trips[row.tripTitle] ??= []).add(row);
    }
    double meanLat(List<DestinationRow> s) => s.fold(0.0, (sum, r) => sum + r.lat) / s.length;
    final ordered = trips.values.toList()..sort((a, b) => meanLat(b).compareTo(meanLat(a)));
    final picked = ordered.length <= 3 ? ordered : [for (var i = 0; i < 3; i++) ordered[(i * (ordered.length - 1) / 2).round()]];
    return (stops: [for (final s in picked) s.first], north: ordered.firstOrNull?.first, south: ordered.lastOrNull?.last);
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final (:stops, :north, :south) = _pick();
    final panels = [for (final stop in stops) _stopPanel(context, size, stop), _communityPanel(size)];
    final distance = panels.length * size.width;
    final pin = distance / (1 - _reveal);

    return ScrollPass(
      builder: (context, pass, _) {
        final p = pass.pinned(pin);
        final open = Curves.easeInOutQuad.transform(unit(p / _reveal));
        final slide = unit((p - _reveal) / (1 - _reveal));
        return Stack(
          children: [
            // The photo every layer below is set over; it holds still as they pass.
            Positioned(
              top: pass.stuck(pass.height - size.height),
              left: 0,
              right: 0,
              height: size.height,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  NetImage(landingPhoto(LandingPhoto.saPa, 1200, 2000), placeholderColor: AppColors.canopy),
                  const ColoredBox(color: Color(0x1A000000)),
                ],
              ),
            ),
            Column(
              children: [
                SizedBox(
                  height: size.height + pin,
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: Transform.translate(
                      offset: Offset(0, pass.stuck(pin)),
                      child: SizedBox(
                        height: size.height,
                        child: ClipRect(
                          child: OverflowBox(
                            alignment: Alignment.centerLeft,
                            maxWidth: distance + size.width,
                            child: Transform.translate(
                              offset: Offset(-distance * slide, 0),
                              child: Row(children: [_window(size, north, south, open), ...panels]),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                _RouteTitle(north: north, south: south),
                const _Curtain(),
              ],
            ),
          ],
        );
      },
    );
  }

  /// Panel 1: Hạ Long, with a window onto the beach that opens from a small
  /// rounded window to full bleed, the picture settling from a zoom, as [open] goes 0 → 1.
  Widget _window(Size size, DestinationRow? north, DestinationRow? south, double open) => SizedBox(
    width: size.width,
    child: Stack(
      fit: StackFit.expand,
      children: [
        NetImage(landingPhoto(LandingPhoto.haLong, 1200, 1800), placeholderColor: AppColors.canopy),
        ClipRRect(
          clipper: InsetClip.lerp(const EdgeInsets.fromLTRB(0.34, 0.28, 0.34, 0.28), EdgeInsets.zero, 6, 0, open),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Transform.scale(
                scale: 1.25 - 0.25 * open,
                child: NetImage(landingPhoto(LandingPhoto.beach, 1200, 1800), placeholderColor: AppColors.canopy),
              ),
              const ColoredBox(color: Color(0x40000000)),
              Center(
                child: Text(t('Điểm dừng'), style: _display.copyWith(fontSize: 60, letterSpacing: -2, color: AppColors.white)),
              ),
              Positioned(
                left: size.width / 8,
                right: size.width / 4,
                bottom: size.height * 0.12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('Toạ độ có thật').toUpperCase(), style: _monoCaps),
                    const SizedBox(height: 6),
                    Text(
                      north != null && south != null
                          ? t('{n} điểm dừng được ghim toạ độ bởi chính người đã đến, từ {from} tới {to}. Cuộn để đi một vòng.', {
                              'n': formatNumber(stats.stopCount),
                              'from': _tripPlace(north.tripTitle),
                              'to': _tripPlace(south.tripTitle),
                            })
                          : t('{n} điểm dừng được ghim toạ độ bởi chính người đã đến. Cuộn để đi một vòng.', {'n': formatNumber(stats.stopCount)}),
                      style: _bodyMedium.copyWith(color: AppColors.white),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  /// Panels 2–4: one stop each, a card on the dark ground.
  Widget _stopPanel(BuildContext context, Size size, DestinationRow stop) => Container(
    width: size.width,
    color: AppColors.ground,
    padding: const EdgeInsets.symmetric(horizontal: 20),
    alignment: Alignment.center,
    child: GestureDetector(
      onTap: () => context.push('/posts/${stop.postId}'),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0x08FFFFFF),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.border),
        ),
        child: AspectRatio(
          aspectRatio: 4 / 5,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(travelPhoto(stop.name, w: 900, h: 1100, theme: themeFromText(stop.name)), placeholderColor: AppColors.canopy),
                const ColoredBox(color: Color(0x33000000)),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 40, 20, 20),
                  child: Column(
                    children: [
                      Text(
                        stop.name,
                        textAlign: TextAlign.center,
                        style: _display.copyWith(fontSize: 26, color: AppColors.white),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        t('Một điểm dừng trong {trip}. Mở hành trình để xem giờ giấc, chi phí và ghi chú của người đã đi.', {'trip': stop.tripTitle}),
                        textAlign: TextAlign.center,
                        style: _bodyMedium.copyWith(color: AppColors.white, height: 1.4),
                      ),
                      const SizedBox(height: 20),
                      const _UnderlinedLink(),
                      const Spacer(),
                      Text('[ ${_lat(stop.lat)}, ${_lng(stop.lng)} ]', style: _monoCaps.copyWith(letterSpacing: 0)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  /// The last panel: see-through, so the community's line sits on Sa Pa.
  Widget _communityPanel(Size size) => SizedBox(
    width: size.width,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('“', style: _display.copyWith(fontSize: 52, height: 0.6, color: AppColors.white)),
          const SizedBox(height: 16),
          Text(
            t('Lên kế hoạch mất ba tuần. Sao chép một chuyến đi có thật chỉ mất một chạm.'),
            textAlign: TextAlign.center,
            style: _display.copyWith(fontSize: 24, fontWeight: FontWeight.w500, height: 1.2, color: AppColors.white),
          ),
          const SizedBox(height: 6),
          Text('-', style: _bodyMedium.copyWith(color: AppColors.white)),
          Text(t('Cộng đồng ChillnGo').toUpperCase(), style: _monoCaps),
        ],
      ),
    ),
  );
}

/// The route's two ends, "Bắc / Nam", rising letter by letter over the photo,
/// then shrinking away as the curtain below comes up.
class _RouteTitle extends StatelessWidget {
  const _RouteTitle({required this.north, required this.south});

  final DestinationRow? north;
  final DestinationRow? south;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context).height;
    final lines = t('Bắc — Nam').toUpperCase().split(' — ');
    final count = lines.fold(0, (n, line) => n + line.characters.length);
    final north = this.north, south = this.south;
    return ScrollPass(
      builder: (context, pass, _) {
        // The title sits ~140 px into the section: 'top 95%' → 'top 35%' of it.
        final rise = pass.between(0.95 * screen - 140, 0.35 * screen - 140);
        // The curtain starts where this section ends: 'top 75%' → 'top 15%' of it.
        final away = Curves.easeInQuad.transform(pass.still ? 0 : unit((0.75 * screen - pass.top - pass.height) / (0.6 * screen)));
        var i = 0;
        return Container(
          constraints: BoxConstraints(minHeight: screen),
          padding: const EdgeInsets.fromLTRB(0, 140, 0, 96),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Opacity(
                opacity: 1 - away,
                child: Transform.scale(
                  scale: 1 - 0.15 * away,
                  child: Semantics(
                    label: t('Bắc — Nam'),
                    excludeSemantics: true,
                    child: Column(
                      children: [
                        for (final line in lines)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              for (final char in line.characters)
                                Builder(
                                  builder: (context) {
                                    final q = stagger(rise, i++, count, 0.04, Curves.easeOutCubic);
                                    return Opacity(
                                      opacity: q,
                                      child: FractionalTranslation(
                                        translation: Offset(0, 0.3 * (1 - q)),
                                        child: Text(char, style: _condensed.copyWith(fontSize: 128, height: 0.9, color: const Color(0xB3FFFFFF))),
                                      ),
                                    );
                                  },
                                ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              if (north != null && south != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 32, 24, 0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${_lat(north.lat)} ${_lng(north.lng)}\n${_tripPlace(north.tripTitle)}', style: _monoCaps.copyWith(color: const Color(0xCCFFFFFF), letterSpacing: 0, height: 1.5)),
                      Text(
                        '${_lat(south.lat)} ${_lng(south.lng)}\n${_tripPlace(south.tripTitle)}',
                        textAlign: TextAlign.right,
                        style: _monoCaps.copyWith(color: const Color(0xCCFFFFFF), letterSpacing: 0, height: 1.5),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// The hand-over to the dark stages: the ground rises over the photo with an
/// arched top that flattens as it fills the screen. Its lower part lies under
/// the next stage (web: -mb-[45svh]), so that stage's heading arrives as it flattens.
class _Curtain extends StatelessWidget {
  const _Curtain();

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context).height;
    return ScrollPass(
      builder: (context, pass, _) => SizedBox(
        height: screen * 0.55,
        child: OverflowBox(
          alignment: Alignment.topCenter,
          maxHeight: screen,
          minHeight: screen,
          child: ClipPath(
            clipper: ArchClip(0.6 + 1.4 * Curves.easeInQuad.transform(pass.between(screen, 0))),
            child: const ColoredBox(color: AppColors.ground, child: SizedBox.expand()),
          ),
        ),
      ),
    );
  }
}

/* ---------------------------------------------------------- how it works */

/// The three steps, each a photo, a title and its points (web: HowItWorksStage).
///
/// The heading slides in; each photo opens out of a smaller rounded window as
/// it rises while the picture settles from a zoom, and its copy rises in once
/// the step reaches the middle.
class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  List<({String title, LandingPhoto photo, List<(String, String)> points})> get _steps => [
    (
      title: t('Khám phá hành trình thật'),
      photo: LandingPhoto.haLong,
      points: [(t('Lọc theo vùng, mùa và ngân sách'), t(' để ra đúng kiểu chuyến bạn muốn.')), (t('Xem từng ngày:'), t(' mỗi điểm dừng có ghi chú, ảnh và chi phí ước tính.'))],
    ),
    (
      title: t('Sao chép về và sửa theo ý bạn'),
      photo: LandingPhoto.mountainRoad,
      points: [
        (t('Sao chép một chạm'), t(' biến chuyến đi của người khác thành bản nháp của bạn.')),
        (t('Kéo thả để đổi thứ tự ngày,'), t(' ngày tháng tự cập nhật theo.')),
        (t('Ghép nhiều chuyến:'), t(' lấy những ngày hay nhất từ nhiều bài.')),
      ],
    ),
    (title: t('Đi xong, chia sẻ lại'), photo: LandingPhoto.beach, points: [(t('Đăng hành trình của bạn'), t(' cho người đi sau tham khảo và sao chép tiếp.'))]),
  ];

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 120, 24, 60),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SlideInWords(t('Cách ChillnGo hoạt động'), style: _display.copyWith(fontSize: 32, height: 1.02)),
        for (final step in _steps) ...[
          const SizedBox(height: 48),
          Reveal(
            at: 0.6,
            duration: const Duration(milliseconds: 980),
            curve: Curves.linear,
            child: ScrollPass(
              builder: (context, pass, _) {
                final drift = pass.through;
                return ClipRRect(
                  clipper: InsetClip.lerp(const EdgeInsets.fromLTRB(0.14, 0.16, 0.14, 0.16), EdgeInsets.zero, 28, 16, pass.topBetween(0.92, 0.35)),
                  child: AspectRatio(
                    aspectRatio: 4 / 3,
                    child: Transform.scale(
                      scale: 1.3 - 0.3 * drift,
                      child: FractionalTranslation(
                        translation: Offset(0, -0.06 + 0.12 * drift),
                        child: ColorFiltered(
                          colorFilter: const ColorFilter.mode(Color(0x2E000000), BlendMode.darken),
                          child: NetImage(landingPhoto(step.photo, 1200, 900), placeholderColor: AppColors.canopy),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
            builder: (context, shown, frame) {
              double copy(int i) => stagger(shown, i, 2, 0.09, Curves.easeOutExpo);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  frame!,
                  const SizedBox(height: 22),
                  _rise(copy(0), Text(step.title, style: _display.copyWith(fontSize: 22, letterSpacing: -0.5, height: 1.15)), by: 28),
                  const SizedBox(height: 14),
                  _rise(
                    copy(1),
                    by: 28,
                    Column(
                      children: [
                        for (final (lead, rest) in step.points)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(width: 8, height: 1, margin: const EdgeInsets.only(top: 11, right: 10), color: AppColors.primary),
                                Expanded(
                                  child: Text.rich(
                                    TextSpan(
                                      children: [
                                        TextSpan(
                                          text: lead,
                                          style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.cream),
                                        ),
                                        TextSpan(text: rest),
                                      ],
                                    ),
                                    style: AppText.body.copyWith(color: AppColors.meta),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ],
    ),
  );
}

/* ------------------------------------------------------------ most saved */

/// Four journeys in a staggered grid: a wide one, two portraits, a banner (web: FeaturedTripsStage).
///
/// The heading slides in; each card tips up into place as it reaches the
/// screen, and drops back if you scroll above it.
class _MostSaved extends StatelessWidget {
  const _MostSaved({required this.posts});

  final List<TripPost> posts;

  /// [late]: the second of a pair, 0.1 s behind the first (web: a batch's stagger).
  Widget _card(BuildContext context, TripPost post, double aspect, {bool late = false}) => Reveal(
    duration: Duration(milliseconds: late ? 1300 : 1200),
    curve: late ? const Interval(0.077, 1, curve: Curves.easeOutExpo) : Curves.easeOutExpo,
    back: (const Duration(milliseconds: 500), Curves.easeInCubic),
    builder: (context, shown, child) => Opacity(
      opacity: shown.clamp(0.0, 1.0),
      child: Transform(alignment: Alignment.center, transform: tiltUp(shown), child: child),
    ),
    child: GestureDetector(
      onTap: () => context.push('/posts/${post.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            foregroundDecoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0x1AFFFFFF)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: AspectRatio(
                aspectRatio: aspect,
                child: ColorFiltered(
                  colorFilter: const ColorFilter.mode(Color(0x33000000), BlendMode.darken),
                  child: NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text('${regionLabel(post.region)} · ${tripLengthLabel(post.days.length)}', style: AppText.meta),
          const SizedBox(height: 4),
          Text(shortTitle(post.title), style: AppText.h3.copyWith(fontSize: 17, letterSpacing: -0.3)),
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 80, 24, 120),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Align(
                alignment: Alignment.centerLeft,
                child: SizedBox(width: 220, child: SlideInWords(t('Được lưu nhiều nhất'), style: _display.copyWith(fontSize: 32, height: 1.02))),
              ),
            ),
            _WhitePill(label: t('Xem tất cả').toUpperCase(), small: true, onTap: () => context.go('/discover')),
          ],
        ),
        const SizedBox(height: 56),
        _card(context, posts[0], 4 / 3),
        if (posts.length > 2) ...[
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _card(context, posts[1], 4 / 5)),
              const SizedBox(width: 24),
              Expanded(child: _card(context, posts[2], 4 / 5, late: true)),
            ],
          ),
        ],
        if (posts.length > 3) ...[const SizedBox(height: 24), _card(context, posts[3], 16 / 8)],
      ],
    ),
  );
}

/* ---------------------------------------------------------------- footer */

/// The last call, the giant wordmark, the links (web: HomeFooter).
/// The heading slides in; the wordmark rises letter by letter out of masks as the page runs out.
class _Footer extends ConsumerWidget {
  const _Footer({required this.onTop});

  final VoidCallback onTop;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(sessionProvider.select((s) => s.signedIn));
    final size = MediaQuery.sizeOf(context);
    final fontSize = (size.width - 48) / 5.2;
    const mark = 'ChillnGo';
    return ScrollPass(
      builder: (context, pass, _) {
        // From its top at 70% of the screen to its bottom at the bottom.
        final rise = pass.between(0.7 * size.height, size.height - pass.height);
        return Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          padding: EdgeInsets.fromLTRB(24, 120, 24, MediaQuery.paddingOf(context).bottom + 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SlideInWords(t('Chuyến tiếp theo bắt đầu từ đây'), style: _display.copyWith(fontSize: 32, height: 1.02)),
              const SizedBox(height: 32),
              _WhitePill(label: signedIn ? t('Đăng hành trình') : t('Bắt đầu ngay'), onTap: () => context.push(signedIn ? '/posts/new' : '/register')),
              const SizedBox(height: 80),
              Semantics(
                label: mark,
                excludeSemantics: true,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final (i, char) in mark.split('').indexed)
                      ClipRect(
                        child: FractionalTranslation(
                          translation: Offset(0, 1 - stagger(rise, i, mark.length, 0.04, Curves.easeOutCubic)),
                          child: Text(
                            char,
                            style: TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w800, fontSize: fontSize, height: 1, letterSpacing: -fontSize * 0.05, color: const Color(0x1AFFFFFF)),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              Text('© 2026 ChillnGo', style: AppText.meta),
              const SizedBox(height: 12),
              Wrap(
                spacing: 20,
                runSpacing: 4,
                children: [
                  TextLink(label: t('Khám phá'), color: AppColors.meta, onPressed: () => context.go('/discover')),
                  TextLink(label: t('Newsfeed'), color: AppColors.meta, onPressed: () => context.go('/feed')),
                  TextLink(label: t('Hành trình của tôi'), color: AppColors.meta, onPressed: () => context.push('/itineraries')),
                  TextLink(label: t('Đăng bài mới'), color: AppColors.meta, onPressed: () => context.push('/posts/new')),
                  TextLink(label: '${t('Về đầu trang')} ↑', color: AppColors.meta, onPressed: onTop),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

/// A white pill with dark text: the footer's call, and "Xem tất cả" in small caps.
class _WhitePill extends StatelessWidget {
  const _WhitePill({required this.label, required this.onTap, this.small = false});

  final String label;
  final VoidCallback onTap;
  final bool small;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.cream,
    shape: const StadiumBorder(),
    child: InkWell(
      customBorder: const StadiumBorder(),
      onTap: onTap,
      child: Padding(
        padding: small ? const EdgeInsets.symmetric(horizontal: 16, vertical: 13) : const EdgeInsets.symmetric(horizontal: 36, vertical: 20),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: small ? AppFonts.body : AppFonts.display,
            fontWeight: small ? FontWeight.w500 : FontWeight.w700,
            fontSize: small ? 13 : 15,
            letterSpacing: small ? 0.6 : 0,
            color: AppColors.ground,
          ),
        ),
      ),
    ),
  );
}
