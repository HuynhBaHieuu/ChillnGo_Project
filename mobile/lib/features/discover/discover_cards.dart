import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import '../post/post_actions.dart';
import 'interests.dart';

/// A photo-first trip card with a save button (web: DiscoverCard).
/// [wide]: landscape photo with the title under it.
class DiscoverCard extends ConsumerWidget {
  const DiscoverCard({super.key, required this.post, this.chip, this.wide = false, this.rank});

  final TripPost post;
  final String? chip;
  final bool wide;
  final int? rank;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = postCounts(post, ref.watch(postOverlaysProvider.select((m) => m[post.id])));
    return Stack(
      children: [
        Semantics(
          button: true,
          label: post.title,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => context.push('/posts/${post.id}'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: AspectRatio(
                    aspectRatio: wide ? 16 / 10 : 1,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                        if (!wide) Positioned(left: 10, bottom: 10, child: AppBadge(tripLengthLabel(post.days.length), tone: BadgeTone.overlay)),
                      ],
                    ),
                  ),
                ),
                if (wide)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
                    child: Text(post.title, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: AppText.h3),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (rank != null)
                          Text(
                            '$rank',
                            style: const TextStyle(
                              fontFamily: AppFonts.display,
                              fontWeight: FontWeight.w900,
                              fontSize: 30,
                              height: 1.15,
                              color: AppColors.cream,
                            ),
                          ),
                        if (chip != null) ...[AppBadge(chip!), const SizedBox(height: 6)],
                        Text(post.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.h3),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(counts.liked ? Icons.favorite : LucideIcons.heart, size: 13, color: counts.liked ? AppColors.social : AppColors.meta),
                            const SizedBox(width: 4),
                            Text(formatCount(counts.likeCount), style: AppText.meta),
                            const SizedBox(width: 12),
                            const Icon(LucideIcons.messageCircle, size: 13, color: AppColors.meta),
                            const SizedBox(width: 4),
                            Text(formatCount(counts.commentCount), style: AppText.meta),
                            const SizedBox(width: 12),
                            const Icon(LucideIcons.bookmark, size: 13, color: AppColors.meta),
                            const SizedBox(width: 4),
                            Text(formatCount(counts.saveCount), style: AppText.meta),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${budgetLabel(post.budgetLevel)} · từ ${formatVndShort(post.totalEstCost)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        Positioned(
          top: 8,
          right: 8,
          child: AppIconButton(
            icon: counts.saved ? Icons.bookmark : LucideIcons.bookmark,
            label: counts.saved ? 'Bỏ lưu hành trình' : 'Lưu hành trình',
            tone: IconTone.overlay,
            size: 36,
            onPressed: () => toggleSave(context, ref, post),
          ),
        ),
      ],
    );
  }
}

class DiscoverCardSkeleton extends StatelessWidget {
  const DiscoverCardSkeleton({super.key, this.width});

  final double? width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(aspectRatio: 1, child: const Skeleton(height: double.infinity)),
          const SizedBox(height: 8),
          const FractionallySizedBox(widthFactor: 0.8, child: Skeleton(height: 18)),
          const SizedBox(height: 8),
          const FractionallySizedBox(widthFactor: 0.5, child: Skeleton(height: 14)),
        ],
      ),
    );
  }
}

/// A two-column grid of cards.
class CardGrid extends StatelessWidget {
  const CardGrid({super.key, required this.children, this.gap = 12, this.runGap = 22});

  final List<Widget> children;
  final double gap;
  final double runGap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: runGap,
          children: [for (final child in children) SizedBox(width: width, child: child)],
        );
      },
    );
  }
}

/// A big photo with the title and handle on a dark band (web: FeaturedStory).
class FeaturedStory extends StatelessWidget {
  const FeaturedStory({super.key, required this.post, this.height = 260});

  final TripPost post;
  final double height;

  @override
  Widget build(BuildContext context) {
    final author = post.author;
    return Semantics(
      button: true,
      label: post.title,
      child: GestureDetector(
        onTap: () => context.push('/posts/${post.id}'),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          child: SizedBox(
            height: height,
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                const _BottomShade(),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 14,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.h2.copyWith(color: AppColors.white),
                      ),
                      if (author != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            AppAvatar(url: author.avatarUrl, name: author.displayName, size: 22),
                            const SizedBox(width: 6),
                            Text('@${author.username}', style: AppText.bodySmall.copyWith(color: const Color(0xE6FFFFFF))),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BottomShade extends StatelessWidget {
  const _BottomShade();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x00000000), Color(0x00000000), Color(0xBF000000)],
          stops: [0, 0.4, 1],
        ),
      ),
    );
  }
}

/// A trip read as a journal entry (web: StoryCard).
class StoryCard extends StatelessWidget {
  const StoryCard({super.key, required this.post});

  final TripPost post;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: post.title,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.push('/posts/${post.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
              ),
            ),
            const SizedBox(height: 10),
            Text(post.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.h3),
            const SizedBox(height: 4),
            Text('${formatShortDate(post.startDate)} • ${post.days.length} ngày', style: AppText.meta),
            Text('Bởi ${post.author?.displayName ?? ''}', style: AppText.meta),
          ],
        ),
      ),
    );
  }
}

