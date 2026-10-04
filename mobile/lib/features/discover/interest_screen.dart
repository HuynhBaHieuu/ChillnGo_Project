import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/labels.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/discovery_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import 'discover_cards.dart';
import 'interests.dart';
import '../../ui/navigation.dart';

const _minRow = 2;

/// One interest (a tag) on its own page (web: InterestPage).
class InterestScreen extends ConsumerWidget {
  const InterestScreen({super.key, required this.tag});

  final String tag;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final all = ref.watch(discoverProvider(const DiscoverFilters()));
    final posts = all.value ?? const <TripPost>[];

    final trips = posts.where((p) => p.tags.contains(tag)).toList();
    final byLikes = [...trips]..sort((a, b) => b.likeCount.compareTo(a.likeCount));
    final featured = byLikes.firstOrNull;
    final newest = ([...trips]..sort((a, b) => b.createdAt.compareTo(a.createdAt))).where((p) => p != featured).toList();
    final spreadPhoto = byLikes.length > 1 ? byLikes[1] : null;
    final cheapest = ([...trips]..sort((a, b) => a.totalEstCost.compareTo(b.totalEstCost))).where((p) => p != spreadPhoto).take(4).toList();
    final covers = ([...trips]..sort((x, y) => x.tags.indexOf(tag).compareTo(y.tags.indexOf(tag)))).map((p) => p.coverUrl).toSet().take(6).toList();
    final regionTiles = [
      for (final region in regions)
        if (trips.where((p) => p.region == region).firstOrNull case final post?) (region: region, image: post.coverUrl),
    ];
    final others = pickInterestTiles(posts, 6, [tag]);
    final journal = [...newest, ?featured].take(3).toList();

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: Text('#$tag')),
      body: all.isLoading && !all.hasValue
          ? const Padding(
              padding: EdgeInsets.all(kGutter),
              child: Column(
                children: [
                  Skeleton(height: 320, radius: AppRadius.lg),
                  SizedBox(height: 16),
                  Skeleton(height: 24, width: 220),
                ],
              ),
            )
          : all.hasError && !all.hasValue
          ? Padding(
              padding: const EdgeInsets.all(kGutter),
              child: ErrorPanel(error: all.error, onRetry: () => ref.invalidate(discoverProvider)),
            )
          : ListView(
              padding: const EdgeInsets.only(top: 8, bottom: 48),
              children: trips.isEmpty
                  ? [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: kGutter),
                        child: EmptyState(
                          icon: LucideIcons.searchX,
                          title: 'Chưa có hành trình nào về “$tag”',
                          description: 'Thử một sở thích khác bên dưới, hoặc là người đầu tiên chia sẻ.',
                          action: AppButton(label: 'Đăng hành trình', onPressed: () => context.push('/posts/new')),
                        ),
                      ),
                      if (others.isNotEmpty) ...[const SizedBox(height: 32), InterestRow(tiles: others, title: 'Sở thích khác')],
                    ]
                  : [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: kGutter),
                        child: _InterestHero(title: interestHeadline(tag), subtitle: '${trips.length} hành trình gắn thẻ “$tag”', images: covers),
                      ),
                      const SizedBox(height: 32),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: kGutter),
                        child: Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(14)),
                              child: const Icon(LucideIcons.trophy, size: 24, color: AppColors.onPrimary),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Bảng xếp hạng cộng đồng', style: AppText.h2),
                                  Text('Những hành trình “$tag” được lưu nhiều nhất', style: AppText.meta),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Carousel<TripPost>(
                        items: trips.take(10).toList(),
                        itemBuilder: (_, p, _) => DiscoverCard(post: p, rank: trips.indexOf(p) + 1, chip: regionLabel(p.region)),
                      ),
                      if (featured != null && newest.length >= _minRow) ...[
                        const SizedBox(height: 32),
                        Band(
                          title: 'Câu chuyện nổi bật',
                          description: 'Được thả tim nhiều nhất, cùng những chuyến mới đăng',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: kGutter),
                                child: FeaturedStory(post: featured),
                              ),
                              const SizedBox(height: 14),
                              Carousel<TripPost>(
                                items: newest,
                                itemBuilder: (_, p, _) => DiscoverCard(post: p, chip: regionLabel(p.region)),
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (spreadPhoto != null && cheapest.length >= _minRow) ...[
                        const SizedBox(height: 32),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: kGutter),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              FeaturedStory(post: spreadPhoto, height: 300),
                              const SizedBox(height: 14),
                              const SectionHeader(title: 'Đi vừa túi tiền', subtitle: 'Từ chuyến rẻ nhất trở lên'),
                              const SizedBox(height: 14),
                              CardGrid(
                                children: [for (final p in cheapest) DiscoverCard(post: p, chip: regionLabel(p.region))],
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (regionTiles.isNotEmpty) ...[
                        const SizedBox(height: 32),
                        Band(
                          title: 'Đi đâu để “$tag”',
                          child: Carousel<({String region, String image})>(
                            items: regionTiles,
                            cardShare: 0.5,
                            itemBuilder: (_, r, width) => PhotoTile(
                              label: regionLabel(r.region),
                              image: r.image,
                              height: width * 1.25,
                              onTap: () => context.go('/discover?region=${Uri.encodeQueryComponent(r.region)}&tag=${Uri.encodeQueryComponent(tag)}'),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 32),
                      Band(
                        title: 'Nhật ký hành trình',
                        description: 'Lên kế hoạch cho chuyến tới, đọc từ người đã đi',
                        bleed: false,
                        child: Column(
                          children: [
                            for (final p in journal) ...[StoryCard(post: p), const SizedBox(height: 24)],
                          ],
                        ),
                      ),
                      if (others.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        InterestRow(tiles: others, title: 'Sở thích khác', description: 'Còn nhiều cách khác để lên đường.'),
                      ],
                    ],
            ),
    );
  }
}

