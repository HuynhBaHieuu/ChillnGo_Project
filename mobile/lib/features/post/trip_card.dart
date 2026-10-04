import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../ui/surfaces.dart';

/// A journey in a list (web/src/components/TripCard.tsx).
/// [grid]: the compact card for two-column lists.
class TripCard extends ConsumerWidget {
  const TripCard({super.key, required this.post, this.grid = false});

  final TripPost post;
  final bool grid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = postCounts(post, ref.watch(postOverlaysProvider.select((m) => m[post.id])));
    final author = post.author;
    return Semantics(
      button: true,
      label: '${post.title}, của ${author?.displayName ?? ''}',
      child: AppCard(
        padding: EdgeInsets.zero,
        onTap: () => context.push('/posts/${post.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: grid ? 4 / 3 : 16 / 10,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                  Positioned(left: 10, top: 10, child: AppBadge(tripLengthLabel(post.days.length), tone: BadgeTone.overlay)),
                  if (grid) Positioned(left: 10, bottom: 8, child: AppBadge(regionLabel(post.region), tone: BadgeTone.overlay)),
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.all(grid ? 12 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!grid && author != null) ...[
                    Row(
                      children: [
                        AppAvatar(url: author.avatarUrl, name: author.displayName, size: 28),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            author.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                          ),
                        ),
                        Text(' · ${relativeTime(post.createdAt)}', style: AppText.meta),
                      ],
                    ),
                    const SizedBox(height: 10),
                  ],
                  Text(post.title, maxLines: grid ? 2 : 3, overflow: TextOverflow.ellipsis, style: grid ? AppText.h3 : AppText.h2),
                  if (!grid && post.summary.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(post.summary, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.meta),
                  ],
                  if (!grid && post.tags.isNotEmpty) ...[const SizedBox(height: 10), TagList(tags: post.tags, max: 4)],
                  SizedBox(height: grid ? 8 : 12),
                  Wrap(
                    spacing: 14,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _Stat(
                        icon: const Icon(LucideIcons.wallet, size: 14, color: AppColors.cream),
                        text: grid ? formatVndShort(post.totalEstCost) : '${budgetLabel(post.budgetLevel)} · ${formatVndShort(post.totalEstCost)}',
                        strong: true,
                      ),
                      _Stat(
                        icon: Icon(counts.liked ? Icons.favorite : LucideIcons.heart, size: 14, color: counts.liked ? AppColors.social : AppColors.meta),
                        text: formatCount(counts.likeCount),
                      ),
                      if (!grid)
                        _Stat(
                          icon: const Icon(LucideIcons.messageCircle, size: 14, color: AppColors.meta),
                          text: formatCount(counts.commentCount),
                        ),
                      _Stat(
                        icon: Icon(counts.saved ? Icons.bookmark : LucideIcons.bookmark, size: 14, color: counts.saved ? AppColors.cream : AppColors.meta),
                        text: formatCount(counts.saveCount),
                      ),
                    ],
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

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.text, this.strong = false});

  final Widget icon;
  final String text;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(width: 5),
        Text(text, style: strong ? AppText.label.copyWith(fontSize: 13) : AppText.meta),
      ],
    );
  }
}

/// Same footprint as [TripCard], so lists do not jump when data lands.
class TripCardSkeleton extends StatelessWidget {
  const TripCardSkeleton({super.key, this.grid = false});

  final bool grid;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton(height: grid ? 120 : 200, radius: 0),
          Padding(
            padding: EdgeInsets.all(grid ? 12 : 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!grid) ...[const Skeleton(width: 160, height: 14), const SizedBox(height: 10)],
                const FractionallySizedBox(widthFactor: 0.85, child: Skeleton(height: 22)),
                const SizedBox(height: 10),
                if (!grid) ...[const Skeleton(height: 14), const SizedBox(height: 10)],
                const Skeleton(width: 180, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tags as chips; [linked] opens each tag's interest page.
class TagList extends StatelessWidget {
  const TagList({super.key, required this.tags, this.max, this.linked = false});

  final List<String> tags;
  final int? max;
  final bool linked;

  @override
  Widget build(BuildContext context) {
    if (tags.isEmpty) return const SizedBox.shrink();
    final shown = max != null ? tags.take(max!).toList() : tags;
    final rest = tags.length - shown.length;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final tag in shown) _TagChip(tag: tag, onTap: linked ? () => context.push('/discover/interest/${Uri.encodeComponent(tag)}') : null),
        if (rest > 0) Text('+$rest', style: AppText.meta),
      ],
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.tag, this.onTap});

  final String tag;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.well,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: AppColors.border),
      ),
      child: Text('#$tag', style: AppText.label.copyWith(fontSize: 12.5, color: AppColors.sage)),
    );
    if (onTap == null) return chip;
    return InkWell(borderRadius: BorderRadius.circular(AppRadius.pill), onTap: onTap, child: chip);
  }
}
