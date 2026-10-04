import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/server_posts.dart';
import '../../data/services/livestream_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import '../checkin/checkin_card.dart';
import '../livestream/live_cards.dart';
import '../post/trip_card.dart';
import '../shell/tab_header.dart';

/// Recorded streams that are over, for the Newsfeed (comma-joined authors, '' for everyone).
final _feedReplaysProvider = FutureProvider.family<CursorPage<Livestream>, String>((ref, authorsKey) {
  return LivestreamService.listReplays(authors: authorsKey.isEmpty ? null : authorsKey.split(','));
});

sealed class _FeedItem {
  const _FeedItem(this.at);

  final String at;
}

class _PostItem extends _FeedItem {
  _PostItem(this.post) : super(post.createdAt);

  final TripPost post;
}

class _CheckInItem extends _FeedItem {
  _CheckInItem(this.checkin) : super(checkin.createdAt);

  final CheckIn checkin;
}

class _ReplayItem extends _FeedItem {
  _ReplayItem(this.stream) : super(stream.endedAt ?? stream.startedAt);

  final Livestream stream;
}

/// Newsfeed: journeys, photo check-ins and recorded livestreams, newest first.
/// Signed in: yours and the people you follow. Signed out: everyone's.
class FeedScreen extends ConsumerWidget {
  const FeedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    final viewerId = user?.id;
    final following = ref.watch(followingIdsProvider);
    final ready = viewerId == null || following.hasValue || following.hasError;
    final authorsKey = viewerId == null ? '' : [viewerId, ...(following.value ?? const <String>[])].join(',');

    final posts = ref.watch(feedProvider);
    final checkins = ready ? ref.watch(checkinsProvider(authorsKey)) : const AsyncLoading<List<CheckIn>>();
    final live = ready ? ref.watch(liveByAuthorsProvider(authorsKey)) : const AsyncLoading<List<Livestream>>();
    final replays = ready ? ref.watch(_feedReplaysProvider(authorsKey)) : const AsyncLoading<CursorPage<Livestream>>();

    final items = <_FeedItem>[
      ...(posts.value ?? const <TripPost>[]).map(_PostItem.new),
      // A check-in or replay list that fails to load (API down) must not hide the journeys.
      ...(checkins.value ?? const <CheckIn>[]).map(_CheckInItem.new),
      ...(replays.value?.items ?? const <Livestream>[]).map(_ReplayItem.new),
    ]..sort((a, b) => b.at.compareTo(a.at));
    final liveNow = live.value ?? const <Livestream>[];

    Future<void> refresh() async {
      invalidateServerPosts();
      ref.invalidate(followingIdsProvider);
      ref.invalidate(feedProvider);
      ref.invalidate(checkinsProvider);
      ref.invalidate(liveByAuthorsProvider);
      ref.invalidate(_feedReplaysProvider);
      ref.invalidate(liveNowProvider);
      await ref.read(feedProvider.future).catchError((_) => <TripPost>[]);
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
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 0),
                    sliver: SliverList.list(
                      children: [
                        // The web's page header: title, description, "Khám phá thêm".
                        const SizedBox(height: 10),
                        Text('Newsfeed', style: AppText.hero),
                        const SizedBox(height: 8),
                        Text(
                          user != null
                              ? 'Hành trình và check-in mới nhất từ bạn và những người bạn đang theo dõi.'
                              : 'Những hành trình và check-in mới nhất trên ChillnGo. Đăng nhập để chỉ xem người bạn theo dõi.',
                          style: AppText.meta,
                        ),
                        const SizedBox(height: 14),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: AppButton(label: 'Khám phá thêm', icon: LucideIcons.compass, onPressed: () => context.go('/discover')),
                        ),
                        const SizedBox(height: 22),
                        if (user != null) ...[PostComposer(user: user), const SizedBox(height: 16)],
                        const LiveNowStrip(),
                        if ((ref.watch(liveNowProvider).value ?? const []).isNotEmpty) const SizedBox(height: 16),
                        for (var i = 0; i < liveNow.length; i++) ...[LivestreamCard(stream: liveNow[i], preview: i == 0), const SizedBox(height: 16)],
                        if (posts.isLoading && !posts.hasValue) ...[const TripCardSkeleton(), const SizedBox(height: 16), const TripCardSkeleton()],
                        if (posts.hasError && !posts.hasValue) ErrorPanel(error: posts.error, onRetry: () => ref.invalidate(feedProvider)),
                        if (posts.hasValue && items.isEmpty && liveNow.isEmpty)
                          EmptyState(
                            icon: LucideIcons.users,
                            title: 'Newsfeed đang trống',
                            description: 'Bạn chưa theo dõi ai, hoặc những người bạn theo dõi chưa đăng gì. Hãy check-in chuyến đi của bạn, hoặc tìm vài người đi cùng gu ở trang Khám phá.',
                            action: AppButton(label: 'Khám phá hành trình', onPressed: () => context.go('/discover')),
                          ),
                      ],
                    ),
                  ),
                  if (posts.hasValue)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 32),
                      sliver: SliverList.separated(
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 16),
                        itemBuilder: (context, index) => switch (items[index]) {
                          _PostItem(:final post) => TripCard(post: post),
                          _CheckInItem(:final checkin) => CheckInCard(checkin: checkin, viewerId: viewerId),
                          _ReplayItem(:final stream) => ReplayCard(stream: stream, showHost: true),
                        },
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

/// The bar at the top of the Newsfeed (web: PostComposer):
///   prompt      → the journey editor
///   photos      → a check-in, starting with the photo picker
///   livestream  → camera check, then a broadcast
class PostComposer extends StatelessWidget {
  const PostComposer({super.key, required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    Widget round(IconData icon, Color tint, String label, VoidCallback onTap) => Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: tint.withValues(alpha: 0.12),
        shape: CircleBorder(side: BorderSide(color: tint.withValues(alpha: 0.27))),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 44, height: 44, child: Icon(icon, size: 20, color: tint)),
        ),
      ),
    );

    return AppCard(
      surface: Surface.surface,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.push('/users/${user.id}'),
            child: AppAvatar(url: user.avatarUrl, name: user.displayName, size: 44),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Semantics(
              button: true,
              label: 'Đăng hành trình mới',
              child: Material(
                color: AppColors.well,
                shape: const StadiumBorder(side: BorderSide(color: Color(0x99000000))),
                child: InkWell(
                  customBorder: const StadiumBorder(),
                  onTap: () => context.push('/posts/new'),
                  child: Container(
                    height: 44,
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Text('Bạn vừa đi đâu?', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          round(LucideIcons.imagePlus, AppColors.teal, 'Check-in: ảnh, cảm xúc và địa điểm', () => context.push('/checkin/new?start=photos')),
          const SizedBox(width: 8),
          round(LucideIcons.video, AppColors.social, 'Phát trực tiếp', () => context.push('/live/new')),
        ],
      ),
    );
  }
}
