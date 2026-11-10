/// Danh mục (web: admin/catalog/): the destinations, places and preparation
/// checklist AI clone plans from. Needs the categories module; the API checks it.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/catalog_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import 'admin_common.dart';
import 'admin_panels.dart';

/* ---------------------------------------------------------------- labels */

Map<String, String> get _tagLabels => {
  'all': t('Mọi chuyến đi'),
  'beach': t('Biển'),
  'mountain': t('Núi'),
  'temple': t('Chùa – đền'),
  'water': t('Sông nước – thác'),
  'outdoor': t('Ngoài trời'),
  'rainy': t('Mùa mưa'),
  'peak': t('Mùa cao điểm'),
  'kids': t('Đi cùng trẻ em'),
  'elderly': t('Đi cùng người lớn tuổi'),
};

String _categoryLabel(CatalogMeta meta, String? key) {
  if (key == null) return t('Chưa rõ');
  final label = meta.categories[key];
  return label == null ? key : tx(label);
}

String _tagLabel(CatalogMeta meta, String tag) => _tagLabels[tag] ?? _categoryLabel(meta, tag);

/// "" → null; otherwise the number, or NaN when it is not one.
double? _parse(String text) {
  final trimmed = text.trim().replaceAll(',', '.');
  return trimmed.isEmpty ? null : (double.tryParse(trimmed) ?? double.nan);
}

/// A whole amount of money: "150.000", "150,000" and "150 000" all mean 150000.
/// "" → null; NaN when it is not one.
double? _parseAmount(String text) {
  final trimmed = text.trim().replaceAll(RegExp(r'[\s.,]'), '');
  if (trimmed.isEmpty) return null;
  return RegExp(r'^\d+$').hasMatch(trimmed) ? double.parse(trimmed) : double.nan;
}

String _text(num? value) => value == null ? '' : (value == value.roundToDouble() ? value.toInt().toString() : value.toString());

const _months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* ----------------------------------------------------------------- panel */

class CatalogPanel extends ConsumerStatefulWidget {
  const CatalogPanel({super.key});

  @override
  ConsumerState<CatalogPanel> createState() => _CatalogPanelState();
}

class _CatalogPanelState extends ConsumerState<CatalogPanel> {
  String _tab = 'places';
  CatalogMeta? _meta;
  List<CatalogDestination>? _destinations;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([if (_meta == null) CatalogService.getMeta(), CatalogService.listDestinations()]);
      if (!mounted) return;
      setState(() {
        if (results.length == 2) _meta = results.first as CatalogMeta;
        _destinations = results.last as List<CatalogDestination>;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(adminVersionProvider, (_, _) => _load());
    final meta = _meta;
    final destinations = _destinations;
    if (meta == null || destinations == null) {
      return _error != null ? ErrorPanel(error: _error, onRetry: _load) : LoadingView(message: t('Đang tải danh mục…'));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentTabs<String>(
          items: [
            (value: 'places', label: t('Địa điểm'), count: null),
            (value: 'destinations', label: t('Điểm đến'), count: destinations.length),
            (value: 'checklist', label: t('Checklist chuẩn bị'), count: null),
          ],
          value: _tab,
          onChanged: (v) => setState(() => _tab = v),
        ),
        const SizedBox(height: 16),
        switch (_tab) {
          'destinations' => _DestinationsTab(destinations: destinations),
          'checklist' => _ChecklistTab(meta: meta),
          _ => _PlacesTab(meta: meta, destinations: destinations),
        },
      ],
    );
  }
}

/* ---------------------------------------------------------------- shared */

void _saved(WidgetRef ref, String text) {
  ref.read(adminNoticeProvider.notifier).show(Notice(text));
  ref.read(adminVersionProvider.notifier).bump();
}

Future<void> _confirmDelete(BuildContext context, WidgetRef ref, {required String name, required String description, required Future<void> Function() delete, required String done}) {
  return confirmAction(
    context,
    title: t('Xoá {name}?', {'name': name}),
    description: description,
    confirmLabel: t('Xoá'),
    destructive: true,
    onConfirm: () async {
      await delete();
      _saved(ref, done);
    },
  );
}

class _Empty extends StatelessWidget {
  const _Empty(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.lg), border: Border.all(color: AppColors.borderStrong)),
      child: Text(text, style: AppText.meta, textAlign: TextAlign.center),
    );
  }
}

