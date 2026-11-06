import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../data/api.dart';
import '../../../data/models.dart';
import '../../../data/services/activity_service.dart';
import '../../../ui/buttons.dart';
import '../../../ui/sheets.dart';
import '../../../ui/surfaces.dart';
import '../activity_common.dart';
import '../../../core/i18n.dart';

Map<String, (String, IconData)> get _searchTypes => {
  'journey': (t('Hành trình'), LucideIcons.map),
  'place': (t('Địa điểm'), LucideIcons.mapPin),
  'post': (t('Bài viết'), LucideIcons.fileText),
  'user': (t('Người dùng'), LucideIcons.user),
};

class SearchHistorySection extends ConsumerStatefulWidget {
  const SearchHistorySection({super.key});

  @override
  ConsumerState<SearchHistorySection> createState() => _SearchHistorySectionState();
}

class _SearchHistorySectionState extends ConsumerState<SearchHistorySection> {
  String? _removing;

  Future<void> _remove(SearchEntry entry) async {
    setState(() => _removing = entry.id);
    try {
      await ActivityService.removeSearch(entry.id);
      ref.invalidate(searchHistoryProvider);
    } catch (error) {
      if (mounted) toast(context, errorMessage(error), error: true);
    } finally {
      if (mounted) setState(() => _removing = null);
    }
  }

  Future<void> _clear() async {
    final done = await confirmAction(
      context,
      title: t('Xoá toàn bộ lịch sử tìm kiếm?'),
      description: t('Mọi lượt tìm kiếm trong lịch sử sẽ bị xoá. Không thể hoàn tác.'),
      confirmLabel: t('Xoá tất cả'),
      destructive: true,
      onConfirm: ActivityService.clearSearchHistory,
    );
    if (done) ref.invalidate(searchHistoryProvider);
  }

  @override
  Widget build(BuildContext context) {
    final history = ref.watch(searchHistoryProvider);
    final list = history.value ?? const <SearchEntry>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionIntro(
          title: t('Lịch sử tìm kiếm'),
          description: t('Những lần bạn tìm kiếm ở trang Khám phá và khi chọn địa điểm check-in. Chỉ mình bạn thấy được.'),
          action: list.isNotEmpty ? AppButton(label: t('Xoá tất cả'), variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: _clear) : null,
        ),
        const SizedBox(height: 16),
        if (history.isLoading && !history.hasValue)
          const ListSkeleton(rows: 5)
        else if (history.hasError && !history.hasValue)
          ErrorPanel(error: history.error, onRetry: () => ref.invalidate(searchHistoryProvider))
        else if (list.isEmpty)
          EmptyState(
            icon: LucideIcons.search,
            title: t('Chưa có lượt tìm kiếm nào'),
            description: t('Tìm hành trình ở trang Khám phá, các lượt tìm của bạn sẽ được liệt kê ở đây.'),
          )
        else
          for (final entry in list)
            ActivityRow(
              // Journey searches reopen Discover; the other kinds have no search page.
              onTap: entry.type == 'journey' ? () => context.go('/discover?q=${Uri.encodeQueryComponent(entry.query)}') : null,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(color: AppColors.well, shape: BoxShape.circle),
                  child: Icon((_searchTypes[entry.type] ?? _searchTypes['journey']!).$2, size: 18, color: AppColors.sage),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(entry.query, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.label),
                      Text('${(_searchTypes[entry.type] ?? _searchTypes['journey']!).$1} · ${timeAgo(entry.searchedAt)}', style: AppText.meta),
                    ],
                  ),
                ),
                AppIconButton(
                  icon: LucideIcons.x,
                  label: t('Xoá “{query}” khỏi lịch sử tìm kiếm', {'query': entry.query}),
                  loading: _removing == entry.id,
                  onPressed: () => _remove(entry),
                ),
              ],
            ),
      ],
    );
  }
}

Map<String, (String, IconData)> get _events => {
  'account_created': (t('Tạo tài khoản'), LucideIcons.sparkles),
  'email_verified': (t('Xác minh địa chỉ email'), LucideIcons.badgeCheck),
  'password_reset': (t('Đặt lại mật khẩu'), LucideIcons.keyRound),
  'avatar_changed': (t('Đổi ảnh đại diện'), LucideIcons.image),
  'avatar_removed': (t('Gỡ ảnh đại diện'), LucideIcons.imageOff),
  'cover_changed': (t('Đổi ảnh bìa'), LucideIcons.image),
  'cover_removed': (t('Gỡ ảnh bìa'), LucideIcons.imageOff),
  'username_changed': (t('Đổi tên người dùng'), LucideIcons.atSign),
  'display_name_changed': (t('Đổi tên hiển thị'), LucideIcons.userPen),
  'bio_changed': (t('Đổi phần giới thiệu'), LucideIcons.fileText),
  'location_changed': (t('Đổi nơi sống'), LucideIcons.mapPin),
};

String? _detail(AccountEvent event) {
  final from = event.details['from'];
  final to = event.details['to'];
  final via = event.details['via'];
  if (event.type == 'username_changed' && from != null && to != null) return '@$from → @$to';
  if ((event.type == 'display_name_changed' || event.type == 'location_changed') && to != null) return from != null ? '$from → $to' : to;
  if (via == 'google') return event.type == 'account_created' ? t('Đăng ký bằng Google') : t('Xác nhận qua Google');
  if (via == 'email' && event.type == 'account_created') return t('Đăng ký bằng email');
  return null;
}

class AccountHistorySection extends ConsumerWidget {
  const AccountHistorySection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(accountHistoryProvider);
    final list = history.value ?? const <AccountEvent>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionIntro(title: t('Lịch sử tài khoản'), description: t('Những thay đổi bạn đã thực hiện trên tài khoản. Chỉ hiện các sự kiện đã được ghi lại.')),
        const SizedBox(height: 16),
        if (history.isLoading && !history.hasValue)
          const ListSkeleton()
        else if (history.hasError && !history.hasValue)
          ErrorPanel(error: history.error, onRetry: () => ref.invalidate(accountHistoryProvider))
        else if (list.isEmpty)
          EmptyState(
            icon: LucideIcons.rotateCcwClock,
            title: t('Chưa có lịch sử tài khoản'),
            description: t('Các thay đổi trên hồ sơ của bạn sẽ được ghi lại ở đây.'),
          )
        else
          for (var i = 0; i < list.length; i++)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Column(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Icon((_events[list[i].type] ?? ('', LucideIcons.sparkles)).$2, size: 18, color: AppColors.sage),
                      ),
                      if (i < list.length - 1)
                        Expanded(
                          child: Container(width: 1, constraints: const BoxConstraints(minHeight: 16), color: AppColors.border),
                        ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2, bottom: 18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_events[list[i].type]?.$1 ?? list[i].type, style: AppText.label),
                          if (_detail(list[i]) case final extra?) Text(extra, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.bodySmall),
                          Text('${formatDateTime(list[i].createdAt)} · ${timeAgo(list[i].createdAt)}', style: AppText.meta),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}
