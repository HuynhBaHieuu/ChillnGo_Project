import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/itinerary.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/json.dart';
import '../../data/models.dart';
import '../../data/services/itinerary_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../ai_clone/ai_draft_screen.dart';
import '../map/route_map.dart';
import 'itineraries_screen.dart';
import 'merge_sheet.dart';
import '../../ui/navigation.dart';
import '../../core/i18n.dart';

/// /itineraries/:id: a cloned itinerary (web: ItineraryDetailPage).
class ItineraryDetailScreen extends ConsumerStatefulWidget {
  const ItineraryDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<ItineraryDetailScreen> createState() => _ItineraryDetailScreenState();
}

class _ItineraryDetailScreenState extends ConsumerState<ItineraryDetailScreen> {
  /// Local copy of the day order so moves feel instant; re-synced from every server answer.
  List<TripDay>? _days;
  ClonedItinerary? _syncedFrom;
  bool _saving = false;

  Future<void> _move(ClonedItinerary itinerary, int from, int to) async {
    final days = _days;
    if (days == null || to < 0 || to >= days.length) return;
    // Re-number and re-date right away, as the server will.
    final next = moveItem(days, from, to);
    for (var i = 0; i < next.length; i++) {
      next[i]
        ..dayNumber = i + 1
        ..date = addDays(itinerary.startDate, i);
    }
    setState(() {
      _days = next;
      _saving = true;
    });
    try {
      await ItineraryService.reorderDays(itinerary.id, next.map((d) => d.id).toList());
      ref.invalidate(myItinerariesProvider);
    } catch (error) {
      if (mounted) toast(context, errorMessage(error), error: true);
      ref.invalidate(itineraryProvider(widget.id));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove(ClonedItinerary itinerary, TripDay day) async {
    final done = await confirmAction(
      context,
      title: t('Xoá ngày này?'),
      description: t('“{value}” sẽ bị bỏ khỏi lịch trình. Các ngày sau sẽ được đánh số lại.', {'value': day.title.isEmpty ? t('Chưa đặt tên') : day.title}),
      confirmLabel: t('Xoá ngày'),
      destructive: true,
      onConfirm: () => ItineraryService.removeDay(itinerary.id, day.id),
    );
    if (done) {
      ref.invalidate(itineraryProvider(widget.id));
      ref.invalidate(myItinerariesProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(itineraryProvider(widget.id));
    final itinerary = async.value;
    if (itinerary != null && !identical(itinerary, _syncedFrom)) {
      _syncedFrom = itinerary;
      _days = itinerary.days.map((d) => d.copy()).toList();
    }

    if (async.isLoading && itinerary == null) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome()),
        body: ListView(
          padding: const EdgeInsets.all(kGutter),
          children: [
            const FractionallySizedBox(widthFactor: 0.8, alignment: Alignment.centerLeft, child: Skeleton(height: 34)),
            for (var i = 0; i < 3; i++) ...[const SizedBox(height: 14), const Skeleton(height: 120, radius: AppRadius.lg)],
          ],
        ),
      );
    }
    if (itinerary == null) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome()),
        body: Padding(
          padding: const EdgeInsets.all(kGutter),
          child: Center(
            child: EmptyState(
              title: t('Không tìm thấy lịch trình'),
              description: async.hasError ? errorMessage(async.error) : t('Lịch trình này có thể đã bị xoá.'),
              action: AppButton(label: t('Về danh sách'), variant: ButtonVariant.outline, onPressed: () => context.pushReplacement('/itineraries?tab=cloned')),
            ),
          ),
        ),
      );
    }

    final days = _days ?? itinerary.days;
    final total = totalCostOf(days);
    final stops = days.fold(0, (n, d) => n + d.locations.length);

    Widget row(String label, String value) => Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppText.meta)),
          Text(value, style: AppText.bodySmall.copyWith(color: AppColors.cream)),
        ],
      ),
    );

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome()),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 40),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              AppBadge(itineraryStatusLabels[itinerary.status] ?? itinerary.status, tone: BadgeTone.outline),
              if (itinerary.cloneType != 'manual') AppBadge(t('Điều chỉnh bằng AI'), icon: LucideIcons.sparkles, tone: BadgeTone.outline),
              Text(t('{length} · khởi hành {date}', {'length': tripLengthLabel(days.length), 'date': formatShortDate(itinerary.startDate)}), style: AppText.meta),
            ],
          ),
          const SizedBox(height: 10),
          Text(itinerary.title, style: AppText.h1),
          if (itinerary.note.isNotEmpty) ...[const SizedBox(height: 6), Text(tx(itinerary.note), style: AppText.meta)],
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              AppButton(label: t('Chỉnh sửa'), icon: LucideIcons.pencil, onPressed: () => context.push('/itineraries/${itinerary.id}/edit')),
              AppButton(
                label: t('Ghép từ bài khác'),
                icon: LucideIcons.gitMerge,
                variant: ButtonVariant.outline,
                onPressed: () => showMergeSheet(context, itinerary),
              ),
            ],
          ),
          const SizedBox(height: 18),
          AppCard(
            surface: Surface.featured,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(t('Tổng chi phí'), style: AppText.meta),
                Text(formatVnd(total), style: AppText.hero),
                Text(t('Tính lại tức thì mỗi khi bạn đổi thứ tự, xoá hoặc ghép thêm ngày.'), style: AppText.meta),
                const SizedBox(height: 6),
                row(t('Số ngày'), '${days.length}'),
                row(t('Số điểm dừng'), '$stops'),
                row(t('Nguồn'), t('{n} bài viết', {'n': itinerary.sourcePostIds.length})),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(child: Text(t('Các ngày'), style: AppText.h2)),
              if (_saving) ...[
                const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 6),
                Text(t('Đang lưu thứ tự…'), style: AppText.meta),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Text(t('Dùng mũi tên để đổi thứ tự ngày. Ngày sẽ được đánh số và đổi ngày tháng lại theo thứ tự mới.'), style: AppText.meta),
          const SizedBox(height: 12),
          for (var index = 0; index < days.length; index++) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 4),
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(color: dayColor(index + 1), shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(t('NGÀY {value}', {'value': index + 1}), style: AppText.caps),
                            Text(days[index].title.isEmpty ? t('Chưa đặt tên') : days[index].title, style: AppText.h3),
                            Text(formatLongDate(days[index].date), style: AppText.meta),
                          ],
                        ),
                      ),
                      AppIconButton(
                        icon: LucideIcons.arrowUp,
                        label: t('Đưa ngày {value} lên', {'value': index + 1}),
                        tone: IconTone.well,
                        size: 34,
                        onPressed: index == 0 || _saving ? null : () => _move(itinerary, index, index - 1),
                      ),
                      const SizedBox(width: 6),
                      AppIconButton(
                        icon: LucideIcons.arrowDown,
                        label: t('Đưa ngày {value} xuống', {'value': index + 1}),
                        tone: IconTone.well,
                        size: 34,
                        onPressed: index == days.length - 1 || _saving ? null : () => _move(itinerary, index, index + 1),
                      ),
                      if (days.length > 1) ...[
                        const SizedBox(width: 6),
                        AppIconButton(
                          icon: LucideIcons.trash,
                          label: t('Xoá ngày {value}', {'value': index + 1}),
                          tone: IconTone.danger,
                          size: 34,
                          onPressed: () => _remove(itinerary, days[index]),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    formatVnd(dayCostOf(days[index])),
                    style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                  ),
                  const SizedBox(height: 8),
                  for (final location in days[index].locations)
                    Padding(
                      padding: const EdgeInsets.only(left: 20, bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  [?location.startTime, location.name.isEmpty ? t('Điểm dừng') : location.name].join('  '),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.bodySmall,
                                ),
                                if (location.note.isNotEmpty) Text(location.note, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                                if (location.planB != null)
                                  Text(
                                    t('Plan B: {name} · cách khoảng {km} km', {'name': location.planB!['name'], 'km': formatDecimal(doubleOf(location.planB!['distanceKm']))}),
                                    style: AppText.meta,
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(location.costUnknown ? t('Chưa có dữ liệu') : location.estCost > 0 ? formatVnd(location.estCost) : t('Miễn phí'), style: AppText.meta),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 12),
          Text(t('Bản đồ tuyến'), style: AppText.h2),
          const SizedBox(height: 12),
          RouteMap(days: days, height: 260, label: t('Bản đồ tuyến đường của {title}', {'title': itinerary.title})),
          if (itinerary.checklist?.groups.isNotEmpty ?? false) ...[
            const SizedBox(height: 24),
            Text(t('Chuẩn bị'), style: AppText.h2),
            ChecklistGroups(itinerary.checklist!),
          ],
          const SizedBox(height: 24),
          Text(t('Bài viết gốc'), style: AppText.h2),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var i = 0; i < itinerary.sourcePostIds.length; i++)
                AppButton(
                  label: t('Xem bài viết gốc{value}', {'value': itinerary.sourcePostIds.length > 1 ? ' ${i + 1}' : ''}),
                  variant: ButtonVariant.outline,
                  size: ButtonSize.sm,
                  onPressed: () => context.push('/posts/${itinerary.sourcePostIds[i]}'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
