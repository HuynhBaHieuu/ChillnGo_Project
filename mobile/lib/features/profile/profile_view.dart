import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/server_posts.dart';
import '../../data/services/livestream_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/paged_list.dart';
import '../../ui/surfaces.dart';
import '../discover/discover_cards.dart';
import '../livestream/live_cards.dart';
import '../post/trip_card.dart';
import 'follow_button.dart';

const List<({String value, String label, int? count})> _tabs = [
  (value: 'posts', label: 'Bài viết', count: null),
  (value: 'saved', label: 'Đã lưu', count: null),
  (value: 'cloned', label: 'Lịch trình đã clone', count: null),
  (value: 'live', label: 'Livestream', count: null),
];

/// A member's profile (web: ProfilePage).
class ProfileView extends ConsumerStatefulWidget {
  const ProfileView({super.key, required this.userId, this.initialTab, this.header});

  final String userId;
  final String? initialTab;

  /// Something above the profile (the "Cá nhân" tab's shortcuts).
  final Widget? header;

  @override
  ConsumerState<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends ConsumerState<ProfileView> {
  late String _tab = _tabs.any((t) => t.value == widget.initialTab) ? widget.initialTab! : 'posts';
  final _liveKey = GlobalKey<PagedListState<Livestream>>();

  Future<void> _refresh() async {
    invalidateServerPosts();
    ref.invalidate(userProvider(widget.userId));
    ref.invalidate(postsByAuthorProvider(widget.userId));
    ref.invalidate(bookmarksProvider(widget.userId));
    ref.invalidate(myItinerariesProvider);
    ref.invalidate(liveByAuthorsProvider(widget.userId));
    await _liveKey.currentState?.reload();
    await ref.read(userProvider(widget.userId).future).catchError((_) => User(id: '', username: '', displayName: ''));
  }

  @override
  Widget build(BuildContext context) {
    final viewerId = ref.watch(viewerIdProvider);
    final isOwn = viewerId == widget.userId;
    final user = ref.watch(userProvider(widget.userId));
    final width = MediaQuery.sizeOf(context).width;

    if (user.isLoading && !user.hasValue) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Skeleton(height: width / 2.6, radius: 0),
          const Padding(
            padding: EdgeInsets.all(kGutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Skeleton(width: 72, height: 72, radius: 20),
                SizedBox(height: 12),
                Skeleton(width: 200, height: 28),
                SizedBox(height: 8),
                Skeleton(width: 120, height: 14),
              ],
            ),
          ),
        ],
      );
    }
    if (user.hasError && !user.hasValue) {
      return Padding(
        padding: const EdgeInsets.all(kGutter),
        child: Center(
          child: EmptyState(
            title: 'Không tìm thấy người dùng',
            description: user.error.toString(),
            action: AppButton(label: 'Về Khám phá', onPressed: () => context.go('/discover')),
          ),
        ),
      );
    }

    final profile = user.value!;
    final follow = ref.watch(followOverlaysProvider.select((m) => m[profile.id]));
    final followerCount = follow?.followerCount ?? profile.followerCount;

    return RefreshIndicator(
      onRefresh: _refresh,
      color: AppColors.primary,
      backgroundColor: AppColors.surface,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 48),
        children: [
          ?widget.header,
          SizedBox(
            height: (width / 2.4).roundToDouble(),
            child: NetImage(profile.coverUrl, placeholderColor: AppColors.canopy),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kGutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Transform.translate(
                  offset: const Offset(0, -30),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: AppColors.ground, width: 3),
                        ),
                        child: AppAvatar(url: profile.avatarUrl, name: profile.displayName, size: 76, square: true),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(profile.displayName, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.h1),
                              Text('@${profile.username}', style: AppText.meta),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Transform.translate(
                  offset: const Offset(0, -14),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (isOwn) ...[
                        AppButton(
                          label: 'Chỉnh sửa hồ sơ',
                          icon: LucideIcons.settings2,
                          variant: ButtonVariant.secondary,
                          size: ButtonSize.sm,
                          onPressed: () => context.push('/profile/edit'),
                        ),
                        AppButton(
                          label: 'Đăng bài mới',
                          icon: LucideIcons.squarePen,
                          variant: ButtonVariant.outline,
                          size: ButtonSize.sm,
                          onPressed: () => context.push('/posts/new'),
                        ),
                      ] else
                        FollowButton(userId: profile.id, size: ButtonSize.sm),
                      AppIconButton(
                        icon: LucideIcons.share2,
                        label: 'Chia sẻ trang cá nhân',
                        tone: IconTone.well,
                        size: 36,
                        onPressed: () => sharePath('/users/${profile.id}', profile.displayName),
                      ),
                    ],
                  ),
                ),
                if (profile.bio.isNotEmpty) ...[Text(profile.bio, style: AppText.body), const SizedBox(height: 10)],
                if (profile.location.isNotEmpty) ...[
                  Row(
                    children: [
                      const Icon(LucideIcons.mapPin, size: 14, color: AppColors.meta),
                      const SizedBox(width: 6),
                      Expanded(child: Text(profile.location, style: AppText.meta)),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _Stat(label: 'Bài viết', value: profile.postCount),
                      _Stat(label: 'Người theo dõi', value: followerCount),
                      _Stat(label: 'Đang theo dõi', value: profile.followingCount),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SegmentTabs<String>(items: _tabs, value: _tab, onChanged: (t) => setState(() => _tab = t)),
                const SizedBox(height: 16),
                switch (_tab) {
                  'saved' => _PostGrid(
                    provider: bookmarksProvider(profile.id),
                    emptyIcon: LucideIcons.bookmark,
                    emptyTitle: 'Chưa lưu hành trình nào',
                    emptyText: 'Bấm biểu tượng dấu trang trên một bài viết để lưu lại đọc sau.',
                  ),
                  'cloned' => _Cloned(isOwn: isOwn),
                  'live' => _LiveHistory(listKey: _liveKey, userId: profile.id, isOwn: isOwn),
                  _ => _PostGrid(
                    provider: postsByAuthorProvider(profile.id),
                    emptyIcon: LucideIcons.fileText,
                    emptyTitle: 'Chưa có bài viết nào',
                    emptyText: isOwn ? 'Hành trình đầu tiên của bạn sẽ xuất hiện ở đây.' : 'Người dùng này chưa chia sẻ hành trình nào.',
                  ),
                },
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(formatCount(value), style: AppText.h2),
        const SizedBox(height: 2),
        Text(label, style: AppText.meta),
      ],
    );
  }
}

