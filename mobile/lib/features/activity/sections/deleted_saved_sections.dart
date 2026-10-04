import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/itinerary.dart';
import '../../../core/photos.dart';
import '../../../core/theme.dart';
import '../../../data/api.dart';
import '../../../data/services/checkin_service.dart';
import '../../../data/services/post_service.dart';
import '../../../state/providers.dart';
import '../../../state/session.dart';
import '../../../ui/buttons.dart';
import '../../../ui/fields.dart';
import '../../../ui/sheets.dart';
import '../../../ui/surfaces.dart';
import '../../post/post_actions.dart';
import '../activity_common.dart';

class RecentlyDeletedSection extends StatefulWidget {
  const RecentlyDeletedSection({super.key, this.initialTab});

  final String? initialTab;

  @override
  State<RecentlyDeletedSection> createState() => _RecentlyDeletedSectionState();
}

class _RecentlyDeletedSectionState extends State<RecentlyDeletedSection> {
  static const _tabs = <({String value, String label, int? count})>[
    (value: 'posts', label: 'Bài viết', count: null),
    (value: 'stories', label: 'Tin', count: null),
    (value: 'videos', label: 'Video', count: null),
    (value: 'journeys', label: 'Hành trình', count: null),
  ];

  late String _tab = _tabs.any((t) => t.value == widget.initialTab) ? widget.initialTab! : 'posts';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionIntro(
          title: 'Đã xoá gần đây',
          description: 'Nội dung đã xoá được giữ ở đây 30 ngày. Bạn có thể khôi phục, hoặc xoá vĩnh viễn trước thời hạn đó.',
        ),
        const SizedBox(height: 16),
        SegmentTabs<String>(items: _tabs, value: _tab, onChanged: (t) => setState(() => _tab = t)),
        const SizedBox(height: 16),
        switch (_tab) {
          'stories' => const NotAvailable(
            icon: LucideIcons.clapperboard,
            feature: 'tính năng tin (story)',
            description: 'Khi có tính năng tin, những tin bạn xoá sẽ được giữ ở đây 30 ngày.',
          ),
          'videos' => const EmptyState(
            icon: LucideIcons.film,
            title: 'Chưa xoá được video',
            description: 'Bản ghi livestream được giữ cùng buổi phát. Khi có chức năng xoá, những video bạn xoá sẽ hiện ở đây.',
          ),
          'journeys' => const _DeletedJourneys(),
          _ => const _DeletedCheckIns(),
        },
      ],
    );
  }
}

class _DeletedItem {
  const _DeletedItem({required this.id, required this.title, required this.subtitle, this.image, required this.deletedAt, required this.purgeAt});

  final String id;
  final String title;
  final String subtitle;
  final String? image;
  final String deletedAt;
  final String purgeAt;
}

class _DeletedCheckIns extends ConsumerWidget {
  const _DeletedCheckIns();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checkins = ref.watch(deletedCheckInsProvider);
    if (checkins.isLoading && !checkins.hasValue) return const ListSkeleton();
    if (checkins.hasError && !checkins.hasValue) return ErrorPanel(error: checkins.error, onRetry: () => ref.invalidate(deletedCheckInsProvider));
    return _DeletedList(
      icon: LucideIcons.camera,
      noun: 'bài viết',
      emptyText: 'Những check-in bạn xoá sẽ được giữ ở đây 30 ngày.',
      items: [
        for (final c in checkins.value!)
          _DeletedItem(
            id: c.id,
            title: c.caption.isNotEmpty ? c.caption : (c.location?.name ?? 'Check-in'),
            subtitle: [if (c.photos.isNotEmpty) '${c.photos.length} ảnh', ?c.location?.name].join(' · ').ifEmpty('Check-in'),
            image: c.photos.isNotEmpty ? c.photos.first.url : null,
            deletedAt: c.deletedAt ?? c.createdAt,
            purgeAt: c.purgeAt ?? c.createdAt,
          ),
      ],
      restore: CheckInService.restore,
      purge: CheckInService.deletePermanently,
    );
  }
}

class _DeletedJourneys extends ConsumerWidget {
  const _DeletedJourneys();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final journeys = ref.watch(deletedJourneysProvider);
    if (journeys.isLoading && !journeys.hasValue) return const ListSkeleton();
    if (journeys.hasError && !journeys.hasValue) return ErrorPanel(error: journeys.error, onRetry: () => ref.invalidate(deletedJourneysProvider));
    return _DeletedList(
      icon: LucideIcons.map,
      noun: 'hành trình',
      emptyText: 'Những hành trình và bản nháp bạn xoá sẽ được giữ ở đây 30 ngày.',
      items: [
        for (final p in journeys.value!)
          _DeletedItem(
            id: p.id,
            title: p.title.trim().isEmpty ? 'Hành trình chưa đặt tên' : p.title.trim(),
            subtitle: '${p.status == 'draft' ? 'Bản nháp' : 'Đã đăng'} · ${journeyStats(p.days)}',
            image: p.coverUrl.isNotEmpty ? p.coverUrl : autoCover(p.title),
            deletedAt: p.deletedAt ?? p.updatedAt,
            purgeAt: p.purgeAt ?? p.updatedAt,
          ),
      ],
      restore: (id) async => PostService.restoreJourney(id),
      purge: PostService.deleteJourneyPermanently,
    );
  }
}

class _DeletedList extends ConsumerStatefulWidget {
  const _DeletedList({required this.icon, required this.noun, required this.emptyText, required this.items, required this.restore, required this.purge});