class _Chips<T> extends StatelessWidget {
  const _Chips({required this.legend, required this.options, required this.value, required this.onChanged, required this.label});

  final String legend;
  final List<T> options;
  final List<T> value;
  final ValueChanged<List<T>> onChanged;
  final String Function(T) label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(legend, style: AppText.label),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final option in options)
              AppChip(
                label: label(option),
                selected: value.contains(option),
                onTap: () => onChanged(value.contains(option) ? value.where((v) => v != option).toList() : [...value, option]),
              ),
          ],
        ),
      ],
    );
  }
}

class _TagWrap extends StatelessWidget {
  const _TagWrap({required this.tags, required this.meta});

  final List<String> tags;
  final CatalogMeta meta;

  @override
  Widget build(BuildContext context) {
    if (tags.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 4, runSpacing: 4, children: [for (final tag in tags) AppBadge(_tagLabel(meta, tag))]);
  }
}

class _SheetButtons extends StatelessWidget {
  const _SheetButtons({required this.pending, required this.onSave});

  final bool pending;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: AppButton(label: t('Huỷ'), variant: ButtonVariant.outline, onPressed: pending ? null : () => Navigator.of(context).pop())),
        const SizedBox(width: 10),
        Expanded(child: AppButton(label: t('Lưu'), loading: pending, onPressed: onSave)),
      ],
    );
  }
}

/* ----------------------------------------------------------- destinations */

class _DestinationsTab extends ConsumerWidget {
  const _DestinationsTab({required this.destinations});

  final List<CatalogDestination> destinations;