class _PostGrid extends ConsumerWidget {
  const _PostGrid({required this.provider, required this.emptyIcon, required this.emptyTitle, required this.emptyText});

  final ProviderListenable<AsyncValue<List<TripPost>>> provider;
  final IconData emptyIcon;
  final String emptyTitle;
  final String emptyText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final posts = ref.watch(provider);
    if (posts.isLoading && !posts.hasValue) return const CardGrid(children: [TripCardSkeleton(grid: true), TripCardSkeleton(grid: true)]);
    if (posts.hasError && !posts.hasValue) return ErrorPanel(error: posts.error);
    final list = posts.value ?? const <TripPost>[];
    if (list.isEmpty) return EmptyState(icon: emptyIcon, title: emptyTitle, description: emptyText);
    return CardGrid(gap: 12, runGap: 12, children: [for (final post in list) TripCard(post: post, grid: true)]);
  }
}

class _Cloned extends ConsumerWidget {
  const _Cloned({required this.isOwn});

  final bool isOwn;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!isOwn) {
      return const EmptyState(icon: LucideIcons.copy, title: 'Lịch trình riêng tư', description: 'Chỉ chủ tài khoản mới xem được những lịch trình đã clone.');
    }
    final itineraries = ref.watch(myItinerariesProvider);
    if (itineraries.isLoading && !itineraries.hasValue) return const Skeleton(height: 140, radius: AppRadius.lg);
    if (itineraries.hasError && !itineraries.hasValue) return ErrorPanel(error: itineraries.error);
    final list = itineraries.value ?? const <ClonedItinerary>[];
    if (list.isEmpty) {
      return const EmptyState(icon: LucideIcons.copy, title: 'Chưa clone lịch trình nào', description: 'Khi bạn clone một hành trình, nó sẽ xuất hiện ở đây.');
    }
    return Column(
      children: [
        for (final itinerary in list) ...[
          AppCard(
            onTap: () => context.push('/itineraries/${itinerary.id}'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AppBadge(tripLengthLabel(itinerary.days.length), tone: BadgeTone.outline),
                    const Spacer(),
                    Text(formatShortDate(itinerary.startDate), style: AppText.meta),
                  ],
                ),
                const SizedBox(height: 8),
                Text(itinerary.title, style: AppText.h3),
                const SizedBox(height: 4),
                Text(itinerary.note, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.meta),
                const SizedBox(height: 8),
                Text(formatVnd(itinerary.totalEstCost), style: AppText.label),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

/// The "Livestream" tab of a profile: the stream live now, then past ones (web: LiveHistory).
class _LiveHistory extends ConsumerWidget {
  const _LiveHistory({required this.listKey, required this.userId, required this.isOwn});

  final GlobalKey<PagedListState<Livestream>> listKey;
  final String userId;
  final bool isOwn;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final live = ref.watch(liveByAuthorsProvider(userId)).value ?? const <Livestream>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final stream in live) ...[LivestreamCard(stream: stream), const SizedBox(height: 16)],
        PagedList<Livestream>(
          key: listKey,
          pageKey: userId,
          load: (before) => LivestreamService.listHistory(userId, before),
          itemBuilder: (_, stream) => ReplayCard(stream: stream),
          empty: live.isNotEmpty
              ? null
              : EmptyState(
                  icon: LucideIcons.radio,
                  title: 'Chưa có buổi phát nào',
                  description: isOwn
                      ? 'Bấm nút “+” rồi chọn Phát trực tiếp để livestream lần đầu. Các buổi phát sẽ được lưu ở đây.'
                      : 'Người dùng này chưa phát trực tiếp lần nào.',
                  action: isOwn ? AppButton(label: 'Phát trực tiếp', onPressed: () => context.push('/live/new')) : null,
                ),
        ),
      ],
    );
  }
}
