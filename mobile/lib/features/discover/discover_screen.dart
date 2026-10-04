import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/labels.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/server_posts.dart';
import '../../data/services/discovery_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import '../shell/tab_header.dart';
import 'discover_cards.dart';
import 'interests.dart';
import 'search_hero.dart';

String _currentSeason() {
  final month = DateTime.now().month;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/// A row only earns its place with at least this many cards.
const _minRow = 2;

/// Khám phá (web: DiscoverPage): search, region tabs, then curated bands of trips.
class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key, this.initialQuery, this.initialRegion, this.initialTag});

  final String? initialQuery;
  final String? initialRegion;
  final String? initialTag;

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  DiscoverFilters _filters = const DiscoverFilters();
  bool _suggesting = false;
  final _scroll = ScrollController();
  final _resultsKey = GlobalKey();
  final String _season = _currentSeason();

  @override
  void initState() {
    super.initState();
    _applyParams();
  }

  @override
  void didUpdateWidget(DiscoverScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialQuery != widget.initialQuery || oldWidget.initialRegion != widget.initialRegion || oldWidget.initialTag != widget.initialTag) {
      _applyParams();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// ?q= (Search History), ?region= & ?tag= (an interest's region tiles) open Discover already filtered.
  void _applyParams() {
    final q = widget.initialQuery;
    final region = widget.initialRegion;
    final tag = widget.initialTag;
    if ((q ?? '').isEmpty && (region ?? '').isEmpty && (tag ?? '').isEmpty) return;
    setState(() {
      _filters = DiscoverFilters(
        query: (q ?? '').length > 120 ? q!.substring(0, 120) : (q ?? ''),
        region: regions.contains(region) ? region! : 'all',
        tags: (tag ?? '').isEmpty ? const [] : [tag!.length > 60 ? tag.substring(0, 60) : tag],
      );
    });
  }

  bool get _filtering => _filters.query.trim().isNotEmpty || _filters.region != 'all' || _filters.tags.isNotEmpty;

  void _patch(DiscoverFilters next, {bool scrollUp = false}) {
    setState(() => _filters = next);
    if (scrollUp) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final target = _resultsKey.currentContext;
        if (target != null) Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final all = ref.watch(discoverProvider(const DiscoverFilters()));
    final results = _filtering ? ref.watch(discoverProvider(_filters)) : null;
    final posts = all.value ?? const <TripPost>[];

    final food = posts.where((p) => p.tags.contains('ẩm thực')).toList();
    final loved = ([...posts]..sort((a, b) => b.likeCount.compareTo(a.likeCount))).take(8).toList();
    final inspiration = ([...posts]..sort((a, b) => b.createdAt.compareTo(a.createdAt))).take(6).toList();
    final seasonal = posts.where((p) => p.season == _season).toList();
    final interests = pickInterestTiles(posts, 6);
    final regionTiles = [
      for (final region in regions)
        if (posts.where((p) => p.region == region).firstOrNull case final post?) (region: region, image: post.coverUrl),
    ];

    final query = _filters.query.trim();
    final resultsTitle = query.isNotEmpty ? 'Kết quả cho “$query”' : 'Hành trình phù hợp';
    final resultsDetail = [if (_filters.region != 'all') regionLabel(_filters.region), ..._filters.tags].join(' · ');
    final seasonName = seasonLabel(_season).toLowerCase();

    Future<void> refresh() async {
      invalidateServerPosts();
      ref.invalidate(discoverProvider);
      await ref.read(discoverProvider(const DiscoverFilters()).future).catchError((_) => <TripPost>[]);
    }

    return Scaffold(
      body: Column(
        children: [
          const TabHeader(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: refresh,
              color: AppColors.primary,
              backgroundColor: AppColors.surface,
              child: ListView(
                controller: _scroll,
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.only(top: 12, bottom: 48),
                children: [
                  SearchHero(
                    posts: posts,
                    query: _filters.query,
                    region: _filters.region,
                    onSearch: (q) => _patch(_filters.copyWith(query: q), scrollUp: true),
                    onRegionChange: (r) => _patch(_filters.copyWith(region: r)),
                    onPickTag: (tag) => _patch(_filters.copyWith(query: '', tags: [tag]), scrollUp: true),
                    onOpenChange: (open) => setState(() => _suggesting = open),
                  ),
                  SizedBox(key: _resultsKey, height: 28),
                  if (!_suggesting) ...[
                    if (results != null) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: kGutter),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SectionHeader(
                              title: resultsTitle,
                              subtitle: results.isLoading && !results.hasValue
                                  ? 'Đang tìm hành trình…'
                                  : '${results.value?.length ?? 0} hành trình${resultsDetail.isNotEmpty ? ' · $resultsDetail' : ''}',
                              action: AppButton(
                                label: 'Xoá lọc',
                                icon: LucideIcons.x,
                                variant: ButtonVariant.ghost,
                                size: ButtonSize.sm,
                                onPressed: () => setState(() => _filters = const DiscoverFilters()),
                              ),
                            ),
                            const SizedBox(height: 14),
                            if (results.isLoading && !results.hasValue)
                              const CardGrid(children: [DiscoverCardSkeleton(), DiscoverCardSkeleton(), DiscoverCardSkeleton(), DiscoverCardSkeleton()])
                            else if (results.hasError && !results.hasValue)
                              ErrorPanel(error: results.error, onRetry: () => ref.invalidate(discoverProvider(_filters)))
                            else if ((results.value ?? const []).isNotEmpty)
                              CardGrid(
                                children: [for (final p in results.value!) DiscoverCard(post: p, chip: regionLabel(p.region))],
                              )
                            else
                              const EmptyState(
                                icon: LucideIcons.searchX,
                                title: 'Không có hành trình nào khớp',
                                description: 'Thử một từ khoá khác hoặc chọn khu vực “Tất cả”.',
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                    if (all.hasError && !all.hasValue)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: kGutter),
                        child: ErrorPanel(error: all.error, onRetry: () => ref.invalidate(discoverProvider)),
                      ),
                    if (interests.length >= _minRow) ...[InterestRow(tiles: interests), const SizedBox(height: 32)],
                    if (all.isLoading && !all.hasValue)
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: kGutter),
                        child: CardGrid(children: [DiscoverCardSkeleton(), DiscoverCardSkeleton(), DiscoverCardSkeleton(), DiscoverCardSkeleton()]),
                      ),
                    if (food.length >= _minRow) ...[
                      Band(
                        title: 'Ăn ngon khắp ba miền',
                        child: Carousel<TripPost>(
                          items: food,
                          itemBuilder: (_, p, _) => DiscoverCard(post: p, chip: regionLabel(p.region)),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                    if (loved.length >= _minRow) ...[
                      Band(
                        title: 'Hành trình được yêu thích',
                        description: 'Được cộng đồng thả tim nhiều nhất',
                        child: Carousel<TripPost>(
                          items: loved,
                          itemBuilder: (_, p, _) => DiscoverCard(post: p),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: kGutter),
                      child: ShareTripBanner(),
                    ),
                    const SizedBox(height: 32),
                    if (inspiration.length >= _minRow) ...[
                      Band(
                        title: 'Cảm hứng cho chuyến đi tới',
                        child: Carousel<TripPost>(
                          items: inspiration,
                          cardShare: 0.78,
                          itemBuilder: (_, p, _) => DiscoverCard(post: p, wide: true),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                    if (seasonal.length >= _minRow) ...[
                      Band(
                        title: 'Đi đâu $seasonName này?',
                        description: 'Những hành trình hợp nhất với $seasonName',
                        child: Carousel<TripPost>(
                          items: seasonal,
                          itemBuilder: (_, p, _) => DiscoverCard(post: p, chip: regionLabel(p.region)),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                    if (regionTiles.length >= _minRow) ...[
                      Band(
                        title: 'Điểm đến không thể bỏ lỡ',
                        child: Carousel<({String region, String image})>(
                          items: regionTiles,
                          cardShare: 0.5,
                          itemBuilder: (_, r, width) => PhotoTile(
                            label: regionLabel(r.region),
                            image: r.image,
                            height: width * 1.25,
                            active: _filters.region == r.region,
                            onTap: () => _patch(_filters.copyWith(region: _filters.region == r.region ? 'all' : r.region), scrollUp: true),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                    if (posts.isNotEmpty) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: kGutter),
                        child: TripOfTheYearBanner(post: posts.first),
                      ),
                      const SizedBox(height: 32),
                    ],
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: kGutter),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('ChillnGo: cộng đồng của những người mê xê dịch', style: AppText.h2),
                          const SizedBox(height: 10),
                          Text(
                            'ChillnGo giúp bạn đi những chuyến đi trọn vẹn hơn: đọc lịch trình thật từ người đã đi, xem chi phí từng điểm dừng, lưu lại những hành trình bạn thích và sao chép thành lịch trình của riêng mình chỉ với một chạm. Mỗi hành trình bạn chia sẻ lại trở thành cảm hứng cho chuyến đi tiếp theo của ai đó.',
                            style: AppText.meta,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
