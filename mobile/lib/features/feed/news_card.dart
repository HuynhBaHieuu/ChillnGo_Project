/// A travel news post in the Newsfeed (web/src/features/news/NewsCard.tsx),
/// shaped like a journey card: cover, headline, summary. It opens the post's
/// own screen (/news/:id); the original article is linked from there.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/labels.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/news_service.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../report/report_sheet.dart';

/// Saved state changed on this device, by news id: cards show it at once.
final newsSavedOverrides = NotifierProvider<NewsSavedOverrides, Map<String, bool>>(NewsSavedOverrides.new);

class NewsSavedOverrides extends Notifier<Map<String, bool>> {
  @override
  Map<String, bool> build() => const {};

  void set(String id, bool saved) => state = {...state, id: saved};
}

class NewsCard extends ConsumerStatefulWidget {
  const NewsCard({super.key, required this.item, this.compact = false, this.onSavedChanged});

  final NewsItem item;
  final bool compact;
  final ValueChanged<bool>? onSavedChanged;

  @override
  ConsumerState<NewsCard> createState() => _NewsCardState();
}

class _NewsCardState extends ConsumerState<NewsCard> {
  var _saving = false;

  NewsItem get item => widget.item;

  void _open() => context.push('/news/${item.id}');

  Future<void> _toggleSave(bool saved) async {
    setState(() => _saving = true);
    try {
      final now = await NewsService.toggleSave(item.id);
      ref.read(newsSavedOverrides.notifier).set(item.id, now);
      widget.onSavedChanged?.call(now);
      if (mounted) toast(context, now ? t('Đã lưu tin.') : t('Đã bỏ lưu tin.'));
    } catch (e) {
      if (mounted) toast(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(sessionProvider.select((s) => s.user != null));
    final saved = ref.watch(newsSavedOverrides.select((m) => m[item.id])) ?? item.savedByMe;
    final chip = BoxDecoration(
      borderRadius: BorderRadius.circular(AppRadius.pill),
      border: Border.all(color: AppColors.borderStrong),
    );

    return AppCard(
      padding: EdgeInsets.zero,
      onTap: _open,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (item.imageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
              child: AspectRatio(
                aspectRatio: widget.compact ? 16 / 8 : 16 / 10,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    NetImage(item.imageUrl),
                    if (item.kind == 'video') const Center(child: Icon(LucideIcons.circlePlay, size: 52, color: Color(0xE6FFFFFF))),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.teal.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(AppRadius.pill)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.newspaper, size: 13, color: AppColors.teal),
                          const SizedBox(width: 4),
                          Text(
                            t('Tin du lịch'),
                            style: AppText.meta.copyWith(color: AppColors.teal, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    if (item.pinned)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.pin, size: 13, color: AppColors.cream),
                          const SizedBox(width: 3),
                          Text(t('Đã ghim'), style: AppText.meta.copyWith(color: AppColors.cream)),
                        ],
                      ),
                    Text('${newsOrigin(item)} · ${relativeTime(item.publishedAt)}', style: AppText.meta),
                  ],
                ),
                const SizedBox(height: 8),
                Text(item.title, maxLines: 3, overflow: TextOverflow.ellipsis, style: widget.compact ? AppText.h3 : AppText.h2),
                if (item.summary.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    item.summary,
                    maxLines: widget.compact ? 2 : 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body.copyWith(color: AppColors.meta),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 8, 10),
            child: Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final r in item.regions)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                          decoration: chip,
                          child: Text(regionLabel(r), style: AppText.meta),
                        ),
                      for (final d in item.destinations.take(2))
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                          decoration: chip,
                          child: Text('📍 $d', style: AppText.meta),
                        ),
                    ],
                  ),
                ),
                if (signedIn)
                  AppIconButton(
                    icon: LucideIcons.bookmark,
                    label: saved ? t('Bỏ lưu tin này') : t('Lưu tin này'),
                    size: 36,
                    loading: _saving,
                    color: saved ? AppColors.teal : AppColors.meta,
                    onPressed: _saving ? null : () => _toggleSave(saved),
                  ),
                ReportButton(targetType: 'news', targetId: item.id, ownerId: 'news:${item.sourceId}', label: t('Thêm thao tác cho tin này')),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
