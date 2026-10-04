import 'dart:ui';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import 'live_badges.dart';
import 'live_format.dart';
import 'live_preview.dart';

/// A blurred photo behind a poster.
class _BlurredBackdrop extends StatelessWidget {
  const _BlurredBackdrop({required this.url, this.scrim = const Color(0x80000000)});

  final String url;
  final Color scrim;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: NetImage(url, placeholderColor: AppColors.canopy),
        ),
        ColoredBox(color: scrim),
      ],
    );
  }
}

/// A stream live right now (web: LivestreamCard). [preview]: play the muted
/// moving picture while the card is shown.
class LivestreamCard extends StatelessWidget {
  const LivestreamCard({super.key, required this.stream, this.preview = false});

  final Livestream stream;
  final bool preview;

  @override
  Widget build(BuildContext context) {
    void open() => context.push('/live/${stream.id}');
    void openHost() => context.push('/users/${stream.host.id}');
    final startedAt = parseDate(stream.startedAt) ?? DateTime.now();

    return AppCard(
      surface: Surface.live,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: openHost,
                child: AppAvatar(url: stream.host.avatarUrl, name: stream.host.displayName, size: 44, ring: true),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: stream.host.displayName,
                            style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                            recognizer: TapGestureRecognizer()..onTap = openHost,
                          ),
                          TextSpan(
                            text: ' đang phát trực tiếp',
                            style: AppText.bodySmall.copyWith(color: AppColors.meta),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const LiveBadge(social: true),
                        Text('Bắt đầu ${relativeTime(stream.startedAt)}', style: AppText.meta),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('“${stream.title}”', style: AppText.h2),
          if (stream.description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(stream.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.meta),
          ],
          const SizedBox(height: 12),
          Semantics(
            button: true,
            label: 'Xem livestream ${stream.title}',
            child: GestureDetector(
              onTap: open,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.md),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _BlurredBackdrop(url: stream.host.avatarUrl),
                      if (preview) LivePreview(streamId: stream.id, hostId: stream.host.id),
                      Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: const BoxDecoration(color: AppColors.social, shape: BoxShape.circle),
                            child: const Icon(LucideIcons.radio, size: 28, color: AppColors.onPrimary),
                          ),
                          const SizedBox(height: 10),
                          Text('Đang phát trực tiếp · chạm để xem', style: AppText.label.copyWith(shadows: const [Shadow(blurRadius: 6)])),
                        ],
                      ),
                      Positioned(
                        left: 10,
                        top: 10,
                        child: Row(
                          children: [
                            LiveClock(baseSec: 0, baseAt: startedAt, social: true),
                            const SizedBox(width: 8),
                            ViewerCount(count: stream.viewerCount),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              AppIconButton(icon: LucideIcons.messageCircle, label: 'Bình luận trong livestream', onPressed: open),
              AppIconButton(icon: LucideIcons.share2, label: 'Chia sẻ livestream', onPressed: () => sharePath('/live/${stream.id}', stream.title)),
              const Spacer(),
              AppButton(label: 'Xem livestream', size: ButtonSize.sm, onPressed: open),
            ],
          ),
        ],
      ),
    );
  }
}

const _audienceLabel = {'public': null, 'followers': 'Người theo dõi', 'private': 'Chỉ mình tôi'};

/// A stream that is over: when it ran, its numbers, and a way into the replay
/// (or the summary, when it was not recorded). [showHost] for mixed lists.
class ReplayCard extends StatelessWidget {
  const ReplayCard({super.key, required this.stream, this.showHost = false});

  final Livestream stream;
  final bool showHost;