/// A labelled photo tile: interests, regions (web: PhotoTile).
class PhotoTile extends StatelessWidget {
  const PhotoTile({super.key, required this.label, required this.image, required this.onTap, this.active = false, this.height = 200});

  final String label;
  final String image;
  final VoidCallback onTap;
  final bool active;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: active,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: active ? AppColors.primary : Colors.transparent, width: 2),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.lg - 2),
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(image, placeholderColor: AppColors.canopy),
                const _BottomShade(),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 10,
                  child: Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A row of cards that scrolls sideways and snaps card by card (web: CardCarousel).
class Carousel<T> extends StatelessWidget {
  const Carousel({super.key, required this.items, required this.itemBuilder, this.cardShare = 0.44, this.height});

  final List<T> items;
  final Widget Function(BuildContext context, T item, double width) itemBuilder;

  /// Share of the screen width one card takes (0.44 shows two and a bit).
  final double cardShare;

  /// Fixed row height; measured from the first card when null.
  final double? height;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context).width;
    final cardWidth = (screen * cardShare).clamp(0, 320).roundToDouble();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      padding: const EdgeInsets.symmetric(horizontal: kGutter),
      physics: const BouncingScrollPhysics(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            SizedBox(width: cardWidth, height: height, child: itemBuilder(context, items[i], cardWidth)),
          ],
        ],
      ),
    );
  }
}

/// A titled band of content; the carousel inside bleeds to the screen edges.
class Band extends StatelessWidget {
  const Band({super.key, required this.title, this.description, this.action, required this.child, this.bleed = true});

  final String title;
  final String? description;
  final Widget? action;
  final Widget child;

  /// The child spans the full screen width (carousels).
  final bool bleed;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter),
          child: SectionHeader(title: title, subtitle: description, action: action),
        ),
        const SizedBox(height: 14),
        if (bleed)
          child
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kGutter),
            child: child,
          ),
      ],
    );
  }
}

/// "Khám phá theo sở thích": square tiles, one per interest (web: InterestGrid).
class InterestRow extends StatelessWidget {
  const InterestRow({super.key, required this.tiles, this.title = 'Khám phá theo sở thích', this.description = 'Bạn mê gì, cộng đồng đều đã đi qua.'});

  final List<InterestTile> tiles;
  final String title;
  final String? description;

  @override
  Widget build(BuildContext context) {
    return Band(
      title: title,
      description: description,
      child: Carousel<InterestTile>(
        items: tiles,
        cardShare: 0.46,
        itemBuilder: (context, tile, width) => PhotoTile(label: tile.tag, image: tile.image, height: width, onTap: () => context.push(interestPath(tile.tag))),
      ),
    );
  }
}

/// The most-saved trip, as an award band (web: TripOfTheYearBanner).
class TripOfTheYearBanner extends StatelessWidget {
  const TripOfTheYearBanner({super.key, required this.post});

  final TripPost post;

  @override
  Widget build(BuildContext context) {
    void open() => context.push('/posts/${post.id}');
    return AppCard(
      surface: Surface.featured,
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(14)),
                  child: const Icon(LucideIcons.trophy, size: 28, color: AppColors.onPrimary),
                ),
                const SizedBox(height: 12),
                Text('Hành trình của năm', style: AppText.h1),
                const SizedBox(height: 6),
                Text('Được lưu nhiều nhất trên ChillnGo, do chính cộng đồng bình chọn bằng từng lượt lưu.', style: AppText.body),
                const SizedBox(height: 14),
                AppButton(label: 'Xem hành trình', onPressed: open),
              ],
            ),
          ),
          GestureDetector(
            onTap: open,
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                  const _BottomShade(),
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 14,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          post.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.h3.copyWith(color: AppColors.white),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Text(post.author?.displayName ?? '', style: AppText.bodySmall.copyWith(color: AppColors.cream)),
                            const SizedBox(width: 10),
                            const Icon(LucideIcons.bookmark, size: 13, color: AppColors.meta),
                            const SizedBox(width: 4),
                            Text(formatCount(post.bookmarkCount), style: AppText.meta),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

const _bannerImage = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&h=900&q=75';

/// "Kể lại chuyến đi của bạn" (web: ShareTripBanner).
class ShareTripBanner extends StatelessWidget {
  const ShareTripBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      surface: Surface.surface,
      padding: const EdgeInsets.all(18),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: const AspectRatio(
              aspectRatio: 4 / 3,
              child: NetImage(_bannerImage, placeholderColor: AppColors.canopy),
            ),
          ),
          const SizedBox(height: 14),
          Text('Cộng đồng ChillnGo', style: AppText.meta, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text('Kể lại chuyến đi của bạn', style: AppText.h1, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            'Chia sẻ lịch trình, chi phí và những điểm dừng bạn yêu thích. Hành trình của bạn có thể là cảm hứng cho chuyến đi tiếp theo của ai đó.',
            style: AppText.body,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 14),
          AppButton(label: 'Đăng hành trình', onPressed: () => context.push('/posts/new')),
        ],
      ),
    );
  }
}

/// Region labels for chips.
String regionChip(TripPost post) => regionLabel(post.region);