/// The interest page's banner: a slow slideshow of covers with the title on a
/// dark band (web: InterestHero). Paused for readers who ask for less motion.
class _InterestHero extends StatefulWidget {
  const _InterestHero({required this.title, required this.subtitle, required this.images});

  final String title;
  final String subtitle;
  final List<String> images;

  @override
  State<_InterestHero> createState() => _InterestHeroState();
}

class _InterestHeroState extends State<_InterestHero> {
  int _index = 0;
  bool? _playing;
  Timer? _timer;

  bool get _canPlay => widget.images.length > 1;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _playing ??= !MediaQuery.of(context).disableAnimations;
    _restart();
  }

  void _restart() {
    _timer?.cancel();
    if (_playing == true && _canPlay) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (mounted) setState(() => _index = (_index + 1) % widget.images.length);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: SizedBox(
        height: 320,
        child: Stack(
          fit: StackFit.expand,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 900),
              // The default layout is a loose Stack, which shrinks each photo to
              // its own size during the fade. Both photos must fill the banner.
              layoutBuilder: (current, previous) => Stack(fit: StackFit.expand, children: [...previous, ?current]),
              child: widget.images.isEmpty
                  ? const ColoredBox(color: AppColors.canopy)
                  : NetImage(widget.images[_index], key: ValueKey(_index), placeholderColor: AppColors.canopy),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x00000000), Color(0xB8000000)],
                  stops: [0.35, 1],
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 12,
              bottom: 16,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.title, style: AppText.hero.copyWith(color: AppColors.white)),
                        const SizedBox(height: 4),
                        Text(widget.subtitle, style: AppText.bodySmall.copyWith(color: const Color(0xD9FFFFFF))),
                      ],
                    ),
                  ),
                  if (_canPlay)
                    AppIconButton(
                      icon: _playing == true ? LucideIcons.pause : LucideIcons.play,
                      label: _playing == true ? 'Tạm dừng trình chiếu' : 'Phát trình chiếu',
                      tone: IconTone.overlay,
                      size: 38,
                      onPressed: () {
                        setState(() => _playing = !(_playing ?? true));
                        _restart();
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
