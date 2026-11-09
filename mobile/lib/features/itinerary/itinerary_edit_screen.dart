import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/itinerary.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/itinerary_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/navigation.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../editor/day_builder.dart';
import '../editor/post_editor_screen.dart' show pinByName;
import '../map/legs.dart';
import '../map/route_map.dart';
import 'itineraries_screen.dart';

const _statuses = ['planning', 'confirmed', 'completed'];

/// /itineraries/:id/edit: editing a cloned itinerary (web: ItineraryEditPage).
/// Its name, note, start date and status, and every day and stop, with the
/// journey editor's day builder. Only your copy changes; the journey it came
/// from stays as its author wrote it.
class ItineraryEditScreen extends ConsumerWidget {
  const ItineraryEditScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(itineraryProvider(id));
    final itinerary = async.value;
    if (async.isLoading && itinerary == null) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: Text(t('Chỉnh sửa lịch trình'))),
        body: const Padding(
          padding: EdgeInsets.all(kGutter),
          child: Column(
            children: [
              Skeleton(height: 40),
              SizedBox(height: 16),
              Skeleton(height: 220, radius: AppRadius.lg),
              SizedBox(height: 16),
              Skeleton(height: 300, radius: AppRadius.lg),
            ],
          ),
        ),
      );
    }
    if (itinerary == null) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: Text(t('Chỉnh sửa lịch trình'))),
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
    // Filled once: a later refetch keeps the edits in progress.
    return _ItineraryForm(key: ValueKey(itinerary.id), itinerary: itinerary);
  }
}

class _ItineraryForm extends ConsumerStatefulWidget {
  const _ItineraryForm({super.key, required this.itinerary});

  final ClonedItinerary itinerary;

  @override
  ConsumerState<_ItineraryForm> createState() => _ItineraryFormState();
}

class _ItineraryFormState extends ConsumerState<_ItineraryForm> {
  late final TextEditingController _title;
  late final TextEditingController _note;
  late String _startDate;
  late String _status;
  late List<TripDay> _days;