  void _edit(BuildContext context, CatalogDestination? d) => showAppSheet<void>(
    context,
    title: d == null ? t('Thêm điểm đến') : t('Sửa điểm đến'),
    description: t('Để trống những gì chưa chắc chắn. AI không bao giờ tự đoán thời tiết hay lễ hội.'),
    tall: true,
    builder: (_) => _DestinationForm(destination: d),
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    String months(List<int> list) => list.isEmpty ? '—' : list.join(', ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          t('Mỗi điểm đến là một vùng có tâm và bán kính. AI chỉ gợi ý địa điểm nằm trong vùng đó, và chỉ nhắc mùa mưa, mùa cao điểm, lễ hội đã được nhập ở đây.'),
          style: AppText.meta,
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(label: t('Thêm điểm đến'), icon: LucideIcons.plus, onPressed: () => _edit(context, null)),
        ),
        const SizedBox(height: 14),
        if (destinations.isEmpty) _Empty(t('Chưa có điểm đến nào.')),
        for (final d in destinations) ...[
          AppCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.name, style: AppText.h3),
                      Text('${d.region} · ${d.slug} · ${_text(d.radiusKm)} km', style: AppText.meta.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Text('${t('Mùa mưa (tháng)')}: ${months(d.rainyMonths)}', style: AppText.bodySmall),
                      Text('${t('Cao điểm (tháng)')}: ${months(d.peakMonths)}', style: AppText.bodySmall),
                      Text(t('{n} địa điểm', {'n': d.placeCount}), style: AppText.meta.copyWith(fontSize: 12)),
                    ],
                  ),
                ),
                AppIconButton(icon: LucideIcons.pencil, label: t('Sửa {name}', {'name': d.name}), onPressed: () => _edit(context, d)),
                AppIconButton(
                  icon: LucideIcons.trash2,
                  label: t('Xoá {name}', {'name': d.name}),
                  onPressed: () => _confirmDelete(
                    context,
                    ref,
                    name: d.name,
                    description: d.placeCount > 0
                        ? t('Điểm đến này còn {n} địa điểm nên chưa xoá được. Hãy xoá hoặc chuyển các địa điểm đó trước.', {'n': d.placeCount})
                        : t('Điểm đến sẽ bị xoá hẳn. Không hoàn tác được.'),
                    delete: () => CatalogService.deleteDestination(d.id),
                    done: t('Đã xoá điểm đến {name}.', {'name': d.name}),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _DestinationForm extends ConsumerStatefulWidget {
  const _DestinationForm({this.destination});

  final CatalogDestination? destination;

  @override
  ConsumerState<_DestinationForm> createState() => _DestinationFormState();
}

class _DestinationFormState extends ConsumerState<_DestinationForm> {
  late final _name = TextEditingController(text: widget.destination?.name);
  late final _slug = TextEditingController(text: widget.destination?.slug);
  late final _region = TextEditingController(text: widget.destination?.region);
  late final _lat = TextEditingController(text: _text(widget.destination?.lat));
  late final _lng = TextEditingController(text: _text(widget.destination?.lng));
  late final _radius = TextEditingController(text: _text(widget.destination?.radiusKm ?? 20));
  late List<int> _rainy = [...?widget.destination?.rainyMonths];
  late List<int> _peak = [...?widget.destination?.peakMonths];
  late final List<(TextEditingController, int)> _festivals = [
    for (final f in widget.destination?.festivals ?? const <CatalogFestival>[]) (TextEditingController(text: f.name), f.month),
  ];
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _slug, _region, _lat, _lng, _radius, ..._festivals.map((f) => f.$1)]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final lat = _parse(_lat.text), lng = _parse(_lng.text), radius = _parse(_radius.text);
    if ([lat, lng, radius].any((n) => n == null || n.isNaN)) {
      setState(() => _error = t('Vĩ độ, kinh độ và bán kính phải là số.'));
      return;
    }
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final input = CatalogDestination(
        id: widget.destination?.id ?? '',
        slug: _slug.text.trim().toLowerCase(),
        name: _name.text.trim(),
        region: _region.text.trim(),
        lat: lat!,
        lng: lng!,
        radiusKm: radius!,
        rainyMonths: _rainy,
        peakMonths: _peak,
        festivals: [for (final (c, m) in _festivals) if (c.text.trim().isNotEmpty) CatalogFestival(c.text.trim(), m)],
      );
      await CatalogService.saveDestination(widget.destination?.id, input);
      _saved(ref, t('Đã lưu điểm đến {name}.', {'name': input.name}));
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const decimal = TextInputType.numberWithOptions(decimal: true, signed: true);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(controller: _name, label: t('Tên điểm đến'), maxLength: 80),
        const SizedBox(height: 12),
        AppTextField(controller: _slug, label: t('Mã đường dẫn'), helper: t('Chữ không dấu, số và dấu gạch ngang, ví dụ da-lat'), maxLength: 60, autocorrect: false),
        const SizedBox(height: 12),
        AppTextField(controller: _region, label: t('Vùng / tỉnh'), maxLength: 80),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: AppTextField(controller: _lat, label: t('Vĩ độ tâm'), keyboardType: decimal)),
            const SizedBox(width: 10),
            Expanded(child: AppTextField(controller: _lng, label: t('Kinh độ tâm'), keyboardType: decimal)),
          ],
        ),
        const SizedBox(height: 12),
        AppTextField(controller: _radius, label: t('Bán kính (km)'), keyboardType: decimal),
        const SizedBox(height: 14),
        _Chips<int>(legend: t('Tháng mùa mưa'), options: _months, value: _rainy, onChanged: (v) => setState(() => _rainy = v), label: (m) => '$m'),
        const SizedBox(height: 14),
        _Chips<int>(legend: t('Tháng cao điểm'), options: _months, value: _peak, onChanged: (v) => setState(() => _peak = v), label: (m) => '$m'),
        const SizedBox(height: 14),
        Text(t('Lễ hội'), style: AppText.label),
        const SizedBox(height: 8),
        for (var i = 0; i < _festivals.length; i++) ...[
          Row(
            children: [
              Expanded(flex: 3, child: AppTextField(controller: _festivals[i].$1, hint: t('Tên lễ hội'), maxLength: 80)),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: SelectField<int>(
                  value: _festivals[i].$2,
                  options: [for (final m in _months) SelectOption(m, t('Tháng {n}', {'n': m}))],
                  onChanged: (m) => setState(() => _festivals[i] = (_festivals[i].$1, m)),
                ),
              ),
              AppIconButton(
                icon: LucideIcons.x,
                label: t('Bỏ lễ hội này'),
                onPressed: () => setState(() => _festivals.removeAt(i).$1.dispose()),
              ),
            ],
          ),
          const SizedBox(height: 8),
        ],
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(
            label: t('Thêm lễ hội'),
            icon: LucideIcons.plus,
            variant: ButtonVariant.outline,
            size: ButtonSize.sm,
            onPressed: () => setState(() => _festivals.add((TextEditingController(), 1))),
          ),
        ),
        if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
        const SizedBox(height: 16),
        _SheetButtons(pending: _pending, onSave: _submit),
      ],
    );
  }
}

