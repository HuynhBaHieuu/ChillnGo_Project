import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/geo.dart';
import '../../core/itinerary.dart';
import '../../core/labels.dart';
import '../../core/photos.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/post_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../map/legs.dart';
import '../map/route_map.dart';
import 'cover_picker.dart';
import 'day_builder.dart';
import '../../ui/navigation.dart';

String _today() => toDateOnly(DateTime.now());

TripDay _emptyDay(int index, String startDate) {
  final id = 'draft_d${index + 1}_${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}';
  return TripDay(id: id, dayNumber: index + 1, date: addDays(startDate, index), locations: [newStop(id, 1)]);
}

/// The stops in order as one line, for `routeGeoJson` (the same as the web editor).
Map<String, dynamic> _routeGeoJson(List<TripDay> days, String title) => {
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'geometry': {
        'type': 'LineString',
        'coordinates': [
          for (final day in days)
            for (final loc in day.locations.where(isPinned)) [loc.lng, loc.lat],
        ],
      },
      'properties': {'title': title, 'dayCount': days.length},
    },
  ],
};

/// Stops the author described but never pinned get the first place Mapbox
/// finds for their address (or name), so a typed address still lands on the map.
Future<void> _pinByName(List<TripDay> days) async {
  String queryOf(TripLocation l) => ((l.address ?? '').trim().isNotEmpty ? l.address! : l.name).trim();
  final todo = [
    for (final d in days)
      for (final l in d.locations)
        if (!isPinned(l) && queryOf(l).length >= 2) l,
  ];
  await Future.wait(
    todo.map((loc) async {
      final places = await searchPlaces(queryOf(loc)).catchError((_) => <Place>[]);
      if (places.isNotEmpty) {
        loc
          ..lng = places.first.lng
          ..lat = places.first.lat;
      }
    }),
  );
}

/// The journey editor, new or existing (web: PostEditorPage).
class PostEditorScreen extends ConsumerWidget {
  const PostEditorScreen({super.key, this.postId});

  final String? postId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = postId;
    if (id == null) return const _EditorForm(key: ValueKey('new'));

    final existing = ref.watch(postProvider(id));
    final viewerId = ref.watch(viewerIdProvider);
    if (existing.isLoading && !existing.hasValue) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: const Text('Sửa hành trình')),
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
    if (existing.hasError && !existing.hasValue) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: const Text('Sửa hành trình')),
        body: Padding(
          padding: const EdgeInsets.all(kGutter),
          child: Center(
            child: EmptyState(
              title: 'Không mở được hành trình',
              description: errorMessage(existing.error),
              action: AppButton(label: 'Thử lại', variant: ButtonVariant.outline, onPressed: () => ref.invalidate(postProvider(id))),
            ),
          ),
        ),
      );
    }
    final post = existing.value!;
    // Someone else's journey (a demo post too) cannot be edited here.
    if (post.authorId != viewerId) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: const Text('Sửa hành trình')),
        body: const Padding(
          padding: EdgeInsets.all(kGutter),
          child: Center(
            child: EmptyState(title: 'Không chỉnh sửa được', description: 'Bạn chỉ chỉnh sửa được hành trình của chính mình.'),
          ),
        ),
      );
    }
    return _EditorForm(key: ValueKey(id), post: post);
  }
}

class _EditorForm extends ConsumerStatefulWidget {
  const _EditorForm({super.key, this.post});

  final TripPost? post;

  @override
  ConsumerState<_EditorForm> createState() => _EditorFormState();
}

class _EditorFormState extends ConsumerState<_EditorForm> {
  late final TextEditingController _title;
  late final TextEditingController _summary;
  late List<String> _coverImages;
  late String _region;
  late String _season;
  late String _budget;
  late List<String> _tags;
  late List<TripDay> _days;

  late final String _initial;
  bool _saved = false;
  bool _saving = false;
  bool _uploadingCover = false;
  String? _error;

  bool get _isEdit => widget.post != null;

