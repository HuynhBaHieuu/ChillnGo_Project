import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/livestream_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/paged_list.dart';
import '../../ui/surfaces.dart';
import '../shell/tab_header.dart';
import 'live_cards.dart';

/// /live: streams running now, then recorded ones to watch again (web: LiveNowPage).
///   "Đề xuất"        everyone you may watch
///   "Đang theo dõi"  only the people you follow (signed in)
class LiveTabScreen extends ConsumerStatefulWidget {
  const LiveTabScreen({super.key, this.initialTab});

  final String? initialTab;

  @override
  ConsumerState<LiveTabScreen> createState() => _LiveTabScreenState();
}

class _LiveTabScreenState extends ConsumerState<LiveTabScreen> {
  late String _tab = widget.initialTab == 'following' ? 'following' : 'all';
  final _replaysKey = GlobalKey<PagedListState<Livestream>>();

  @override
  void didUpdateWidget(LiveTabScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab && widget.initialTab != null) {
      setState(() => _tab = widget.initialTab == 'following' ? 'following' : 'all');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    final viewerId = user?.id;
    final tab = viewerId == null ? 'all' : _tab;

    final following = ref.watch(followingIdsProvider);
    final followingIds = following.value ?? const <String>[];
    final everyone = ref.watch(liveNowProvider);
    final followedLiveCount = (everyone.value ?? const <Livestream>[]).where((s) => followingIds.contains(s.host.id)).length;
    final followedKey = followingIds.join(',');
    final followed = tab == 'following' && following.hasValue && followingIds.isNotEmpty ? ref.watch(liveByAuthorsProvider(followedKey)) : null;
    final noFollows = tab == 'following' && following.hasValue && followingIds.isEmpty;

    final goLive = user == null
        ? null
        : AppButton(
            label: 'Phát trực tiếp',
            icon: LucideIcons.video,
            variant: ButtonVariant.social,
            size: ButtonSize.sm,
            onPressed: () => context.push('/live/new'),
          );

    final showAll = AppButton(label: 'Xem đề xuất', variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: () => setState(() => _tab = 'all'));

    return Scaffold(
      body: Column(
        children: [
          const TabHeader(title: 'Đang live'),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(liveNowProvider);
                ref.invalidate(liveByAuthorsProvider);
                ref.invalidate(followingIdsProvider);
                await _replaysKey.currentState?.reload();
              },
              color: AppColors.primary,
              backgroundColor: AppColors.surface,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 40),
                children: [
                  Text('Những chuyến đi đang được phát trực tiếp trên ChillnGo, và các buổi đã phát để xem lại.', style: AppText.meta),
                  if (goLive != null) ...[const SizedBox(height: 12), Align(alignment: Alignment.centerLeft, child: goLive)],
                  const SizedBox(height: 16),
                  SegmentTabs<String>(
                    items: [
                      (value: 'all', label: 'Đề xuất', count: everyone.value?.length ?? 0),
                      if (viewerId != null) (value: 'following', label: 'Đang theo dõi', count: followedLiveCount),
                    ],
                    value: tab,
                    onChanged: (t) => setState(() => _tab = t),
                  ),
                  const SizedBox(height: 20),
                  if (noFollows)
                    EmptyState(
                      icon: LucideIcons.users,
                      title: 'Bạn chưa theo dõi ai',
                      description: 'Theo dõi những người đi cùng gu để thấy ngay khi họ phát trực tiếp.',
                      action: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        alignment: WrapAlignment.center,
                        children: [
                          showAll,
                          AppButton(label: 'Khám phá', variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: () => context.go('/discover')),
                        ],
                      ),
                    )
                  else ...[
                    _LiveSection(
                      streams: tab == 'all' ? everyone.value : followed?.value,
                      pending: tab == 'all' ? everyone.isLoading && !everyone.hasValue : (followed == null || (followed.isLoading && !followed.hasValue)),
                      error: tab == 'all'
                          ? (everyone.hasValue ? null : everyone.error)
                          : (followed?.hasValue ?? false ? null : (following.error ?? followed?.error)),
                      empty: tab == 'all'
                          ? EmptyState(
                              icon: LucideIcons.radio,
                              title: 'Chưa có ai đang live',
                              description: 'Khi có người bắt đầu phát trực tiếp, buổi phát sẽ hiện ở đây. Trang tự cập nhật, bạn không cần tải lại.',
                              action: goLive,
                            )
                          : EmptyState(
                              icon: LucideIcons.radio,
                              title: 'Chưa có ai bạn theo dõi đang live',
                              description: 'Bạn sẽ nhận thông báo khi họ bắt đầu phát. Trong lúc chờ, xem những buổi đang phát khác nhé.',
                              action: showAll,
                            ),
                    ),
                    const SizedBox(height: 40),
                    Row(
                      children: [
                        const Icon(LucideIcons.film, size: 20, color: AppColors.cream),
                        const SizedBox(width: 8),
                        Text('Xem lại', style: AppText.h2),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (tab == 'all' || following.hasValue)
                      PagedList<Livestream>(
                        key: _replaysKey,
                        pageKey: tab == 'all' ? 'everyone' : 'following:$followedKey',
                        load: (before) => LivestreamService.listReplays(authors: tab == 'all' ? null : followingIds, before: before),
                        itemBuilder: (_, stream) => ReplayCard(stream: stream, showHost: true),
                        empty: const EmptyState(
                          icon: LucideIcons.film,
                          title: 'Chưa có buổi nào để xem lại',
                          description: 'Buổi phát có bật "Lưu lại buổi phát" sẽ xuất hiện ở đây sau khi kết thúc.',
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

class _LiveSection extends StatelessWidget {
  const _LiveSection({required this.streams, required this.pending, required this.error, required this.empty});

  final List<Livestream>? streams;
  final bool pending;
  final Object? error;
  final Widget empty;

  @override
  Widget build(BuildContext context) {
    final list = streams ?? const <Livestream>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Icon(LucideIcons.radio, size: 20, color: AppColors.social),
            const SizedBox(width: 8),
            Text('Đang phát', style: AppText.h2),
          ],
        ),
        const SizedBox(height: 16),
        if (error != null)
          EmptyState(title: 'Không tải được danh sách livestream', description: error.toString(), compact: true)
        else if (pending)
          for (var i = 0; i < 2; i++) ...[const Skeleton(height: 320, radius: AppRadius.xl), const SizedBox(height: 16)]
        else if (list.isEmpty)
          empty
        else
          for (var i = 0; i < list.length; i++) ...[LivestreamCard(stream: list[i], preview: i == 0), const SizedBox(height: 16)],
      ],
    );
  }
}
