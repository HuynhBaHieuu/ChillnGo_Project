import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/photos.dart';
import '../../../core/theme.dart';
import '../../../data/models.dart';
import '../../../data/services/checkin_service.dart';
import '../../../data/services/livestream_service.dart';
import '../../../data/services/post_service.dart';
import '../../../state/providers.dart';
import '../../../state/session.dart';
import '../../../ui/buttons.dart';
import '../../../ui/paged_list.dart';
import '../../../ui/sheets.dart';
import '../../../ui/surfaces.dart';
import '../activity_common.dart';

class MediaSection extends StatefulWidget {
  const MediaSection({super.key, this.initialTab});

  final String? initialTab;

  @override
  State<MediaSection> createState() => _MediaSectionState();
}

class _MediaSectionState extends State<MediaSection> {
  static const _tabs = <({String value, String label, int? count})>[
    (value: 'posts', label: 'Bài viết', count: null),
    (value: 'videos', label: 'Video', count: null),
    (value: 'stories', label: 'Tin', count: null),
    (value: 'live', label: 'Trực tiếp', count: null),
  ];

  late String _tab = _tabs.any((t) => t.value == widget.initialTab) ? widget.initialTab! : 'posts';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionIntro(
          title: 'Ảnh và video',
          description: 'Mọi thứ bạn đã chia sẻ: hành trình, check-in ảnh, bản ghi livestream và các buổi phát trực tiếp của bạn.',
        ),
        const SizedBox(height: 16),
        SegmentTabs<String>(items: _tabs, value: _tab, onChanged: (t) => setState(() => _tab = t)),
        const SizedBox(height: 16),
        switch (_tab) {
          'videos' => const _Videos(),
          'stories' => const NotAvailable(
            icon: LucideIcons.clapperboard,
            feature: 'tính năng tin (story)',
            description: 'Khi có tính năng tin, những tin bạn đăng sẽ được gom lại ở đây.',
          ),
          'live' => const _Live(),
          _ => const _Posts(),
        },
      ],
    );
  }
}

class _Tile {
  const _Tile({required this.journey, required this.id, required this.at, required this.image, required this.title});

  final bool journey;
  final String id;
  final String at;
  final String? image;
  final String title;
}

class _Posts extends ConsumerWidget {
  const _Posts();