  @override
  void initState() {
    super.initState();
    final post = widget.post;
    _title = TextEditingController(text: post?.title ?? '');
    _summary = TextEditingController(text: post?.summary ?? '');
    _coverImages = post == null
        ? []
        : (post.coverImages?.isNotEmpty ?? false)
        ? [...post.coverImages!]
        : (post.coverUrl.isNotEmpty ? [post.coverUrl] : []);
    _region = post?.region ?? 'north';
    _season = post?.season ?? 'autumn';
    _budget = post?.budgetLevel ?? 'medium';
    _tags = [...?post?.tags];
    _days = post != null && post.days.isNotEmpty ? post.days.map((d) => d.copy()).toList() : [_emptyDay(0, _today())];
    _initial = _snapshot();
  }

  @override
  void dispose() {
    _title.dispose();
    _summary.dispose();
    super.dispose();
  }

  String _snapshot() => jsonEncode({
    't': _title.text,
    's': _summary.text,
    'c': _coverImages,
    'r': _region,
    'se': _season,
    'b': _budget,
    'tg': _tags,
    'd': _days.map((d) => d.toJson()).toList(),
  });

  bool get _dirty => !_saved && _snapshot() != _initial;

  int get _total => totalCostOf(_days);

  TripPostPayload _payload(String status, List<TripDay> source) {
    final dates = source.map((d) => d.date).where((d) => d.isNotEmpty).toList()..sort();
    final days = [for (var i = 0; i < source.length; i++) source[i].copy()..dayNumber = i + 1];
    final title = _title.text.trim();
    return TripPostPayload(
      authorId: ref.read(viewerIdProvider) ?? '',
      title: title,
      summary: _summary.text.trim(),
      coverUrl: _coverImages.isNotEmpty ? _coverImages.first : autoCover(title),
      coverImages: _coverImages,
      region: _region,
      season: _season,
      startDate: dates.isNotEmpty ? dates.first : _today(),
      endDate: dates.isNotEmpty ? dates.last : _today(),
      days: days,
      tags: _tags,
      budgetLevel: _budget,
      totalEstCost: totalCostOf(days),
      routeGeoJson: _routeGeoJson(days, title),
      status: status,
    );
  }