/* ----------------------------------------------------------------- places */

class _PlacesTab extends ConsumerStatefulWidget {
  const _PlacesTab({required this.meta, required this.destinations});

  final CatalogMeta meta;
  final List<CatalogDestination> destinations;

  @override
  ConsumerState<_PlacesTab> createState() => _PlacesTabState();
}

class _PlacesTabState extends ConsumerState<_PlacesTab> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _q = '';
  String _destination = 'all';
  String _category = 'all';
  int _page = 1;
  AdminPage<CatalogPlace>? _data;
  Object? _error;
  bool _loading = true;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final page = await CatalogService.listPlaces(
        q: _q.isEmpty ? null : _q,
        destinationId: _destination == 'all' ? null : _destination,
        category: _category == 'all' ? null : _category,
        page: _page,
      );
      if (!mounted || request != _request) return;
      setState(() {
        _data = page;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  void _edit(CatalogPlace? p) => showAppSheet<void>(
    context,
    title: p == null ? t('Thêm địa điểm') : t('Sửa địa điểm'),
    description: t('Chỉ nhập những gì đã kiểm chứng. Ô để trống hiển thị là “chưa có dữ liệu”, AI không tự ước lượng.'),
    tall: true,
    builder: (_) => _PlaceForm(
      place: p,
      meta: widget.meta,
      destinations: widget.destinations,
      defaultDestination: _destination == 'all' ? widget.destinations.firstOrNull?.id : _destination,
    ),
  );

  @override
  Widget build(BuildContext context) {
    ref.listen(adminVersionProvider, (_, _) => _load());
    final meta = widget.meta;
    final data = _data;
    String destinationName(String id) => widget.destinations.where((d) => d.id == id).firstOrNull?.name ?? '—';
    void filter(void Function() change) {
      setState(() {
        change();
        _page = 1;
      });
      _load();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          controller: _search,
          icon: LucideIcons.search,
          hint: t('Tìm địa điểm'),
          onChanged: (text) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 300), () => filter(() => _q = text.trim()));
          },
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: SelectField<String>(
                value: _destination,
                options: [SelectOption('all', t('Mọi điểm đến')), for (final d in widget.destinations) SelectOption(d.id, d.name)],
                onChanged: (v) => filter(() => _destination = v),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SelectField<String>(
                value: _category,
                options: [SelectOption('all', t('Mọi loại')), for (final key in meta.categories.keys) SelectOption(key, _categoryLabel(meta, key))],
                onChanged: (v) => filter(() => _category = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(label: t('Thêm địa điểm'), icon: LucideIcons.plus, onPressed: widget.destinations.isEmpty ? null : () => _edit(null)),
        ),
        if (widget.destinations.isEmpty) ...[
          const SizedBox(height: 6),
          Text(t('Hãy thêm một điểm đến trước khi thêm địa điểm.'), style: AppText.meta.copyWith(fontSize: 12)),
        ],
        const SizedBox(height: 14),
        if (_loading && data == null)
          LoadingView(message: t('Đang tải danh sách…'))
        else if (_error != null && data == null)
          ErrorPanel(error: _error, onRetry: _load)
        else if (data == null || data.items.isEmpty)
          _Empty(t('Không có địa điểm nào khớp bộ lọc.'))
        else ...[
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          for (final p in data.items) ...[
            AppCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.name, style: AppText.h3),
                        Text(
                          [destinationName(p.destinationId), _categoryLabel(meta, p.category), if (p.address.isNotEmpty) p.address].join(' · '),
                          style: AppText.meta.copyWith(fontSize: 12),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          [
                            '${t('Chi phí / người')}: ${p.avgCost == null ? t('Chưa rõ') : formatVnd(p.avgCost!)}',
                            '${t('Giờ mở cửa')}: ${p.open != null && p.close != null ? '${p.open}–${p.close}' : t('Chưa rõ')}',
                          ].join('\n'),
                          style: AppText.bodySmall,
                        ),
                        if (p.tags.isNotEmpty) ...[const SizedBox(height: 6), _TagWrap(tags: p.tags, meta: meta)],
                      ],
                    ),
                  ),
                  AppIconButton(icon: LucideIcons.pencil, label: t('Sửa {name}', {'name': p.name}), onPressed: () => _edit(p)),
                  AppIconButton(
                    icon: LucideIcons.trash2,
                    label: t('Xoá {name}', {'name': p.name}),
                    onPressed: () => _confirmDelete(
                      context,
                      ref,
                      name: p.name,
                      description: t('Địa điểm sẽ bị xoá hẳn và AI không gợi ý nó nữa. Nếu có hành trình đang dùng địa điểm này, hệ thống sẽ từ chối xoá.'),
                      delete: () => CatalogService.deletePlace(p.id),
                      done: t('Đã xoá địa điểm {name}.', {'name': p.name}),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              Text(t('{n} địa điểm', {'n': data.total}), style: AppText.meta.copyWith(fontSize: 12)),
              const Spacer(),
              Pagination(
                page: data.page,
                pageCount: data.pageCount,
                onPage: (p) {
                  setState(() => _page = p);
                  _load();
                },
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _PlaceForm extends ConsumerStatefulWidget {
  const _PlaceForm({this.place, required this.meta, required this.destinations, this.defaultDestination});

  final CatalogPlace? place;
  final CatalogMeta meta;
  final List<CatalogDestination> destinations;
  final String? defaultDestination;

  @override
  ConsumerState<_PlaceForm> createState() => _PlaceFormState();
}

class _PlaceFormState extends ConsumerState<_PlaceForm> {
  late String? _destination = widget.place?.destinationId ?? widget.defaultDestination;
  late final _name = TextEditingController(text: widget.place?.name);
  late final _address = TextEditingController(text: widget.place?.address);
  late final _lat = TextEditingController(text: _text(widget.place?.lat));
  late final _lng = TextEditingController(text: _text(widget.place?.lng));
  late final _cost = TextEditingController(text: _text(widget.place?.avgCost));
  late final _rating = TextEditingController(text: _text(widget.place?.rating));
  late final _open = TextEditingController(text: widget.place?.open);
  late final _close = TextEditingController(text: widget.place?.close);
  late final _photo = TextEditingController(text: widget.place?.photoUrl);
  late String _category = widget.place?.category ?? 'none';
  late int _priceLevel = widget.place?.priceLevel ?? 0;
  late String _outdoor = _tri(widget.place?.isOutdoor);
  late String _booking = _tri(widget.place?.requiresBooking);
  late List<String> _tags = [...?widget.place?.tags];
  bool _pending = false;
  String? _error;

  static String _tri(bool? value) => value == null ? 'unknown' : (value ? 'yes' : 'no');
  static bool? _bool(String value) => value == 'unknown' ? null : value == 'yes';

  @override
  void dispose() {
    for (final c in [_name, _address, _lat, _lng, _cost, _rating, _open, _close, _photo]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final lat = _parse(_lat.text), lng = _parse(_lng.text), cost = _parseAmount(_cost.text), rating = _parse(_rating.text);
    final hhmm = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');
    String? problem;
    if (_destination == null) {
      problem = t('Vui lòng chọn điểm đến');
    } else if ([lat, lng, cost, rating].any((n) => n != null && n.isNaN)) {
      problem = t('Toạ độ, chi phí và điểm đánh giá phải là số, hoặc để trống.');
    } else if (_open.text.trim().isEmpty != _close.text.trim().isEmpty) {
      problem = t('Nhập cả giờ mở và giờ đóng cửa, hoặc để trống cả hai.');
    } else if (_open.text.trim().isNotEmpty && !(hhmm.hasMatch(_open.text.trim()) && hhmm.hasMatch(_close.text.trim()))) {
      problem = t('Giờ theo dạng HH:MM, ví dụ 07:30');
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final open = _open.text.trim();
      final input = CatalogPlace(
        id: widget.place?.id ?? '',
        destinationId: _destination!,
        name: _name.text.trim(),
        address: _address.text.trim(),
        lat: lat,
        lng: lng,
        category: _category == 'none' ? null : _category,
        avgCost: cost?.round(),
        priceLevel: _priceLevel == 0 ? null : _priceLevel,
        open: open.isEmpty ? null : open,
        close: open.isEmpty ? null : _close.text.trim(),
        isOutdoor: _bool(_outdoor),
        requiresBooking: _bool(_booking),
        rating: rating,
        photoUrl: _photo.text.trim().isEmpty ? null : _photo.text.trim(),
        tags: _tags,
      );
      await CatalogService.savePlace(widget.place?.id, input);
      _saved(ref, t('Đã lưu địa điểm {name}.', {'name': input.name}));
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final meta = widget.meta;
    const decimal = TextInputType.numberWithOptions(decimal: true, signed: true);
    final tri = [SelectOption('unknown', t('Chưa rõ')), SelectOption('yes', t('Có')), SelectOption('no', t('Không'))];
    final time = [FilteringTextInputFormatter.allow(RegExp(r'[0-9:]'))];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SelectField<String>(
          label: t('Điểm đến'),
          value: _destination,
          options: [for (final d in widget.destinations) SelectOption(d.id, d.name)],
          onChanged: (v) => setState(() => _destination = v),
        ),
        const SizedBox(height: 12),
        AppTextField(controller: _name, label: t('Tên địa điểm'), maxLength: 120),
        const SizedBox(height: 12),
        AppTextField(controller: _address, label: t('Địa chỉ'), maxLength: 200),
        const SizedBox(height: 12),
        SelectField<String>(
          label: t('Loại'),
          value: _category,
          options: [SelectOption('none', t('Chưa rõ')), for (final key in meta.categories.keys) SelectOption(key, _categoryLabel(meta, key))],
          onChanged: (v) => setState(() => _category = v),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: AppTextField(controller: _lat, label: t('Vĩ độ'), keyboardType: decimal)),
            const SizedBox(width: 10),
            Expanded(child: AppTextField(controller: _lng, label: t('Kinh độ'), keyboardType: decimal)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: AppTextField(controller: _cost, label: t('Chi phí / người (VND)'), keyboardType: TextInputType.number)),
            const SizedBox(width: 10),
            Expanded(
              child: SelectField<int>(
                label: t('Mức giá'),
                value: _priceLevel,
                options: [SelectOption(0, t('Chưa rõ')), for (var n = 1; n <= 4; n++) SelectOption(n, '₫' * n)],
                onChanged: (v) => setState(() => _priceLevel = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        AppTextField(controller: _rating, label: t('Đánh giá (0–5)'), keyboardType: decimal),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: AppTextField(controller: _open, label: t('Giờ mở cửa'), hint: '07:30', keyboardType: TextInputType.datetime, inputFormatters: time, maxLength: 5)),
            const SizedBox(width: 10),
            Expanded(child: AppTextField(controller: _close, label: t('Giờ đóng cửa'), hint: '22:00', keyboardType: TextInputType.datetime, inputFormatters: time, maxLength: 5)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: SelectField<String>(label: t('Ngoài trời'), value: _outdoor, options: tri, onChanged: (v) => setState(() => _outdoor = v))),
            const SizedBox(width: 10),
            Expanded(child: SelectField<String>(label: t('Cần đặt trước'), value: _booking, options: tri, onChanged: (v) => setState(() => _booking = v))),
          ],
        ),
        const SizedBox(height: 12),
        AppTextField(controller: _photo, label: t('Ảnh (đường dẫn)'), keyboardType: TextInputType.url, autocorrect: false, maxLength: 500),
        const SizedBox(height: 14),
        _Chips<String>(
          legend: t('Tag cho checklist chuẩn bị'),
          options: meta.placeTags,
          value: _tags,
          onChanged: (v) => setState(() => _tags = v),
          label: (tag) => _tagLabel(meta, tag),
        ),
        if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
        const SizedBox(height: 16),
        _SheetButtons(pending: _pending, onSave: _submit),
      ],
    );
  }
}

/* -------------------------------------------------------------- checklist */

class _ChecklistTab extends ConsumerStatefulWidget {
  const _ChecklistTab({required this.meta});

  final CatalogMeta meta;

  @override
  ConsumerState<_ChecklistTab> createState() => _ChecklistTabState();
}

class _ChecklistTabState extends ConsumerState<_ChecklistTab> {
  List<ChecklistItem>? _items;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await CatalogService.listChecklist();
      if (mounted) {
        setState(() {
          _items = items;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  void _edit(ChecklistItem? item, List<String> groups) => showAppSheet<void>(
    context,
    title: item == null ? t('Thêm mục chuẩn bị') : t('Sửa mục chuẩn bị'),
    description: t('Ví dụ: “Áo mưa mỏng” trong nhóm Quần áo, tag Mùa mưa.'),
    tall: true,
    builder: (_) => _ChecklistForm(item: item, groups: groups, meta: widget.meta),
  );

  @override
  Widget build(BuildContext context) {
    ref.listen(adminVersionProvider, (_, _) => _load());
    final items = _items;
    final groups = items == null ? <String>[] : {for (final i in items) i.group}.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          t('Một mục hiện ra khi chuyến đi có ít nhất một tag của nó. AI chỉ sắp xếp và nhóm các mục này, không tự thêm mục mới.'),
          style: AppText.meta,
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(label: t('Thêm mục'), icon: LucideIcons.plus, onPressed: () => _edit(null, groups)),
        ),
        const SizedBox(height: 14),
        if (items == null)
          _error != null ? ErrorPanel(error: _error, onRetry: _load) : LoadingView(message: t('Đang tải danh sách…'))
        else if (items.isEmpty)
          _Empty(t('Chưa có mục chuẩn bị nào.'))
        else
          for (final group in groups) ...[
            Text(group, style: AppText.label),
            const SizedBox(height: 8),
            for (final item in items.where((i) => i.group == group)) ...[
              AppCard(
                padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.text, style: AppText.body),
                          const SizedBox(height: 4),
                          _TagWrap(tags: item.tags, meta: widget.meta),
                        ],
                      ),
                    ),
                    AppIconButton(icon: LucideIcons.pencil, label: t('Sửa {name}', {'name': item.text}), onPressed: () => _edit(item, groups)),
                    AppIconButton(
                      icon: LucideIcons.trash2,
                      label: t('Xoá {name}', {'name': item.text}),
                      onPressed: () => _confirmDelete(
                        context,
                        ref,
                        name: item.text,
                        description: t('Mục này sẽ không còn xuất hiện trong checklist của các bản nháp mới.'),
                        delete: () => CatalogService.deleteChecklistItem(item.id),
                        done: t('Đã xoá mục chuẩn bị.'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 8),
          ],
      ],
    );
  }
}

class _ChecklistForm extends ConsumerStatefulWidget {
  const _ChecklistForm({this.item, required this.groups, required this.meta});

  final ChecklistItem? item;
  final List<String> groups;
  final CatalogMeta meta;

  @override
  ConsumerState<_ChecklistForm> createState() => _ChecklistFormState();
}

class _ChecklistFormState extends ConsumerState<_ChecklistForm> {
  late final _text = TextEditingController(text: widget.item?.text);
  late final _group = TextEditingController(text: widget.item?.group ?? widget.groups.firstOrNull);
  late final _order = TextEditingController(text: '${widget.item?.order ?? 0}');
  late List<String> _tags = [...widget.item?.tags ?? const ['all']];
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    _group.dispose();
    _order.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_tags.isEmpty) {
      setState(() => _error = t('Chọn ít nhất một tag. Chọn “Mọi chuyến đi” nếu mục này luôn cần.'));
      return;
    }
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await CatalogService.saveChecklistItem(
        widget.item?.id,
        ChecklistItem(id: '', text: _text.text.trim(), group: _group.text.trim(), tags: _tags, order: (int.tryParse(_order.text.trim()) ?? 0).clamp(0, 10000)),
      );
      _saved(ref, t('Đã lưu mục chuẩn bị.'));
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(controller: _text, label: t('Nội dung'), maxLength: 200),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(flex: 3, child: AppTextField(controller: _group, label: t('Nhóm'), maxLength: 40)),
            const SizedBox(width: 10),
            Expanded(child: AppTextField(controller: _order, label: t('Thứ tự'), keyboardType: TextInputType.number)),
          ],
        ),
        if (widget.groups.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [for (final g in widget.groups) AppChip(label: g, selected: _group.text == g, onTap: () => setState(() => _group.text = g))],
          ),
        ],
        const SizedBox(height: 14),
        _Chips<String>(
          legend: t('Hiện khi chuyến đi có'),
          options: widget.meta.checklistTags,
          value: _tags,
          onChanged: (v) => setState(() => _tags = v),
          label: (tag) => _tagLabel(widget.meta, tag),
        ),
        if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
        const SizedBox(height: 16),
        _SheetButtons(pending: _pending, onSave: _submit),
      ],
    );
  }
}