  Future<void> _menu(BuildContext context, WidgetRef ref, _Tile tile) async {
    final choice = await showActionSheet<String>(
      context,
      title: tile.title,
      actions: [
        if (tile.journey) ...[const MenuAction('view', 'Xem', icon: LucideIcons.eye), const MenuAction('edit', 'Chỉnh sửa', icon: LucideIcons.pencil)],
        const MenuAction('delete', 'Xoá', icon: LucideIcons.trash, destructive: true),
      ],
    );
    if (!context.mounted || choice == null) return;
    if (choice == 'view') context.push('/posts/${tile.id}');
    if (choice == 'edit') context.push('/posts/${tile.id}/edit');
    if (choice == 'delete') {
      final done = await confirmAction(
        context,
        title: tile.journey ? 'Xoá hành trình này?' : 'Xoá check-in này?',
        description: 'Nội dung sẽ được chuyển vào mục Đã xoá gần đây, bạn có thể khôi phục trong 30 ngày.',
        confirmLabel: 'Xoá',
        destructive: true,
        onConfirm: () => tile.journey ? PostService.deleteJourney(tile.id) : CheckInService.delete(tile.id),
      );
      if (done) invalidateActivity(ref);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checkins = ref.watch(myCheckInsProvider);
    final journeys = ref.watch(myPublishedJourneysProvider);
    if ((checkins.isLoading && !checkins.hasValue) || (journeys.isLoading && !journeys.hasValue)) return const ListSkeleton(rows: 6, media: true);
    if (journeys.hasError && !journeys.hasValue) return ErrorPanel(error: journeys.error, onRetry: () => ref.invalidate(myPublishedJourneysProvider));
    if (checkins.hasError && !checkins.hasValue) return ErrorPanel(error: checkins.error, onRetry: () => ref.invalidate(myCheckInsProvider));

    final tiles = [
      for (final p in journeys.value!)
        _Tile(
          journey: true,
          id: p.id,
          at: p.createdAt,
          image: p.coverUrl.isNotEmpty ? p.coverUrl : autoCover(p.title),
          title: p.title.isEmpty ? 'Hành trình chưa đặt tên' : p.title,
        ),
      for (final c in checkins.value!)
        _Tile(
          journey: false,
          id: c.id,
          at: c.createdAt,
          image: c.photos.isNotEmpty ? c.photos.first.url : null,
          title: c.caption.isNotEmpty ? c.caption : (c.location?.name ?? 'Check-in'),
        ),
    ]..sort((a, b) => b.at.compareTo(a.at));

    if (tiles.isEmpty) {
      return EmptyState(
        icon: LucideIcons.camera,
        title: 'Bạn chưa chia sẻ gì',
        description: 'Hành trình bạn đăng và ảnh bạn check-in sẽ hiện ở đây.',
        action: AppButton(label: 'Check-in ngay', variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: () => context.push('/checkin/new')),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final tile in tiles)
              Semantics(
                button: true,
                label: tile.title,
                child: GestureDetector(
                  onTap: tile.journey ? () => context.push('/posts/${tile.id}') : null,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: SizedBox(
                      width: size,
                      height: size,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          tile.image != null
                              ? NetImage(tile.image)
                              : const ColoredBox(
                                  color: AppColors.well,
                                  child: Icon(LucideIcons.camera, size: 30, color: AppColors.sage),
                                ),
                          const ColoredBox(color: Color(0x47000000)),
                          Positioned(
                            left: 8,
                            top: 8,
                            child: AppBadge(
                              tile.journey ? 'Hành trình' : 'Check-in',
                              icon: tile.journey ? LucideIcons.map : LucideIcons.camera,
                              tone: BadgeTone.overlay,
                            ),
                          ),
                          Positioned(
                            right: 6,
                            top: 6,
                            child: AppIconButton(
                              icon: LucideIcons.ellipsis,
                              label: 'Thêm tuỳ chọn cho ${tile.title}',
                              tone: IconTone.overlay,
                              size: 32,
                              onPressed: () => _menu(context, ref, tile),
                            ),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              color: const Color(0xB8000000),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tile.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                                  ),
                                  Text(timeAgo(tile.at), style: AppText.meta.copyWith(fontSize: 11)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _StreamPoster extends StatelessWidget {
  const _StreamPoster({required this.stream});

  final Livestream stream;

  @override
  Widget build(BuildContext context) {
    final hasThumb = stream.thumbnailUrl.isNotEmpty;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(
          fit: StackFit.expand,
          children: [
            hasThumb
                ? NetImage(stream.thumbnailUrl, placeholderColor: AppColors.canopy)
                : ImageFiltered(
                    imageFilter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                    child: NetImage(stream.host.avatarUrl, placeholderColor: AppColors.canopy),
                  ),
            const ColoredBox(color: Color(0x47000000)),
          ],
        ),
      ),
    );
  }
}

class _Videos extends ConsumerWidget {
  const _Videos();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(viewerIdProvider) ?? '';
    return PagedList<Livestream>(
      pageKey: 'videos-$me',
      load: (before) async {
        final page = await LivestreamService.listHistory(me, before);
        return CursorPage(
          items: page.items.where((s) => s.recording.status == 'ready' || s.recording.status == 'processing').toList(),
          nextBefore: page.nextBefore,
        );
      },
      loading: const ListSkeleton(rows: 4, media: true),
      empty: const EmptyState(
        icon: LucideIcons.film,
        title: 'Chưa có video nào',
        description: 'Bật ghi hình khi phát trực tiếp, bản ghi sẽ được giữ lại ở đây.',
      ),
      gap: 14,
      itemBuilder: (context, stream) {
        final ready = stream.recording.status == 'ready';
        final length = stream.recording.durationSec > 0 ? stream.recording.durationSec : stream.durationSec;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => context.push('/live/${stream.id}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  _StreamPoster(stream: stream),
                  Positioned.fill(
                    child: Center(
                      child: Container(
                        width: 44,
                        height: 44,
                        padding: const EdgeInsets.only(left: 3),
                        decoration: const BoxDecoration(color: AppColors.social, shape: BoxShape.circle),
                        child: const Icon(Icons.play_arrow_rounded, size: 26, color: AppColors.onPrimary),
                      ),
                    ),
                  ),
                  Positioned(right: 6, bottom: 6, child: AppBadge(ready ? clockDuration(length) : 'Đang xử lý…', tone: BadgeTone.overlay)),
                ],
              ),
              const SizedBox(height: 6),
              Text(stream.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.h3),
              Text('${formatDateTime(stream.startedAt)} · ${formatNumber(stream.uniqueViewers)} người xem', style: AppText.meta),
            ],
          ),
        );
      },
    );
  }
}

const _recordingLabel = {
  'none': null,
  'recording': 'Đang ghi hình',
  'processing': 'Bản ghi đang xử lý',
  'ready': 'Có bản xem lại',
  'failed': 'Ghi hình thất bại',
};

class _Live extends ConsumerWidget {
  const _Live();

  Widget _row(BuildContext context, Livestream stream) {
    final isLive = stream.isLive;
    final recording = _recordingLabel[stream.recording.status];
    return ActivityRow(
      onTap: () => context.push('/live/${stream.id}'),
      children: [
        SizedBox(
          width: 120,
          child: Stack(
            children: [
              _StreamPoster(stream: stream),
              if (isLive)
                const Positioned(left: 6, top: 6, child: AppBadge('LIVE', tone: BadgeTone.live))
              else
                Positioned(right: 6, bottom: 6, child: AppBadge(clockDuration(stream.durationSec), tone: BadgeTone.overlay)),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(stream.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.h3),
              Text(isLive ? 'Đang phát · bắt đầu ${timeAgo(stream.startedAt)}' : formatDateTime(stream.startedAt), style: AppText.meta),
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(LucideIcons.eye, size: 13, color: AppColors.meta),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      'cao nhất ${formatNumber(stream.peakViewers)}${recording != null ? ' · $recording' : ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.meta,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(viewerIdProvider) ?? '';
    final live = ref.watch(liveByAuthorsProvider(me)).value ?? const <Livestream>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final stream in live) _row(context, stream),
        PagedList<Livestream>(
          pageKey: 'live-$me',
          load: (before) => LivestreamService.listHistory(me, before),
          loading: const ListSkeleton(),
          gap: 0,
          empty: live.isNotEmpty
              ? null
              : EmptyState(
                  icon: LucideIcons.radio,
                  title: 'Bạn chưa phát trực tiếp lần nào',
                  description: 'Bấm nút “+” rồi chọn Phát trực tiếp. Mọi buổi bạn phát sẽ được liệt kê ở đây.',
                  action: AppButton(label: 'Phát trực tiếp', variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: () => context.push('/live/new')),
                ),
          itemBuilder: _row,
        ),
      ],
    );
  }
}