  Future<void> _submit(String status) async {
    setState(() => _error = null);
    if (status == 'published' && (_title.text.trim().isEmpty || _summary.text.trim().isEmpty)) {
      setState(() => _error = 'Hãy nhập tiêu đề và tóm tắt trước khi đăng.');
      return;
    }
    if (_uploadingCover) {
      setState(() => _error = 'Đợi ảnh tải lên xong rồi lưu nhé.');
      return;
    }
    setState(() => _saving = true);
    try {
      // Road legs carry their route, so viewers need no Directions call; only changed legs are fetched.
      await _pinByName(_days).catchError((_) {});
      final days = await withLegRoutes(_days).catchError((_) => _days);
      _days = days;
      final payload = _payload(status, days);
      final saved = _isEdit ? await PostService.updatePost(widget.post!.id, payload) : await PostService.createPost(payload);
      _saved = true;
      invalidateJourneys(ref);
      if (!mounted) return;
      toast(context, saved.status == 'draft' ? 'Đã lưu bản nháp.' : (_isEdit ? 'Đã lưu thay đổi.' : 'Đã đăng hành trình.'));
      if (saved.status == 'draft') {
        context.pushReplacement('/activity/journeys');
      } else {
        context.pushReplacement('/posts/${saved.id}');
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
        title: const Text('Bỏ thay đổi?'),
        content: const Text('Những gì bạn vừa nhập chưa được lưu. Rời trang sẽ mất các thay đổi này.'),
        actions: [
          AppButton(label: 'Ở lại', variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(false)),
          AppButton(label: 'Bỏ thay đổi', variant: ButtonVariant.destructive, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(true)),
        ],
      ),
    );
    if (leave == true && mounted) {
      _saved = true;
      leavePage(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalStops = _days.fold(0, (n, d) => n + d.locations.length);
    final pinnedStops = _days.fold(0, (n, d) => n + d.locations.where(isPinned).length);

    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: Text(_isEdit ? 'Sửa hành trình' : 'Đăng hành trình')),
        body: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 32),
            children: [
              Text('Kể lại chuyến đi theo từng ngày. Càng ghi rõ chi phí và ghi chú, người clone lịch trình của bạn càng đỡ phải đoán.', style: AppText.meta),
              const SizedBox(height: 18),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Thông tin chung', style: AppText.h2),
                    const SizedBox(height: 14),
                    AppTextField(
                      controller: _title,
                      label: 'Tiêu đề',
                      hint: 'Ví dụ: Hà Giang Loop 4N3Đ',
                      maxLength: 150,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 14),
                    AppTextField(
                      controller: _summary,
                      label: 'Tóm tắt',
                      hint: 'Chuyến đi này có gì đặc biệt?',
                      maxLines: 6,
                      minLines: 3,
                      maxLength: 1000,
                      showCounter: true,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 14),
                    Text('Ảnh bìa', style: AppText.label),
                    const SizedBox(height: 8),
                    CoverPicker(
                      value: _coverImages,
                      onChanged: (urls) => setState(() => _coverImages = urls),
                      fallbackUrl: autoCover(_title.text),
                      disabled: _saving,
                      onBusy: (busy) => setState(() => _uploadingCover = busy),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Phân loại', style: AppText.h2),
                    const SizedBox(height: 14),
                    SelectField<String>(
                      label: 'Khu vực',
                      value: _region,
                      options: [for (final r in regions) SelectOption(r, regionLabel(r))],
                      onChanged: (v) => setState(() => _region = v),
                    ),
                    const SizedBox(height: 14),
                    SelectField<String>(
                      label: 'Mùa',
                      value: _season,
                      options: [for (final s in seasons) SelectOption(s, seasonLabel(s))],
                      onChanged: (v) => setState(() => _season = v),
                    ),
                    const SizedBox(height: 14),
                    SelectField<String>(
                      label: 'Mức chi tiêu',
                      value: _budget,
                      options: [for (final b in budgetLevels) SelectOption(b, budgetLabel(b))],
                      onChanged: (v) => setState(() => _budget = v),
                    ),
                    const SizedBox(height: 14),
                    Text('Thẻ', style: AppText.label),
                    const SizedBox(height: 8),
                    TagPicker(value: _tags, onChanged: (tags) => setState(() => _tags = tags)),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(child: Text('Lịch trình (${_days.length} ngày)', style: AppText.h2)),
                  AppButton(
                    label: 'Thêm ngày',
                    icon: LucideIcons.plus,
                    variant: ButtonVariant.outline,
                    size: ButtonSize.sm,
                    onPressed: () => setState(() => _days.add(_emptyDay(_days.length, _days.isNotEmpty ? _days.first.date : _today()))),
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
                  onChanged: () => setState(() {}),
                  onRemove: () => setState(() {
                    _days.removeAt(i);
                    for (var j = 0; j < _days.length; j++) {
                      _days[j].dayNumber = j + 1;
                    }
                  }),
                ),
                const SizedBox(height: 18),
              ],
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(child: Text('Bản đồ tuyến', style: AppText.h2)),
                        Text('$pinnedStops/$totalStops điểm đã ghim', style: AppText.meta),
                      ],
                    ),
                    const SizedBox(height: 14),
                    RouteMap(days: _days, height: 240, label: 'Xem trước tuyến hành trình'),
                    const SizedBox(height: 10),
                    Text(
                      'Chỉ những điểm dừng đã ghim mới hiện trên bản đồ. Ghim bằng ô Địa chỉ: chọn gợi ý, dán link Google Maps, hoặc chọn trên bản đồ.',
                      style: AppText.meta,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text('Bản nháp được lưu vào tài khoản của bạn. Xem lại ở Hoạt động của bạn, mục Hành trình.', style: AppText.meta),
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
                  Expanded(child: Text('Tổng chi phí ước tính', style: AppText.meta)),
                  Text(formatVnd(_total), style: AppText.h3),
                ],
              ),
              if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: AppButton(label: 'Lưu nháp', variant: ButtonVariant.outline, onPressed: _saving ? null : () => _submit('draft')),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      label: _isEdit ? 'Lưu thay đổi' : 'Đăng hành trình',
                      icon: LucideIcons.save,
                      loading: _saving,
                      onPressed: () => _submit('published'),
                    ),
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
