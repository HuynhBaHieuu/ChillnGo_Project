import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/itinerary.dart';
import '../../../core/photos.dart';
import '../../../core/theme.dart';
import '../../../data/api.dart';
import '../../../data/models.dart';
import '../../../data/services/post_service.dart';
import '../../../ui/buttons.dart';
import '../../../ui/fields.dart';
import '../../../ui/sheets.dart';
import '../../../ui/surfaces.dart';
import '../activity_common.dart';
import '../../../core/i18n.dart';

class JourneysSection extends ConsumerWidget {
  const JourneysSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drafts = ref.watch(draftJourneysProvider);
    final count = drafts.value?.length ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionIntro(
          title: t('Hành trình'),
          description:
              t('Những hành trình bạn đã bắt đầu lên kế hoạch nhưng chưa đăng. Chúng được lưu vào tài khoản, nên bạn có thể làm tiếp trên bất kỳ thiết bị nào.'),
          action: AppButton(label: t('Hành trình mới'), icon: LucideIcons.plus, size: ButtonSize.sm, onPressed: () => context.push('/posts/new')),
        ),
        const SizedBox(height: 16),
        Text(t('HÀNH TRÌNH NHÁP{value}', {'value': count > 0 ? ' · $count' : ''}), style: AppText.caps),
        const SizedBox(height: 12),
        if (drafts.isLoading && !drafts.hasValue)
          for (var i = 0; i < 2; i++) ...[const Skeleton(height: 240, radius: AppRadius.lg), const SizedBox(height: 14)]
        else if (drafts.hasError && !drafts.hasValue)
          ErrorPanel(error: drafts.error, onRetry: () => ref.invalidate(draftJourneysProvider))
        else if (count == 0)
          EmptyState(
            icon: LucideIcons.map,
            title: t('Chưa có hành trình nháp'),
            description: t('Bắt đầu lên kế hoạch cho một chuyến đi và bấm “Lưu nháp” trong trình soạn. Bản nháp sẽ chờ bạn ở đây.'),
            action: AppButton(
              label: t('Bắt đầu một hành trình'),
              variant: ButtonVariant.outline,
              size: ButtonSize.sm,
              onPressed: () => context.push('/posts/new'),
            ),
          )
        else
          for (final draft in drafts.value!) ...[_DraftCard(draft: draft), const SizedBox(height: 14)],
      ],
    );
  }
}

class _DraftCard extends ConsumerStatefulWidget {
  const _DraftCard({required this.draft});

  final TripPost draft;

  @override
  ConsumerState<_DraftCard> createState() => _DraftCardState();
}

class _DraftCardState extends ConsumerState<_DraftCard> {
  bool _busy = false;
  String? _error;

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      invalidateActivity(ref);
      if (mounted) toast(context, done);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _publish() async {
    final draft = widget.draft;
    final incomplete = draft.title.trim().isEmpty || draft.summary.trim().isEmpty;
    if (incomplete) {
      final edit = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(t('Đăng hành trình này?')),
          content: Text(t('Hãy thêm tiêu đề và tóm tắt trước. Bấm Tiếp tục chỉnh sửa để hoàn thiện.')),
          actions: [
            AppButton(label: t('Huỷ'), variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(false)),
            AppButton(label: t('Chỉnh sửa'), size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(true)),
          ],
        ),
      );
      if (edit == true && mounted) context.push('/posts/${draft.id}/edit');
      return;
    }
    final done = await confirmAction(
      context,
      title: t('Đăng hành trình này?'),
      description: t('Hành trình sẽ hiện trên trang cá nhân của bạn, trong Newsfeed của người theo dõi và ở trang Khám phá.'),
      confirmLabel: t('Đăng'),
      onConfirm: () => PostService.publishJourney(draft.id),
    );
    if (done && mounted) {
      invalidateActivity(ref);
      toast(context, t('Đã đăng hành trình.'));
    }
  }

  Future<void> _delete() async {
    final done = await confirmAction(
      context,
      title: t('Xoá bản nháp này?'),
      description: t('Bản nháp sẽ được chuyển vào mục Đã xoá gần đây, bạn có thể khôi phục trong 30 ngày.'),
      confirmLabel: t('Xoá bản nháp'),
      destructive: true,
      onConfirm: () => PostService.deleteJourney(widget.draft.id),
    );
    if (done && mounted) invalidateActivity(ref);
  }

  @override
  Widget build(BuildContext context) {
    final draft = widget.draft;
    final title = draft.title.trim().isEmpty ? t('Hành trình chưa đặt tên') : draft.title.trim();
    final route = journeyRoute(draft.days);
    final cover = draft.coverUrl.isNotEmpty ? draft.coverUrl : autoCover(draft.title);
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(cover, placeholderColor: AppColors.canopy),
                Positioned(left: 12, top: 12, child: AppBadge(t('Nháp'), tone: BadgeTone.overlay, uppercase: true)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (route != null)
                  Text(
                    route,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.sage),
                  ),
                Text(title, style: AppText.h3),
                const SizedBox(height: 4),
                Text(journeyStats(draft.days), style: AppText.meta),
                Text(t('Sửa lần cuối {time}', {'time': timeAgo(draft.updatedAt)}), style: AppText.meta),
                if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
                const SizedBox(height: 12),
                AppButton(label: t('Tiếp tục chỉnh sửa'), icon: LucideIcons.squarePen, onPressed: () => context.push('/posts/${draft.id}/edit')),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: [
                    AppButton(
                      label: t('Xem trước'),
                      icon: LucideIcons.eye,
                      variant: ButtonVariant.ghost,
                      size: ButtonSize.sm,
                      onPressed: _busy ? null : () => context.push('/posts/${draft.id}'),
                    ),
                    AppButton(label: t('Đăng'), icon: LucideIcons.send, variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: _busy ? null : _publish),
                    AppButton(
                      label: t('Nhân bản'),
                      icon: LucideIcons.copy,
                      variant: ButtonVariant.ghost,
                      size: ButtonSize.sm,
                      loading: _busy,
                      onPressed: () => _run(() => PostService.duplicateJourney(draft.id), t('Đã tạo bản sao nháp.')),
                    ),
                    AppButton(label: t('Xoá'), icon: LucideIcons.trash, variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: _busy ? null : _delete),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
