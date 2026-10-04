import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/feelings.dart';
import '../../core/format.dart';
import '../../core/geo.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/checkin_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/photo_viewer.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';

/// A photo check-in in the Newsfeed (web/src/features/checkin/CheckInCard.tsx).
class CheckInCard extends ConsumerWidget {
  const CheckInCard({super.key, required this.checkin, required this.viewerId, this.onDeleted});

  final CheckIn checkin;
  final String? viewerId;
  final VoidCallback? onDeleted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final author = checkin.author;
    final feeling = feelingOption(checkin.feeling);
    final location = checkin.location;
    final isMine = viewerId == author.id;
    void openAuthor() => context.push('/users/${author.id}');

    final bold = AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream);
    final quiet = AppText.bodySmall.copyWith(color: AppColors.meta);

    return AppCard(
      accent: AppColors.moss,
      padding: const EdgeInsets.fromLTRB(18, 16, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: openAuthor,
                child: AppAvatar(url: author.avatarUrl, name: author.displayName, size: 44),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: author.displayName, style: bold, recognizer: TapGestureRecognizer()..onTap = openAuthor),
                          if (feeling != null) ...[
                            TextSpan(text: ' ${feeling.lead} ', style: quiet),
                            TextSpan(text: '${feeling.emoji} ${feeling.what}', style: bold),
                          ],
                          if (location != null) ...[
                            TextSpan(text: feeling != null ? ' tại ' : ' đã check-in tại ', style: quiet),
                            TextSpan(text: '📍 ${location.name}', style: bold),
                          ],
                          if (feeling == null && location == null) TextSpan(text: checkin.photos.isNotEmpty ? ' đã chia sẻ ảnh' : ' đã chia sẻ', style: quiet),
                        ],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(relativeTime(checkin.createdAt), style: AppText.meta),
                  ],
                ),
              ),
              if (isMine) AppIconButton(icon: LucideIcons.trash, label: 'Xoá check-in', size: 36, onPressed: () => _confirmDelete(context, ref)),
            ],
          ),
          if (checkin.caption.isNotEmpty) ...[const SizedBox(height: 12), Text(checkin.caption, style: AppText.body)],
          if (checkin.photos.isNotEmpty) ...[
            const SizedBox(height: 12),
            CheckInPhotoGrid(photos: checkin.photos, onOpen: (i) => showPhotoViewer(context, checkin.photos.map((p) => p.url).toList(), i)),
          ],
          if (location != null) ...[const SizedBox(height: 12), _LocationStrip(location: location)],
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final done = await confirmAction(
      context,
      title: 'Xoá check-in',
      description: 'Check-in sẽ được chuyển vào mục Đã xoá gần đây (Hoạt động của bạn) và có thể khôi phục trong 30 ngày.',
      confirmLabel: 'Xoá',
      destructive: true,
      onConfirm: () => CheckInService.delete(checkin.id),
    );
    if (!done || !context.mounted) return;
    toast(context, 'Đã chuyển check-in vào mục Đã xoá gần đây.');
    ref.invalidate(checkinsProvider);
    onDeleted?.call();
  }
}

/// 1 photo: one wide frame. 2: side by side. 3: one tall plus two stacked. 4: a 2×2 grid.
class CheckInPhotoGrid extends StatelessWidget {
  const CheckInPhotoGrid({super.key, required this.photos, required this.onOpen});

  final List<CheckInPhoto> photos;
  final ValueChanged<int> onOpen;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final inner = constraints.maxWidth;
        const gap = 4.0;
        Widget tile(int index, double width, double height) => SizedBox(
          width: width,
          height: height,
          child: Semantics(
            button: true,
            label: 'Xem ảnh ${index + 1} cỡ lớn',
            child: GestureDetector(
              onTap: () => onOpen(index),
              child: NetImage(photos[index].url, placeholderColor: AppColors.canopy),
            ),
          ),
        );

        Widget content;
        final count = photos.length;
        if (count == 1) {
          final p = photos.first;
          final ratio = p.width > 0 && p.height > 0 ? p.width / p.height : 16 / 10;
          final height = (inner / (ratio < 0.6 ? 0.6 : ratio)).clamp(0.0, inner * 1.25);
          content = tile(0, inner, height);
        } else {
          final height = (inner * 0.8).clamp(0.0, 320.0);
          final half = (inner - gap) / 2;
          if (count == 2) {
            content = Row(
              children: [
                tile(0, half, height),
                const SizedBox(width: gap),
                tile(1, half, height),
              ],
            );
          } else if (count == 3) {
            content = Row(
              children: [
                tile(0, half, height),
                const SizedBox(width: gap),
                Column(
                  children: [
                    tile(1, half, (height - gap) / 2),
                    const SizedBox(height: gap),
                    tile(2, half, (height - gap) / 2),
                  ],
                ),
              ],
            );
          } else {
            content = Wrap(spacing: gap, runSpacing: gap, children: [for (var i = 0; i < 4 && i < count; i++) tile(i, half, (height - gap) / 2)]);
          }
        }
        return ClipRRect(borderRadius: BorderRadius.circular(AppRadius.md), child: content);
      },
    );
  }
}

class _LocationStrip extends StatelessWidget {
  const _LocationStrip({required this.location});

  final Place location;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width - kGutter * 2;
    final map = staticMapUrl(location.lat, location.lng, width.round(), 140);
    return Semantics(
      button: true,
      label: 'Chỉ đường tới ${location.name}',
      child: Material(
        color: AppColors.well,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: const BorderSide(color: Color(0x99000000)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => openExternal(googleMapsUrl(location.lat, location.lng)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (map != null) SizedBox(height: 110, child: NetImage(map)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    const Icon(LucideIcons.mapPin, size: 16, color: AppColors.ochre),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            location.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                          ),
                          if (location.address.isNotEmpty) Text(location.address, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text('Chỉ đường', style: AppText.meta),
                    const SizedBox(width: 4),
                    const Icon(LucideIcons.externalLink, size: 14, color: AppColors.meta),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