  @override
  Widget build(BuildContext context) {
    final replay = stream.recording.status == 'ready';
    final processing = stream.recording.status == 'processing' || stream.recording.status == 'recording';
    final audience = _audienceLabel[stream.audience];
    final length = stream.recording.durationSec > 0 ? stream.recording.durationSec : stream.durationSec;

    return Semantics(
      button: true,
      label: '${replay ? 'Xem lại' : 'Xem tổng kết'}: ${stream.title}',
      child: AppCard(
        surface: Surface.featured,
        onTap: () => context.push('/live/${stream.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showHost) ...[
              Row(
                children: [
                  GestureDetector(
                    onTap: () => context.push('/users/${stream.host.id}'),
                    child: AppAvatar(url: stream.host.avatarUrl, name: stream.host.displayName, size: 40),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: stream.host.displayName,
                                style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                              ),
                              TextSpan(
                                text: ' đã phát trực tiếp',
                                style: AppText.bodySmall.copyWith(color: AppColors.meta),
                              ),
                            ],
                          ),
                        ),
                        Text(relativeTime(stream.endedAt ?? stream.startedAt), style: AppText.meta),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (stream.thumbnailUrl.isNotEmpty) ...[
                      NetImage(stream.thumbnailUrl, placeholderColor: AppColors.canopy),
                      const ColoredBox(color: Color(0x59000000)),
                    ] else
                      _BlurredBackdrop(url: stream.host.avatarUrl, scrim: const Color(0x59000000)),
                    Center(
                      child: replay
                          ? Container(
                              width: 50,
                              height: 50,
                              padding: const EdgeInsets.only(left: 3),
                              decoration: const BoxDecoration(color: AppColors.social, shape: BoxShape.circle),
                              child: const Icon(Icons.play_arrow_rounded, size: 30, color: AppColors.onPrimary),
                            )
                          : const Icon(LucideIcons.film, size: 28, color: AppColors.cream),
                    ),
                    Positioned(right: 8, bottom: 8, child: AppBadge(liveDuration(length), tone: BadgeTone.overlay)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (replay) const AppBadge('Xem lại', tone: BadgeTone.social, icon: LucideIcons.play, uppercase: true),
                Text(formatStart(stream.startedAt), style: AppText.meta),
                if (audience != null) AppBadge(audience),
                if (processing) const AppBadge('Bản ghi đang xử lý'),
              ],
            ),
            const SizedBox(height: 8),
            Text(stream.title, style: AppText.h3),
            const SizedBox(height: 10),
            LiveStats(stream: stream, compactView: true),
          ],
        ),
      ),
    );
  }
}

/// Everyone live right now, at the top of the Newsfeed. Hidden when nobody is live.
class LiveNowStrip extends ConsumerWidget {
  const LiveNowStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final streams = ref.watch(liveNowProvider).value ?? const [];
    if (streams.isEmpty) return const SizedBox.shrink();
    return AppCard(
      surface: Surface.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 9,
                height: 9,
                decoration: const BoxDecoration(color: AppColors.social, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Text('ĐANG LIVE · ${streams.length}', style: AppText.caps.copyWith(color: AppColors.cream, fontSize: 12)),
              const Spacer(),
              TextLink(label: 'Xem tất cả', color: AppColors.meta, onPressed: () => context.go('/live')),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: streams.length,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (context, index) {
                final stream = streams[index];
                return Semantics(
                  button: true,
                  label: '${stream.host.displayName} đang phát: ${stream.title}',
                  child: GestureDetector(
                    onTap: () => context.push('/live/${stream.id}'),
                    child: SizedBox(
                      width: 72,
                      child: Column(
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            alignment: Alignment.bottomCenter,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(color: AppColors.social, shape: BoxShape.circle),
                                child: AppAvatar(url: stream.host.avatarUrl, name: stream.host.displayName, size: 56),
                              ),
                              Positioned(
                                bottom: -6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(color: AppColors.social, borderRadius: BorderRadius.circular(4)),
                                  child: const Text(
                                    'LIVE',
                                    style: TextStyle(
                                      fontFamily: AppFonts.body,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 9,
                                      letterSpacing: 1,
                                      color: AppColors.onPrimary,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            stream.host.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: AppText.meta.copyWith(color: AppColors.body),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
