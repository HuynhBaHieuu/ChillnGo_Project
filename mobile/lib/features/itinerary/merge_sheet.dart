import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/itinerary.dart';
import '../../core/text.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/itinerary_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';

/// A selected day, keyed by its post too: duplicated journeys share day ids.
String _keyOf(String postId, String dayId) => '$postId::$dayId';

/// Pick days from other posts to append to an itinerary (web: MergeModal).
Future<void> showMergeSheet(BuildContext context, ClonedItinerary itinerary) {
  return showAppSheet<void>(
    context,
    title: 'Ghép ngày từ bài viết khác',
    description: 'Chọn những ngày bạn muốn thêm. Ngày được ghép sẽ nối vào cuối và đánh số lại.',
    tall: true,
    builder: (_) => _MergeForm(itinerary: itinerary, parentContext: context),
  );
}

class _MergeForm extends ConsumerStatefulWidget {
  const _MergeForm({required this.itinerary, required this.parentContext});

  final ClonedItinerary itinerary;
  final BuildContext parentContext;

  @override
  ConsumerState<_MergeForm> createState() => _MergeFormState();
}

class _MergeFormState extends ConsumerState<_MergeForm> {
  final _query = TextEditingController();
  final Set<String> _selected = {};
  String? _expanded;
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _merge(List<TripPost> posts) async {
    final selections = [
      for (final post in posts)
        if (post.days.where((d) => _selected.contains(_keyOf(post.id, d.id))).map((d) => d.id).toList() case final ids when ids.isNotEmpty)
          (postId: post.id, dayIds: ids),
    ];
    if (selections.isEmpty) return;
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await ItineraryService.mergeInto(widget.itinerary.id, selections);
      ref.invalidate(itineraryProvider(widget.itinerary.id));
      ref.invalidate(myItinerariesProvider);
      if (!mounted) return;
      final count = _selected.length;
      Navigator.of(context).pop();
      if (widget.parentContext.mounted) toast(widget.parentContext, 'Đã ghép $count ngày vào lịch trình.');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(publishedPostsProvider);
    final posts = async.value ?? const <TripPost>[];
    final q = foldText(_query.text.trim());
    final filtered = q.isEmpty ? posts : posts.where((p) => foldText(p.title).contains(q) || p.tags.any((t) => foldText(t).contains(q))).toList();
    final selectedCost = posts.fold<int>(
      0,
      (sum, post) => sum + post.days.where((d) => _selected.contains(_keyOf(post.id, d.id))).fold<int>(0, (s, d) => s + dayCostOf(d)),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          controller: _query,
          label: 'Tìm hành trình theo tên hoặc thẻ',
          icon: LucideIcons.search,
          autocorrect: false,
          onChanged: (_) => setState(() {}),
        ),
        if (_selected.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text.rich(
            TextSpan(
              style: AppText.meta,
              children: [
                TextSpan(text: 'Đã chọn ${_selected.length} ngày · thêm khoảng '),
                TextSpan(
                  text: formatVnd(selectedCost),
                  style: const TextStyle(color: AppColors.cream),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        if (async.isLoading && !async.hasValue)
          for (var i = 0; i < 3; i++) ...[const Skeleton(height: 64), const SizedBox(height: 8)],
        if (async.hasError && !async.hasValue) ErrorPanel(error: async.error, onRetry: () => ref.invalidate(publishedPostsProvider)),
        if (async.hasValue && filtered.isEmpty) Text('Không tìm thấy hành trình nào khớp.', style: AppText.meta, textAlign: TextAlign.center),
        for (final post in filtered) ...[_postTile(post), const SizedBox(height: 8)],
        if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: AppButton(label: 'Huỷ', variant: ButtonVariant.outline, onPressed: _pending ? null : () => Navigator.of(context).pop()),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AppButton(
                label: _selected.isNotEmpty ? 'Ghép ${_selected.length} ngày' : 'Ghép',
                icon: LucideIcons.gitMerge,
                loading: _pending,
                onPressed: _selected.isEmpty ? null : () => _merge(posts),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _postTile(TripPost post) {
    final open = _expanded == post.id;
    final count = post.days.where((d) => _selected.contains(_keyOf(post.id, d.id))).length;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = open ? null : post.id),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  NetImage(post.coverUrl, width: 44, height: 44, radius: 10),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          post.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                        ),
                        Text(
                          '${post.days.length} ngày · ${post.author?.displayName ?? ''}${widget.itinerary.sourcePostIds.contains(post.id) ? ' · đã ghép trước đó' : ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.meta,
                        ),
                      ],
                    ),
                  ),
                  if (count > 0)
                    Container(
                      constraints: const BoxConstraints(minWidth: 22),
                      height: 22,
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(11)),
                      child: Text('$count', style: AppText.meta.copyWith(color: AppColors.onPrimary)),
                    ),
                  const SizedBox(width: 6),
                  AnimatedRotation(
                    turns: open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 150),
                    child: const Icon(LucideIcons.chevronDown, size: 18, color: AppColors.meta),
                  ),
                ],
              ),
            ),
          ),
          if (open)
            for (final day in post.days)
              InkWell(
                onTap: () => setState(() {
                  final key = _keyOf(post.id, day.id);
                  if (!_selected.remove(key)) _selected.add(key);
                }),
                child: Container(
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          color: _selected.contains(_keyOf(post.id, day.id)) ? AppColors.primary : Colors.transparent,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: _selected.contains(_keyOf(post.id, day.id)) ? AppColors.primary : AppColors.meta, width: 2),
                        ),
                        child: _selected.contains(_keyOf(post.id, day.id)) ? const Icon(LucideIcons.check, size: 13, color: AppColors.onPrimary) : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Ngày ${day.dayNumber}: ${day.title.isEmpty ? 'Chưa đặt tên' : day.title}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.bodySmall,
                            ),
                            Text('${day.locations.length} điểm dừng', style: AppText.meta),
                          ],
                        ),
                      ),
                      Text(formatVnd(dayCostOf(day)), style: AppText.meta),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