  late final String _initial;
  bool _saved = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final itinerary = widget.itinerary;
    _title = TextEditingController(text: itinerary.title);
    // The API writes the note in Vietnamese ("Sao chép từ hành trình …"); edit it as the reader sees it.
    _note = TextEditingController(text: tx(itinerary.note));
    _startDate = itinerary.startDate.isNotEmpty ? itinerary.startDate : toDateOnly(DateTime.now());
    _status = _statuses.contains(itinerary.status) ? itinerary.status : 'planning';
    _days = itinerary.days.map((d) => d.copy()).toList();
    _redate();
    _initial = _snapshot();
  }

  @override
  void dispose() {
    _title.dispose();
    _note.dispose();
    super.dispose();
  }

  String _snapshot() => jsonEncode({'t': _title.text, 'n': _note.text, 's': _startDate, 'st': _status, 'd': _days.map((d) => d.toJson()).toList()});

  bool get _dirty => !_saved && _snapshot() != _initial;

  /// Days numbered and dated in order from the start date, as the API stores them.
  void _redate() {
    for (var i = 0; i < _days.length; i++) {
      _days[i]
        ..dayNumber = i + 1
        ..date = addDays(_startDate, i);
    }
  }

  TripDay _emptyDay() {
    final id = '${widget.itinerary.id}_n${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}';
    return TripDay(id: id, dayNumber: _days.length + 1, locations: [newStop(id, 1)]);
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (_title.text.trim().isEmpty) {
      setState(() => _error = t('Hãy đặt tên cho lịch trình.'));
      return;
    }
    setState(() => _saving = true);
    try {
      // Road legs carry their route, so the map needs no Directions call later.
      await pinByName(_days).catchError((_) {});
      final days = await withLegRoutes(_days).catchError((_) => _days);
      _days = days;
      final id = widget.itinerary.id;
      await ItineraryService.updateItinerary(id, title: _title.text, note: _note.text, startDate: _startDate, status: _status, days: days);
      _saved = true;
      ref.invalidate(itineraryProvider(id));
      ref.invalidate(myItinerariesProvider);
      if (!mounted) return;
      toast(context, t('Đã lưu thay đổi.'));
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/itineraries/$id');
      }
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(t('Bỏ thay đổi?')),
        content: Text(t('Những gì bạn vừa nhập chưa được lưu. Rời trang sẽ mất các thay đổi này.')),
        actions: [
          AppButton(label: t('Ở lại'), variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(false)),
          AppButton(label: t('Bỏ thay đổi'), variant: ButtonVariant.destructive, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(true)),
        ],
      ),
    );
    if (leave == true && mounted) {
      _saved = true;
      leavePage(context, fallback: '/itineraries/${widget.itinerary.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusLabels = itineraryStatusLabels;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: Text(t('Chỉnh sửa lịch trình'))),
        body: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 32),
            children: [
              Text(
                t('Sửa lịch trình theo cách bạn muốn đi: đổi tên, ngày khởi hành, thêm bớt ngày và điểm dừng. Hành trình gốc không bị thay đổi.'),
                style: AppText.meta,
              ),
              const SizedBox(height: 18),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(t('Thông tin chung'), style: AppText.h2),
                    const SizedBox(height: 14),
                    AppTextField(
                      controller: _title,
                      label: t('Tên lịch trình'),
                      maxLength: 150,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 14),
                    AppTextField(
                      controller: _note,
                      label: t('Ghi chú'),
                      maxLines: 5,
                      minLines: 2,
                      maxLength: 1000,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 14),
                    DateField(
                      label: t('Ngày khởi hành'),
                      value: _startDate,
                      helper: t('Các ngày trong lịch trình sẽ được đánh lại từ ngày này.'),
                      onChanged: (date) => setState(() {
                        _startDate = date;
                        _redate();
                      }),
                    ),
                    const SizedBox(height: 14),
                    SelectField<String>(
                      label: t('Trạng thái'),
                      value: _status,
                      options: [for (final s in _statuses) SelectOption(s, statusLabels[s]!)],
                      onChanged: (v) => setState(() => _status = v),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(child: Text(t('Lịch trình ({n} ngày)', {'n': _days.length}), style: AppText.h2)),
                  AppButton(
                    label: t('Thêm ngày'),
                    icon: LucideIcons.plus,
                    variant: ButtonVariant.outline,
                    size: ButtonSize.sm,
                    onPressed: _days.length >= 60
                        ? null
                        : () => setState(() {
                            _days.add(_emptyDay());
                            _redate();
                          }),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              for (var i = 0; i < _days.length; i++) ...[
                DayBuilder(
                  key: ValueKey(_days[i].id),
                  day: _days[i],
                  index: i,
                  canRemove: _days.length > 1,
                  dateLocked: true,
                  onChanged: () => setState(() {}),
                  onRemove: () => setState(() {
                    _days.removeAt(i);
                    _redate();
                  }),
                ),
                const SizedBox(height: 18),
              ],
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(t('Bản đồ tuyến'), style: AppText.h2),
                    const SizedBox(height: 14),
                    RouteMap(days: _days, height: 240, label: t('Bản đồ tuyến đường của {title}', {'title': _title.text})),
                  ],
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: Container(
          padding: EdgeInsets.fromLTRB(kGutter, 10, kGutter, MediaQuery.paddingOf(context).bottom.clamp(12, 40)),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.border)),
            boxShadow: AppShadows.raised,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(child: Text(t('Tổng chi phí ước tính'), style: AppText.meta)),
                  Text(formatVnd(totalCostOf(_days)), style: AppText.h3),
                ],
              ),
              if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: AppButton(label: t('Huỷ'), variant: ButtonVariant.outline, onPressed: _saving ? null : () => Navigator.of(context).maybePop()),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(label: t('Lưu thay đổi'), icon: LucideIcons.save, loading: _saving, onPressed: _save),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
