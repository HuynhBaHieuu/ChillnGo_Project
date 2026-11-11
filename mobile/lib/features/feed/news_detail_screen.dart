/// /news/:id: a travel news post on its own screen (web: NewsDetailPage):
/// headline, cover, the paragraphs the AI wrote from the original with the
/// original's pictures between them, and the link back to the source.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/labels.dart';
import '../../core/links.dart';
import '../../core/news_layout.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/news_service.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/navigation.dart';
import '../../ui/photo_viewer.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../report/report_sheet.dart';
import 'news_card.dart';

class NewsDetailScreen extends ConsumerStatefulWidget {
  const NewsDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<NewsDetailScreen> createState() => _NewsDetailScreenState();
}

class _NewsDetailScreenState extends ConsumerState<NewsDetailScreen> {
  NewsItem? _item;
  Object? _error;
  var _saving = false;

  @override
  void initState() {
    super.initState();
    _load(count: true);
  }

  Future<void> _load({bool count = false}) async {
    setState(() => _error = null);
    try {
      final item = await NewsService.get(widget.id);
      if (!mounted) return;
      setState(() => _item = item);
      // One count per visit to the screen.
      if (count) NewsService.recordClick(item.id);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _toggleSave(NewsItem item) async {
    setState(() => _saving = true);
    try {
      final now = await NewsService.toggleSave(item.id);
      ref.read(newsSavedOverrides.notifier).set(item.id, now);
      if (mounted) toast(context, now ? t('Đã lưu tin.') : t('Đã bỏ lưu tin.'));
    } catch (e) {
      if (mounted) toast(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;
    if (item == null) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome()),
        body: _error == null
            ? const LoadingView()
            : Padding(
                padding: const EdgeInsets.all(kGutter),
                child: Center(
                  child: EmptyState(
                    icon: LucideIcons.newspaper,
                    title: t('Không tìm thấy tin'),
                    description: errorMessage(_error!),
                    action: Wrap(
                      spacing: 8,
                      children: [
                        AppButton(label: t('Thử lại'), variant: ButtonVariant.outline, onPressed: () => _load(count: true)),
                        AppButton(label: t('Xem tin du lịch'), onPressed: () => context.go('/feed')),
                      ],
                    ),
                  ),
                ),
              ),
      );
    }

    final signedIn = ref.watch(sessionProvider.select((s) => s.user != null));
    final saved = ref.watch(newsSavedOverrides.select((m) => m[item.id])) ?? item.savedByMe;
    final layout = newsLayout(item.content, item.images);
    final origin = newsOrigin(item);
    final video = item.kind == 'video';
    final openLabel = video ? t('Xem trên YouTube') : t('Đọc bài gốc');
    void view(String url) => showPhotoViewer(context, item.images, item.images.indexOf(url));

    return Scaffold(
      appBar: AppBar(
        leading: const BackOrHome(),
        actions: [
          if (signedIn)
            AppIconButton(
              icon: LucideIcons.bookmark,
              label: saved ? t('Bỏ lưu tin này') : t('Lưu tin này'),
              loading: _saving,
              color: saved ? AppColors.teal : null,
              onPressed: _saving ? null : () => _toggleSave(item),
            ),
          AppIconButton(icon: LucideIcons.share2, label: t('Chia sẻ tin'), onPressed: () => sharePath('/news/${item.id}', item.title)),
          ReportButton(targetType: 'news', targetId: item.id, ownerId: 'news:${item.sourceId}', label: t('Thêm thao tác cho tin này')),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 40),
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
                      Text(t('Tin du lịch'), style: AppText.meta.copyWith(color: AppColors.teal, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                Text([origin, relativeTime(item.publishedAt), ...item.regions.map(regionLabel)].join(' · '), style: AppText.meta),
              ],
            ),
            const SizedBox(height: 14),
            Text(item.title, style: AppText.h1),
            if (item.summary.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(item.summary, style: AppText.body.copyWith(fontSize: 16, color: AppColors.meta)),
            ],
            if (layout.cover != null) ...[
              const SizedBox(height: 18),
              _Photo(
                url: layout.cover!,
                aspectRatio: 16 / 9,
                // A video opens in YouTube; a picture opens full screen.
                onTap: video ? () => openExternal(item.url) : () => view(layout.cover!),
                overlay: video ? const Icon(LucideIcons.circlePlay, size: 60, color: Color(0xE6FFFFFF)) : null,
                label: video ? openLabel : t('Xem ảnh'),
              ),
            ],
            for (final block in layout.blocks) ...[
              const SizedBox(height: 18),
              if (block.text != null)
                Text(block.text!, style: AppText.body.copyWith(fontSize: 16, height: 1.7))
              else
                _Photo(url: block.image!, aspectRatio: 3 / 2, onTap: () => view(block.image!), label: t('Xem ảnh')),
            ],
            if (layout.gallery.isNotEmpty) ...[
              const SizedBox(height: 28),
              Text(t('Thêm ảnh'), style: AppText.h3),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  for (final url in layout.gallery) _Photo(url: url, aspectRatio: 1, onTap: () => view(url), label: t('Xem ảnh')),
                ],
              ),
            ],
            if (item.destinations.isNotEmpty) ...[
              const SizedBox(height: 24),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final name in item.destinations)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        border: Border.all(color: AppColors.borderStrong),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.mapPin, size: 13, color: AppColors.teal),
                          const SizedBox(width: 5),
                          Text(name, style: AppText.bodySmall),
                        ],
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 28),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(color: AppColors.borderStrong),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(padding: EdgeInsets.only(top: 2), child: Icon(LucideIcons.sparkles, size: 15, color: AppColors.teal)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          item.content.isNotEmpty
                              ? t('Bài do AI của ChillnGo viết lại từ bài gốc của {source}. Ảnh thuộc về nguồn.', {'source': origin})
                              : t('Tin tổng hợp từ {source}. Mở bài gốc để đọc đầy đủ.', {'source': origin}),
                          style: AppText.meta,
                        ),
                      ),
                    ],
                  ),
                  if (item.originalTitle.isNotEmpty && item.originalTitle != item.title) ...[
                    const SizedBox(height: 10),
                    Text('${t('Tiêu đề gốc:')} ${item.originalTitle}', style: AppText.meta.copyWith(color: AppColors.body)),
                  ],
                  const SizedBox(height: 14),
                  AppButton(label: openLabel, icon: LucideIcons.externalLink, onPressed: () => openExternal(item.url)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A picture served by the source, rounded, opening on tap.
class _Photo extends StatelessWidget {
  const _Photo({required this.url, required this.aspectRatio, required this.onTap, required this.label, this.overlay});

  final String url;
  final double aspectRatio;
  final VoidCallback onTap;
  final String label;
  final Widget? overlay;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          child: AspectRatio(
            aspectRatio: aspectRatio,
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(url),
                if (overlay != null) Center(child: overlay),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
