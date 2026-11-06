import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/itinerary.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../ui/buttons.dart';
import '../../../ui/surfaces.dart';
import '../../post/post_actions.dart';
import '../activity_common.dart';
import '../../../core/i18n.dart';

class InteractionsSection extends StatefulWidget {
  const InteractionsSection({super.key, this.initialTab});

  final String? initialTab;

  @override
  State<InteractionsSection> createState() => _InteractionsSectionState();
}

class _InteractionsSectionState extends State<InteractionsSection> {
  static List<({String value, String label, int? count})> get _tabs => <({String value, String label, int? count})>[
    (value: 'likes', label: t('Lượt thích'), count: null),
    (value: 'comments', label: t('Bình luận'), count: null),
    (value: 'reposts', label: t('Chia sẻ lại'), count: null),
    (value: 'story-replies', label: t('Phản hồi tin'), count: null),
    (value: 'reviews', label: t('Đánh giá'), count: null),
  ];

  late String _tab = _tabs.any((t) => t.value == widget.initialTab) ? widget.initialTab! : 'likes';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionIntro(title: t('Lượt tương tác'), description: t('Xem lại những hành trình bạn đã thích và các bình luận bạn đã để lại trên ChillnGo.')),
        const SizedBox(height: 16),
        SegmentTabs<String>(items: _tabs, value: _tab, onChanged: (t) => setState(() => _tab = t)),
        const SizedBox(height: 16),
        switch (_tab) {
          'comments' => const _Comments(),
          'reposts' => NotAvailable(
            icon: LucideIcons.repeat2,
            feature: t('tính năng chia sẻ lại'),
            description: t('Khi có tính năng này, những hành trình bạn chia sẻ lại cho người theo dõi sẽ hiện ở đây.'),
          ),
          'story-replies' => NotAvailable(
            icon: LucideIcons.messageSquareQuote,
            feature: t('tính năng tin (story)'),
            description: t('Khi có tính năng tin, các phản hồi và cảm xúc bạn gửi cho tin của người khác sẽ hiện ở đây.'),
          ),
          'reviews' => NotAvailable(
            icon: LucideIcons.star,
            feature: t('tính năng đánh giá'),
            description: t('Khi có tính năng đánh giá, những đánh giá bạn viết cho địa điểm và hành trình sẽ được gom lại ở đây.'),
          ),
          _ => const _Likes(),
        },
      ],
    );
  }
}

class _Likes extends ConsumerWidget {
  const _Likes();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final liked = ref.watch(likedJourneysProvider);
    if (liked.isLoading && !liked.hasValue) return const ListSkeleton();
    if (liked.hasError && !liked.hasValue) return ErrorPanel(error: liked.error, onRetry: () => ref.invalidate(likedJourneysProvider));
    final list = liked.value!;
    if (list.isEmpty) {
      return EmptyState(
        icon: LucideIcons.heart,
        title: t('Chưa có lượt thích nào'),
        description: t('Bấm vào trái tim ở hành trình bạn thích, hành trình đó sẽ hiện ở đây.'),
        action: AppButton(label: t('Khám phá hành trình'), variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: () => context.go('/discover')),
      );
    }
    return Column(
      children: [
        for (final post in list)
          ActivityRow(
            onTap: () => context.push('/posts/${post.id}'),
            children: [
              ActivityThumb(url: post.coverUrl, size: 60),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(post.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.h3),
                    Text(
                      t('của {value} · {value2}', {'value': post.author?.displayName ?? '', 'value2': journeyStats(post.days)}),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.meta,
                    ),
                  ],
                ),
              ),
              AppIconButton(
                icon: Icons.favorite,
                label: t('Bỏ thích {title}', {'title': post.title}),
                color: AppColors.social,
                onPressed: () async {
                  await toggleLike(context, ref, post);
                  ref.invalidate(likedJourneysProvider);
                },
              ),
            ],
          ),
      ],
    );
  }
}

/// Journey comments (demo data) and livestream comments (API), newest first.
class _Comments extends ConsumerWidget {
  const _Comments();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final journey = ref.watch(journeyCommentsProvider);
    final live = ref.watch(liveCommentsActivityProvider);
    if ((journey.isLoading && !journey.hasValue) || (live.isLoading && !live.hasValue)) return const ListSkeleton();
    if (live.hasError && !live.hasValue) return ErrorPanel(error: live.error, onRetry: () => ref.invalidate(liveCommentsActivityProvider));
    if (journey.hasError && !journey.hasValue) return ErrorPanel(error: journey.error, onRetry: () => ref.invalidate(journeyCommentsProvider));

    final items = [
      for (final c in journey.value ?? const <JourneyCommentActivity>[])
        (
          text: c.comment.content,
          at: c.comment.createdAt,
          href: c.postId == null ? null : '/posts/${c.postId}',
          where: c.postTitle ?? t('một hành trình đã bị xoá'),
          thumb: c.postCover,
          live: false,
        ),
      for (final c in live.value ?? const <LiveCommentActivity>[])
        (
          text: c.text,
          at: c.createdAt,
          href: c.livestreamId == null ? null : '/live/${c.livestreamId}',
          where: c.livestreamId == null
              ? t('một buổi live không còn tồn tại')
              : '${c.livestreamTitle ?? ''}${c.host != null ? t(' · live của {displayName}', {'displayName': c.host!.displayName}) : ''}',
          thumb: c.host?.avatarUrl,
          live: true,
        ),
    ]..sort((a, b) => b.at.compareTo(a.at));

    if (items.isEmpty) {
      return EmptyState(
        icon: LucideIcons.messageCircle,
        title: t('Chưa có bình luận nào'),
        description: t('Bình luận bạn viết trên hành trình và trong các buổi livestream sẽ được liệt kê ở đây.'),
      );
    }
    return Column(
      children: [
        for (final item in items)
          ActivityRow(
            onTap: item.href == null ? null : () => context.push(item.href!),
            children: [
              ActivityThumb(
                url: item.thumb,
                size: 48,
                round: true,
                child: item.live
                    ? Align(
                        alignment: Alignment.bottomCenter,
                        child: Container(
                          width: double.infinity,
                          color: AppColors.social,
                          alignment: Alignment.center,
                          child: const Text(
                            'LIVE',
                            style: TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 8, letterSpacing: 1, color: AppColors.onPrimary),
                          ),
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '“${item.text}”',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.bodySmall.copyWith(color: AppColors.cream),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (item.live) ...[const Icon(LucideIcons.radio, size: 13, color: AppColors.social), const SizedBox(width: 6)],
                        Expanded(
                          child: Text(t('Tại {where} · {time}', {'where': item.where, 'time': timeAgo(item.at)}), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
      ],
    );
  }
}
