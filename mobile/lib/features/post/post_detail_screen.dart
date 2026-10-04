import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import '../map/route_map.dart';
import 'clone_sheet.dart';
import 'comment_section.dart';
import 'day_itinerary.dart';
import 'post_actions.dart';
import 'trip_card.dart';
import '../../ui/navigation.dart';

/// /posts/:id: a journey (web: PostDetailPage).
class PostDetailScreen extends ConsumerStatefulWidget {
  const PostDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends ConsumerState<PostDetailScreen> {
  final _commentsKey = GlobalKey();

  void _scrollToComments() {
    final target = _commentsKey.currentContext;
    if (target != null) Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 400), curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(postProvider(widget.id));
    final viewerId = ref.watch(viewerIdProvider);

    if (async.isLoading && !async.hasValue) return const _PostSkeleton();
    if (async.hasError && !async.hasValue) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome()),
        body: Padding(
          padding: const EdgeInsets.all(kGutter),
          child: Center(
            child: EmptyState(
              title: 'Không tìm thấy hành trình',
              description: async.error.toString(),
              action: Wrap(
                spacing: 8,
                children: [
                  AppButton(label: 'Thử lại', variant: ButtonVariant.outline, onPressed: () => ref.invalidate(postProvider(widget.id))),
                  AppButton(label: 'Về Khám phá', onPressed: () => context.go('/discover')),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final post = async.value!;
    final author = post.author;
    final isAuthor = viewerId == post.authorId;
    final draft = post.status == 'draft';

    return Scaffold(
      appBar: AppBar(
        leading: const BackOrHome(),
        actions: [
          if (isAuthor) AppIconButton(icon: LucideIcons.pencil, label: 'Chỉnh sửa hành trình', onPressed: () => context.push('/posts/${post.id}/edit')),
          if (!draft) AppIconButton(icon: LucideIcons.share2, label: 'Chia sẻ hành trình', onPressed: () => sharePath('/posts/${post.id}', post.title)),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(postProvider(widget.id));
          ref.invalidate(commentsProvider(widget.id));
          await ref.read(postProvider(widget.id).future).catchError((_) => post);
        },
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PostGallery(coverUrl: post.coverUrl, images: post.coverImages ?? const []),
              Padding(
                padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (draft) ...[
                      const Align(alignment: Alignment.centerLeft, child: AppBadge('Bản nháp, chỉ bạn thấy', uppercase: true)),
                      const SizedBox(height: 12),
                    ],
                    Text('${regionLabel(post.region)} · ${seasonLabel(post.season)} · ${tripLengthLabel(post.days.length)}', style: AppText.meta),
                    const SizedBox(height: 8),
                    Text(post.title.isEmpty ? 'Hành trình chưa đặt tên' : post.title, style: AppText.h1),
                    if (post.summary.isNotEmpty) ...[const SizedBox(height: 10), Text(post.summary, style: AppText.body)],
                    const SizedBox(height: 14),
                    if (author != null)
                      InkWell(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        onTap: author.username == 'deleted' ? null : () => context.push('/users/${author.id}'),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              AppAvatar(url: author.avatarUrl, name: author.displayName, size: 44),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(author.displayName, style: AppText.label),
                                    Text('Đăng ${relativeTime(post.createdAt)}', style: AppText.meta),
                                  ],
                                ),
                              ),
                              if (isAuthor)
                                AppButton(
                                  label: 'Chỉnh sửa',
                                  icon: LucideIcons.pencil,
                                  variant: ButtonVariant.outline,
                                  size: ButtonSize.sm,
                                  onPressed: () => context.push('/posts/${post.id}/edit'),
                                ),
                            ],
                          ),
                        ),
                      ),
                    if (post.tags.isNotEmpty) ...[const SizedBox(height: 12), TagList(tags: post.tags, linked: true)],
                    const SizedBox(height: 24),
                    _Fact(icon: LucideIcons.calendarRange, label: 'Thời gian', value: formatDateRange(post.startDate, post.endDate)),
                    const SizedBox(height: 10),
                    _Fact(icon: LucideIcons.wallet, label: 'Tổng chi phí ước tính', value: formatVnd(post.totalEstCost)),
                    const SizedBox(height: 10),
                    _Fact(icon: LucideIcons.piggyBank, label: 'Mức chi tiêu', value: budgetLabel(post.budgetLevel)),
                    const SizedBox(height: 28),
                    Text('Lịch trình từng ngày', style: AppText.h2),
                    const SizedBox(height: 14),
                    if (post.days.isEmpty) Text('Hành trình này chưa có ngày nào.', style: AppText.meta),
                    for (final day in post.days) ...[DayItinerary(day: day), const SizedBox(height: 14)],
                    const SizedBox(height: 14),
                    Text('Bản đồ tuyến', style: AppText.h2),
                    const SizedBox(height: 14),
                    RouteMap(days: post.days, height: 300, label: 'Bản đồ tuyến đường của ${post.title}'),
                    const SizedBox(height: 10),
                    Text(
                      'Mỗi màu là một ngày, số là thứ tự điểm dừng trong ngày. Chọn một ngày hoặc một điểm để xem đường đi: đường bộ theo đường thật, nét đứt là máy bay hoặc tàu, phà. Chạm vào một chặng để xem phương tiện và thời gian.',
                      style: AppText.meta,
                    ),
                    const SizedBox(height: 28),
                    KeyedSubtree(
                      key: _commentsKey,
                      child: CommentSection(postId: post.id, commentCount: post.commentCount),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: draft ? null : _ActionBar(post: post, onComment: _scrollToComments),
    );
  }
}

/// Like, comment, save and clone, pinned to the bottom (web: PostActionBar).
class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.post, required this.onComment});

  final TripPost post;
  final VoidCallback onComment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = postCounts(post, ref.watch(postOverlaysProvider.select((m) => m[post.id])));
    return Container(
      padding: EdgeInsets.fromLTRB(10, 10, 10, MediaQuery.paddingOf(context).bottom.clamp(10, 40)),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: AppShadows.raised,
      ),
      child: Row(
        children: [
          _Counter(
            icon: counts.liked ? Icons.favorite : LucideIcons.heart,
            value: counts.likeCount,
            label: counts.liked ? 'Bỏ thích' : 'Thích',
            color: counts.liked ? AppColors.social : AppColors.meta,
            onTap: () => toggleLike(context, ref, post),
          ),
          _Counter(icon: LucideIcons.messageCircle, value: counts.commentCount, label: 'Bình luận', color: AppColors.meta, onTap: onComment),
          _Counter(
            icon: counts.saved ? Icons.bookmark : LucideIcons.bookmark,
            value: counts.saveCount,
            label: counts.saved ? 'Bỏ lưu' : 'Lưu bài viết',
            color: counts.saved ? AppColors.cream : AppColors.meta,
            onTap: () => toggleSave(context, ref, post),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: AppButton(
              label: 'Dùng làm lịch trình',
              icon: LucideIcons.copy,
              onPressed: () {
                if (requireSignIn(context, ref)) showCloneSheet(context, post);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter({required this.icon, required this.value, required this.label, required this.color, required this.onTap});

  final IconData icon;
  final int value;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$label, $value',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 9),
          child: Row(
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 5),
              Text(formatCount(value), style: AppText.label.copyWith(color: color)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: AppColors.meta),
              const SizedBox(width: 8),
              Text(label, style: AppText.meta),
            ],
          ),
          const SizedBox(height: 6),
          Text(value, style: AppText.label),
        ],
      ),
    );
  }
}

class _PostSkeleton extends StatelessWidget {
  const _PostSkeleton();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome()),
      body: ListView(
        children: const [
          Skeleton(height: 260, radius: 0),
          Padding(
            padding: EdgeInsets.all(kGutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Skeleton(width: 180, height: 12),
                SizedBox(height: 14),
                Skeleton(height: 30),
                SizedBox(height: 10),
                FractionallySizedBox(widthFactor: 0.7, child: Skeleton(height: 30)),
                SizedBox(height: 14),
                Skeleton(height: 14),
                SizedBox(height: 14),
                Skeleton(height: 80, radius: AppRadius.lg),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