  final IconData icon;
  final String noun;
  final String emptyText;
  final List<_DeletedItem> items;
  final Future<void> Function(String id) restore;
  final Future<void> Function(String id) purge;

  @override
  ConsumerState<_DeletedList> createState() => _DeletedListState();
}

class _DeletedListState extends ConsumerState<_DeletedList> {
  String? _restoring;
  String? _error;

  Future<void> _restore(_DeletedItem item) async {
    setState(() {
      _restoring = item.id;
      _error = null;
    });
    try {
      await widget.restore(item.id);
      if (mounted) toast(context, 'Đã khôi phục.');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      // Also after an error: a restore past its window (410) deletes the item for good.
      if (mounted) {
        invalidateActivity(ref);
        setState(() => _restoring = null);
      }
    }
  }

  Future<void> _purge(_DeletedItem item) async {
    final done = await confirmAction(
      context,
      title: 'Xoá vĩnh viễn ${widget.noun} này?',
      description: '“${item.title}” sẽ bị xoá vĩnh viễn, kèm cả ảnh. Không thể hoàn tác.',
      confirmLabel: 'Xoá vĩnh viễn',
      destructive: true,
      onConfirm: () => widget.purge(item.id),
    );
    if (done) invalidateActivity(ref);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return EmptyState(icon: widget.icon, title: 'Không có gì trong mục này', description: widget.emptyText);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final item in widget.items)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ActivityRow(
                  children: [
                    ActivityThumb(url: item.image, size: 60),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.h3),
                          Text(item.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                          Builder(
                            builder: (_) {
                              final left = daysUntil(item.purgeAt);
                              return Text.rich(
                                TextSpan(
                                  style: AppText.meta,
                                  children: [
                                    TextSpan(text: 'Đã xoá ${timeAgo(item.deletedAt)} · '),
                                    TextSpan(
                                      text: left == 0 ? 'sẽ bị xoá hôm nay' : 'còn $left ngày',
                                      style: TextStyle(color: left <= 3 ? AppColors.social : AppColors.meta),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: AppButton(
                          label: 'Khôi phục',
                          icon: LucideIcons.rotateCcw,
                          variant: ButtonVariant.outline,
                          size: ButtonSize.sm,
                          loading: _restoring == item.id,
                          onPressed: () => _restore(item),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: AppButton(
                          label: 'Xoá vĩnh viễn',
                          icon: LucideIcons.trash,
                          variant: ButtonVariant.ghost,
                          size: ButtonSize.sm,
                          onPressed: () => _purge(item),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        if (_error != null) ErrorText(_error),
      ],
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

class SavedSection extends StatefulWidget {
  const SavedSection({super.key, this.initialTab});

  final String? initialTab;

  @override
  State<SavedSection> createState() => _SavedSectionState();
}

class _SavedSectionState extends State<SavedSection> {
  late String _tab = widget.initialTab == 'places' ? 'places' : 'journeys';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionIntro(title: 'Đã lưu', description: 'Những hành trình bạn đã lưu để xem lại. Chỉ mình bạn thấy được mục này.'),
        const SizedBox(height: 16),
        SegmentTabs<String>(
          items: const [(value: 'journeys', label: 'Hành trình', count: null), (value: 'places', label: 'Địa điểm', count: null)],
          value: _tab,
          onChanged: (t) => setState(() => _tab = t),
        ),
        const SizedBox(height: 16),
        if (_tab == 'journeys')
          const _SavedJourneys()
        else
          const NotAvailable(
            icon: LucideIcons.mapPin,
            feature: 'tính năng lưu địa điểm',
            description: 'Tính năng lưu từng địa điểm sắp có. Hiện tại, hãy lưu hành trình có địa điểm đó.',
          ),
      ],
    );
  }
}

class _SavedJourneys extends ConsumerWidget {
  const _SavedJourneys();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(viewerIdProvider) ?? '';
    final saved = ref.watch(bookmarksProvider(me));
    if (saved.isLoading && !saved.hasValue) return const ListSkeleton(rows: 4, media: true);
    if (saved.hasError && !saved.hasValue) return ErrorPanel(error: saved.error, onRetry: () => ref.invalidate(bookmarksProvider(me)));
    final list = saved.value!;
    if (list.isEmpty) {
      return EmptyState(
        icon: LucideIcons.bookmark,
        title: 'Chưa lưu gì',
        description: 'Bấm biểu tượng lưu ở một hành trình để giữ nó ở đây xem sau.',
        action: AppButton(label: 'Khám phá hành trình', variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: () => context.go('/discover')),
      );
    }
    return Column(
      children: [
        for (final post in list)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: AppCard(
              padding: EdgeInsets.zero,
              onTap: () => context.push('/posts/${post.id}'),
              child: Stack(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AspectRatio(
                        aspectRatio: 16 / 10,
                        child: NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(post.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.h3),
                            const SizedBox(height: 4),
                            Text(
                              'của ${post.author?.displayName ?? ''} · ${journeyStats(post.days)}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.meta,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Positioned(
                    right: 10,
                    top: 10,
                    child: AppIconButton(
                      icon: Icons.bookmark,
                      label: 'Bỏ lưu ${post.title}',
                      tone: IconTone.overlay,
                      onPressed: () async {
                        await toggleSave(context, ref, post);
                        ref.invalidate(bookmarksProvider(me));
                      },
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
