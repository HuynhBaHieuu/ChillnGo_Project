/// Tin tức in the admin console (web: admin/news/NewsPanel.tsx): the sources
/// travel news is fetched from, the review queue, published news, the fetch
/// log and the worker key for social media sources.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/labels.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/json.dart';
import '../../data/models.dart';
import '../../data/services/news_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import 'admin_common.dart';

Map<String, String> get sourceTypeLabels => {
  'rss': t('Báo / trang tin (RSS)'),
  'google_news': t('Google News theo từ khoá'),
  'youtube_channel': t('Kênh YouTube'),
  'social': t('Mạng xã hội (máy cào)'),
};

String _actionLabel(String action) => switch (action) {
  'approve' => t('Đăng lên Newsfeed'),
  'reject' => t('Loại tin'),
  'hide' => t('Ẩn tin'),
  _ => t('Hiện lại'),
};

/// Which decisions apply in each status (the API checks the same).
const _actions = {
  'pending': ['approve', 'reject'],
  'published': ['hide'],
  'hidden': ['unhide'],
  'rejected': ['approve'],
};

String _triggerLabel(String trigger) => switch (trigger) {
  'schedule' => t('Theo lịch'),
  'worker' => t('Máy cào'),
  _ => t('Bấm tay'),
};

void _notice(WidgetRef ref, String text, {bool error = false}) => ref.read(adminNoticeProvider.notifier).show(Notice(text, error: error));

class NewsPanel extends ConsumerStatefulWidget {
  const NewsPanel({super.key});

  @override
  ConsumerState<NewsPanel> createState() => _NewsPanelState();
}

class _NewsPanelState extends ConsumerState<NewsPanel> {
  var _tab = 'sources';
  var _version = 0;
  var _running = false;

  Future<void> _runAll() async {
    setState(() => _running = true);
    try {
      final result = await NewsService.runAll();
      final created = result.sources.fold<int>(0, (n, s) => n + intOf(s['created']));
      final failed = result.sources.where((s) => s['ok'] != true).length;
      _notice(
        ref,
        result.sources.isEmpty
            ? t('Không có nguồn nào đang bật để cào.')
            : t('Đã cào {sources} nguồn: {created} tin mới, AI xử lý {enriched} tin, {failed} nguồn lỗi.', {
                'sources': result.sources.length,
                'created': created,
                'enriched': result.enriched,
                'failed': failed,
              }),
        error: failed > 0,
      );
      setState(() => _version++);
    } catch (e) {
      _notice(ref, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentTabs<String>(
          value: _tab,
          items: [
            (value: 'sources', label: t('Nguồn'), count: null),
            (value: 'pending', label: t('Chờ duyệt'), count: null),
            (value: 'published', label: t('Đã đăng'), count: null),
            (value: 'hidden', label: t('Đã ẩn'), count: null),
            (value: 'rejected', label: t('Bị loại'), count: null),
            (value: 'runs', label: t('Nhật ký cào'), count: null),
            (value: 'worker', label: t('Máy cào'), count: null),
          ],
          onChanged: (tab) => setState(() => _tab = tab),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(
            label: t('Cào tất cả ngay'),
            icon: LucideIcons.refreshCw,
            size: ButtonSize.sm,
            variant: ButtonVariant.outline,
            loading: _running,
            onPressed: _running ? null : _runAll,
          ),
        ),
        const SizedBox(height: 14),
        switch (_tab) {
          'sources' => _SourcesTab(key: ValueKey('sources-$_version')),
          'runs' => _RunsTab(key: ValueKey('runs-$_version')),
          'worker' => const _WorkerTab(),
          _ => _ItemsTab(key: ValueKey('$_tab-$_version'), status: _tab),
        },
      ],
    );
  }
}

/* --------------------------------------------------------------- sources */

class _SourcesTab extends ConsumerStatefulWidget {
  const _SourcesTab({super.key});

  @override
  ConsumerState<_SourcesTab> createState() => _SourcesTabState();
}

class _SourcesTabState extends ConsumerState<_SourcesTab> {
  List<NewsSource>? _sources;
  Object? _error;
  String? _busy;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await NewsService.sources();
      if (mounted) {
        setState(() {
          _sources = list;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _act(String id, Future<void> Function() action) async {
    setState(() => _busy = id);
    try {
      await action();
      await _load();
    } catch (e) {
      _notice(ref, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _run(NewsSource source) => _act(source.id, () async {
    final r = await NewsService.runSource(source.id);
    final result = r.result;
    _notice(
      ref,
      result['ok'] == true
          ? t('{name}: đọc {fetched} tin, {created} tin mới, {duplicates} đã có, {filtered} bị lọc. AI xử lý {enriched} tin.', {
              'name': source.name,
              'fetched': intOf(result['fetched']),
              'created': intOf(result['created']),
              'duplicates': intOf(result['duplicates']),
              'filtered': intOf(result['filtered']),
              'enriched': r.enriched,
            })
          : t('{name}: {error}', {'name': source.name, 'error': tx(str(result['error']))}),
      error: result['ok'] != true,
    );
  });

  Future<void> _edit(NewsSource? source) async {
    final saved = await showAppSheet<String>(
      context,
      title: source == null ? t('Thêm nguồn tin') : t('Sửa nguồn tin'),
      tall: true,
      builder: (_) => _SourceForm(source: source),
    );
    if (saved == null) return;
    _notice(ref, source == null ? t('Đã thêm nguồn {name}.', {'name': saved}) : t('Đã lưu nguồn {name}.', {'name': saved}));
    await _load();
  }

  Future<void> _delete(NewsSource source) async {
    final ok = await confirmAction(
      context,
      title: t('Xoá nguồn này?'),
      description: t('Nguồn {name} sẽ ngừng được cào. Tin đã đăng từ nguồn này vẫn còn trên Newsfeed.', {'name': source.name}),
      confirmLabel: t('Xoá nguồn'),
      destructive: true,
      onConfirm: () => NewsService.deleteSource(source.id),
    );
    if (!ok) return;
    _notice(ref, t('Đã xoá nguồn {name}. Tin đã có vẫn được giữ.', {'name': source.name}));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final sources = _sources;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          t('Nguồn được cào tự động mỗi giờ. Tin mới đi qua bộ lọc từ khoá, AI tóm tắt và gắn vùng, rồi lên Newsfeed hoặc chờ duyệt tuỳ nguồn.'),
          style: AppText.meta,
        ),
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(label: t('Thêm nguồn'), icon: LucideIcons.plus, size: ButtonSize.sm, onPressed: () => _edit(null)),
        ),
        const SizedBox(height: 14),
        if (sources == null && _error == null)
          const LoadingView()
        else if (sources == null)
          ErrorPanel(error: _error, onRetry: _load)
        else if (sources.isEmpty)
          Text(t('Chưa có nguồn nào. Bấm Thêm nguồn, ví dụ RSS https://vnexpress.net/rss/du-lich.rss.'), style: AppText.meta)
        else
          for (final source in sources) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(source.name, style: AppText.label),
                  Text(
                    '${sourceTypeLabels[source.type] ?? source.type}${source.platform != null ? ' · ${platformNames[source.platform] ?? source.platform}' : ''}',
                    style: AppText.meta.copyWith(fontSize: 12),
                  ),
                  Text(
                    source.query.isNotEmpty ? '“${source.query}”' : source.url,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.meta.copyWith(fontSize: 12),
                  ),
                  const SizedBox(height: 6),
                  if (source.lastRunAt == null)
                    Text(t('Chưa cào'), style: AppText.meta)
                  else if (source.lastStatus == 'error')
                    Text('${relativeTime(source.lastRunAt!)} · ${tx(source.lastError)}', style: AppText.meta.copyWith(color: AppColors.destructive))
                  else
                    Text('${relativeTime(source.lastRunAt!)} · ${t('{count} tin mới', {'count': source.lastNewCount})}', style: AppText.meta),
                  Text(
                    '${t('{count} đã đăng', {'count': source.published})} · ${t('{count} chờ duyệt', {'count': source.pending})}',
                    style: AppText.meta.copyWith(fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  CheckboxRow(
                    checked: source.enabled,
                    title: t('Đang bật'),
                    enabled: _busy == null,
                    onChanged: (v) => _act(source.id, () => NewsService.updateSource(source.id, source.toInput({'enabled': v}))),
                  ),
                  const SizedBox(height: 6),
                  CheckboxRow(
                    checked: source.autoPublish,
                    title: t('Tự đăng lên Newsfeed'),
                    enabled: _busy == null,
                    onChanged: (v) => _act(source.id, () => NewsService.updateSource(source.id, source.toInput({'autoPublish': v}))),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (source.type != 'social')
                        AppButton(
                          label: t('Cào ngay'),
                          icon: LucideIcons.play,
                          size: ButtonSize.sm,
                          variant: ButtonVariant.outline,
                          loading: _busy == source.id,
                          onPressed: _busy == null ? () => _run(source) : null,
                        ),
                      AppButton(label: t('Sửa'), icon: LucideIcons.pencil, size: ButtonSize.sm, variant: ButtonVariant.ghost, onPressed: () => _edit(source)),
                      AppButton(label: t('Xoá'), icon: LucideIcons.trash2, size: ButtonSize.sm, variant: ButtonVariant.ghost, onPressed: () => _delete(source)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

/// Thêm / Sửa nguồn tin; pops with the source's name once saved.
class _SourceForm extends StatefulWidget {
  const _SourceForm({required this.source});

  final NewsSource? source;

  @override
  State<_SourceForm> createState() => _SourceFormState();
}

class _SourceFormState extends State<_SourceForm> {
  late final _name = TextEditingController(text: widget.source?.name ?? '');
  late final _url = TextEditingController(text: widget.source?.url ?? '');
  late final _query = TextEditingController(text: widget.source?.query ?? '');
  late final _include = TextEditingController(text: widget.source?.includeKeywords.join(', ') ?? '');
  late final _exclude = TextEditingController(text: widget.source?.excludeKeywords.join(', ') ?? '');
  late final _interval = TextEditingController(text: '${widget.source?.intervalMinutes ?? 60}');
  late String _type = widget.source?.type ?? 'rss';
  late String? _platform = widget.source?.platform;
  late String? _region = widget.source?.defaultRegion;
  late bool _enabled = widget.source?.enabled ?? true;
  late bool _autoPublish = widget.source?.autoPublish ?? false;
  var _saving = false;
  var _previewing = false;
  String? _error;
  ({List<Json> items, int total})? _preview;
  String? _previewError;

  @override
  void dispose() {
    for (final c in [_name, _url, _query, _include, _exclude, _interval]) {
      c.dispose();
    }
    super.dispose();
  }

  List<String> _list(String text) => text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();

  Json _input() => {
    'name': _name.text.trim(),
    'type': _type,
    'url': _url.text.trim(),
    'query': _query.text.trim(),
    'platform': _type == 'social' ? _platform : null,
    'includeKeywords': _list(_include.text),
    'excludeKeywords': _list(_exclude.text),
    'defaultRegion': _region,
    'enabled': _enabled,
    'autoPublish': _autoPublish,
    'intervalMinutes': int.tryParse(_interval.text.trim()) ?? 60,
  };

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final source = widget.source;
      if (source == null) {
        await NewsService.createSource(_input());
      } else {
        await NewsService.updateSource(source.id, _input());
      }
      if (mounted) Navigator.of(context).pop(_name.text.trim());
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = errorMessage(e);
        });
      }
    }
  }

  Future<void> _test() async {
    setState(() {
      _previewing = true;
      _previewError = null;
    });
    try {
      final preview = await NewsService.preview(type: _type, url: _url.text.trim(), query: _query.text.trim());
      if (mounted) {
        setState(() {
          _preview = preview;
          _previewing = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _previewError = errorMessage(e);
          _previewing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final needsUrl = _type == 'rss' || _type == 'youtube_channel' || _type == 'social';
    final needsQuery = _type == 'google_news' || _type == 'social';
    final preview = _preview;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(controller: _name, label: t('Tên nguồn'), hint: t('Ví dụ: VnExpress Du lịch'), maxLength: 80),
        const SizedBox(height: 12),
        SelectField<String>(
          label: t('Loại nguồn'),
          value: _type,
          options: [for (final e in sourceTypeLabels.entries) SelectOption(e.key, e.value)],
          onChanged: (v) => setState(() {
            _type = v;
            _preview = null;
          }),
        ),
        if (_type == 'social') ...[
          const SizedBox(height: 12),
          SelectField<String>(
            label: t('Nền tảng'),
            placeholder: 'Chọn nền tảng',
            value: _platform,
            options: [for (final e in platformNames.entries) SelectOption(e.key, e.value)],
            onChanged: (v) => setState(() => _platform = v),
          ),
        ],
        if (needsUrl) ...[
          const SizedBox(height: 12),
          AppTextField(
            controller: _url,
            label: _type == 'social' ? t('Đường dẫn trang (không bắt buộc)') : t('Đường dẫn'),
            hint: 'https://…',
            keyboardType: TextInputType.url,
          ),
        ],
        if (needsQuery) ...[const SizedBox(height: 12), AppTextField(controller: _query, label: t('Từ khoá tìm kiếm'), hint: t('Ví dụ: du lịch Việt Nam'))],
        const SizedBox(height: 12),
        AppTextField(controller: _include, label: t('Chỉ lấy tin có từ (cách nhau bằng dấu phẩy)'), hint: t('du lịch, homestay')),
        const SizedBox(height: 12),
        AppTextField(controller: _exclude, label: t('Bỏ tin có từ'), hint: t('tai nạn, quảng cáo')),
        const SizedBox(height: 12),
        SelectField<String>(
          label: t('Vùng mặc định'),
          value: _region ?? '',
          options: [SelectOption('', t('Để AI xác định')), for (final r in regions) SelectOption(r, regionLabel(r))],
          onChanged: (v) => setState(() => _region = v.isEmpty ? null : v),
        ),
        const SizedBox(height: 12),
        AppTextField(controller: _interval, label: t('Cào lại mỗi (phút)'), keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        CheckboxRow(
          checked: _enabled,
          title: t('Đang bật'),
          description: t('Tắt để ngừng cào nguồn này mà vẫn giữ tin đã có.'),
          onChanged: (v) => setState(() => _enabled = v),
        ),
        const SizedBox(height: 8),
        CheckboxRow(
          checked: _autoPublish,
          title: t('Tự đăng lên Newsfeed'),
          description: t('Tin AI đánh giá là tin du lịch sẽ lên ngay. Tắt: mọi tin chờ admin duyệt ở tab Chờ duyệt.'),
          onChanged: (v) => setState(() => _autoPublish = v),
        ),
        if (_type != 'social') ...[
          const SizedBox(height: 14),
          AppCard(
            surface: Surface.surface,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(t('Thử nguồn trước khi lưu'), style: AppText.label),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: AppButton(
                    label: t('Thử nguồn'),
                    icon: LucideIcons.flaskConical,
                    size: ButtonSize.sm,
                    variant: ButtonVariant.outline,
                    loading: _previewing,
                    onPressed: _previewing ? null : _test,
                  ),
                ),
                if (_previewError != null) ...[const SizedBox(height: 8), Text(_previewError!, style: AppText.meta.copyWith(color: AppColors.destructive))],
                if (preview != null) ...[
                  const SizedBox(height: 8),
                  Text(t('Đọc được {count} tin. 5 tin đầu:', {'count': preview.total}), style: AppText.meta),
                  for (final item in preview.items)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text('• ${str(item['title'])}', maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.bodySmall),
                    ),
                ],
              ],
            ),
          ),
        ],
        if (_error != null) ...[const SizedBox(height: 12), Text(_error!, style: AppText.meta.copyWith(color: AppColors.destructive))],
        const SizedBox(height: 16),
        AppButton(label: widget.source == null ? t('Thêm nguồn') : t('Lưu thay đổi'), loading: _saving, onPressed: _saving ? null : _save),
        const SizedBox(height: 8),
      ],
    );
  }
}

/* ----------------------------------------------------------------- items */

class _ItemsTab extends ConsumerStatefulWidget {
  const _ItemsTab({super.key, required this.status});

  final String status;

  @override
  ConsumerState<_ItemsTab> createState() => _ItemsTabState();
}

class _ItemsTabState extends ConsumerState<_ItemsTab> {
  int _page = 1;
  AdminPage<NewsItem>? _data;
  Object? _error;
  String? _busy;
  final _selected = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final page = await NewsService.items(status: widget.status, page: _page);
      if (mounted) {
        setState(() {
          _data = page;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _review(List<String> ids, String action, String busy) async {
    setState(() => _busy = busy);
    try {
      final updated = await NewsService.review(ids, action);
      _notice(ref, t('{action}: {count} tin.', {'action': _actionLabel(action), 'count': updated}));
      _selected.clear();
      await _load();
    } catch (e) {
      _notice(ref, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _pin(NewsItem item) async {
    setState(() => _busy = item.id);
    try {
      await NewsService.patchItem(item.id, {'pinned': !item.pinned});
      _notice(ref, item.pinned ? t('Đã bỏ ghim tin.') : t('Đã ghim tin lên đầu Newsfeed.'));
      await _load();
    } catch (e) {
      _notice(ref, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _edit(NewsItem item) async {
    final saved = await showAppSheet<bool>(
      context,
      title: t('Sửa bài'),
      description: item.originalTitle.isEmpty ? item.title : item.originalTitle,
      tall: true,
      builder: (_) => _ItemForm(item: item),
    );
    if (saved != true) return;
    _notice(ref, t('Đã lưu tin.'));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final actions = _actions[widget.status] ?? const <String>[];
    if (data == null) return _error == null ? const LoadingView() : ErrorPanel(error: _error, onRetry: _load);
    if (data.items.isEmpty) return Text(t('Không có tin nào ở mục này.'), style: AppText.meta);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CheckboxRow(
          checked: data.items.every((i) => _selected.contains(i.id)),
          title: t('Chọn tất cả'),
          onChanged: (v) => setState(() => v ? _selected.addAll(data.items.map((i) => i.id)) : _selected.clear()),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final action in actions)
              AppButton(
                label: t('{action} ({count})', {'action': _actionLabel(action), 'count': _selected.length}),
                size: ButtonSize.sm,
                variant: action == 'approve' || action == 'unhide' ? ButtonVariant.primary : ButtonVariant.outline,
                loading: _busy == 'bulk',
                onPressed: _selected.isEmpty || _busy != null ? null : () => _review(_selected.toList(), action, 'bulk'),
              ),
          ],
        ),
        const SizedBox(height: 12),
        for (final item in data.items) ...[
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _selected.contains(item.id),
                      onChanged: (v) => setState(() => v == true ? _selected.add(item.id) : _selected.remove(item.id)),
                    ),
                    if (item.imageUrl.isNotEmpty) ...[
                      SizedBox(width: 88, height: 60, child: NetImage(item.imageUrl, radius: AppRadius.md)),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${newsOrigin(item)} · ${formatDateTime(item.publishedAt)}', style: AppText.meta.copyWith(fontSize: 12)),
                          const SizedBox(height: 2),
                          GestureDetector(
                            onTap: () => openExternal(item.url),
                            child: Text(item.title, style: AppText.label),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (item.pinned) AppBadge(t('Đã ghim'), tone: BadgeTone.primary),
                    if (item.aiStatus == 'failed') AppBadge(t('AI lỗi, dùng trích đoạn'), tone: BadgeTone.outline),
                    if (item.aiStatus == 'skipped') AppBadge(t('Chưa có AI'), tone: BadgeTone.outline),
                    if (item.content.isEmpty) AppBadge(t('Chưa có bài viết'), tone: BadgeTone.outline),
                    for (final r in item.regions) AppBadge(regionLabel(r), tone: BadgeTone.outline),
                    for (final d in item.destinations) AppBadge('📍 $d', tone: BadgeTone.outline),
                  ],
                ),
                const SizedBox(height: 6),
                Text(item.summary.isEmpty ? t('(Chưa có tóm tắt)') : item.summary, maxLines: 4, overflow: TextOverflow.ellipsis, style: AppText.bodySmall),
                if (widget.status == 'published') Text(t('{count} lượt mở', {'count': item.clickCount}), style: AppText.meta.copyWith(fontSize: 12)),
                if (item.statusReason.isNotEmpty)
                  Text(t('Lý do: {reason}', {'reason': item.statusReason}), style: AppText.meta.copyWith(color: AppColors.destructive, fontSize: 12)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final action in actions)
                      AppButton(
                        label: _actionLabel(action),
                        size: ButtonSize.sm,
                        variant: action == 'approve' || action == 'unhide' ? ButtonVariant.primary : ButtonVariant.outline,
                        loading: _busy == '${item.id}-$action',
                        onPressed: _busy == null ? () => _review([item.id], action, '${item.id}-$action') : null,
                      ),
                    if (widget.status == 'published')
                      AppButton(
                        label: item.pinned ? t('Bỏ ghim') : t('Ghim'),
                        icon: item.pinned ? LucideIcons.pinOff : LucideIcons.pin,
                        size: ButtonSize.sm,
                        variant: ButtonVariant.outline,
                        loading: _busy == item.id,
                        onPressed: _busy == null ? () => _pin(item) : null,
                      ),
                    AppButton(
                      label: t('Sửa bài'),
                      icon: LucideIcons.pencil,
                      size: ButtonSize.sm,
                      variant: ButtonVariant.ghost,
                      onPressed: () => _edit(item),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        Pagination(
          page: data.page,
          pageCount: data.pageCount,
          onPage: (page) {
            setState(() => _page = page);
            _load();
          },
        ),
      ],
    );
  }
}

class _ItemForm extends StatefulWidget {
  const _ItemForm({required this.item});

  final NewsItem item;

  @override
  State<_ItemForm> createState() => _ItemFormState();
}

class _ItemFormState extends State<_ItemForm> {
  late final _headline = TextEditingController(text: widget.item.headline);
  late final _summary = TextEditingController(text: widget.item.aiSummary);
  // One paragraph per block; blocks are separated by an empty line.
  late final _content = TextEditingController(text: widget.item.content.join('\n\n'));
  late final _destinations = TextEditingController(text: widget.item.destinations.join(', '));
  late final Set<String> _regions = {...widget.item.regions};
  late List<String> _images = [...widget.item.images];
  late String? _writtenAt = widget.item.writtenAt;
  var _saving = false;
  var _rewriting = false;
  String? _error;

  List<String> get _paragraphs => _content.text
      .split(RegExp(r'\n\s*\n'))
      .map((p) => p.replaceAll(RegExp(r'\s+'), ' ').trim())
      .where((p) => p.isNotEmpty)
      .toList();

  @override
  void dispose() {
    _headline.dispose();
    _summary.dispose();
    _content.dispose();
    _destinations.dispose();
    super.dispose();
  }

  /// The AI's new post replaces what is in the form.
  Future<void> _rewrite() async {
    setState(() {
      _rewriting = true;
      _error = null;
    });
    try {
      final fresh = await NewsService.rewriteItem(widget.item.id);
      if (!mounted) return;
      setState(() {
        _headline.text = fresh.headline;
        _summary.text = fresh.aiSummary;
        _content.text = fresh.content.join('\n\n');
        _destinations.text = fresh.destinations.join(', ');
        _regions
          ..clear()
          ..addAll(fresh.regions);
        _images = [...fresh.images];
        _writtenAt = fresh.writtenAt;
        _rewriting = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _rewriting = false;
          _error = errorMessage(e);
        });
      }
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await NewsService.patchItem(widget.item.id, {
        'headline': _headline.text.trim(),
        'summary': _summary.text.trim(),
        'content': _paragraphs,
        'images': _images,
        'regions': _regions.toList(),
        'destinations': _destinations.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = errorMessage(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final written = _writtenAt;
    final count = _paragraphs.length;
    final busy = _saving || _rewriting;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.borderStrong),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                written != null
                    ? t('AI viết bài này lúc {time}.', {'time': formatDateTime(written)})
                    : t('Tin này chưa có bài viết. AI có thể đọc bài gốc và viết ngay.'),
                style: AppText.meta,
              ),
              const SizedBox(height: 8),
              AppButton(
                label: _rewriting ? t('Đang viết…') : t('Viết lại bằng AI'),
                icon: LucideIcons.sparkles,
                size: ButtonSize.sm,
                variant: ButtonVariant.outline,
                loading: _rewriting,
                onPressed: busy ? null : _rewrite,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppTextField(controller: _headline, label: t('Tiêu đề hiển thị'), hint: t('Để trống thì dùng tiêu đề của nguồn.'), maxLength: 200, maxLines: 2, minLines: 1),
        const SizedBox(height: 12),
        AppTextField(controller: _summary, label: t('Tóm tắt hiển thị trên Newsfeed'), maxLines: 5, minLines: 3, maxLength: 600),
        if (widget.item.excerpt.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(t('Xem trích đoạn gốc'), style: AppText.label.copyWith(fontSize: 13)),
          const SizedBox(height: 4),
          Text(widget.item.excerpt, maxLines: 8, overflow: TextOverflow.ellipsis, style: AppText.meta),
        ],
        const SizedBox(height: 12),
        AppTextField(controller: _content, label: t('Nội dung bài'), maxLines: 16, minLines: 8, onChanged: (_) => setState(() {})),
        const SizedBox(height: 4),
        Text(
          t('{count}/8 đoạn. Mỗi đoạn cách nhau một dòng trống.', {'count': count}),
          style: AppText.meta.copyWith(fontSize: 12, color: count > 8 ? AppColors.destructive : AppColors.meta),
        ),
        const SizedBox(height: 12),
        Text(t('Ảnh ({count})', {'count': _images.length}), style: AppText.label),
        const SizedBox(height: 8),
        if (_images.isEmpty)
          Text(t('Bài này không có ảnh.'), style: AppText.meta)
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (index, url) in _images.indexed)
                SizedBox(
                  width: 92,
                  height: 92,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      NetImage(url, radius: AppRadius.md),
                      if (index == 0) Positioned(left: 4, bottom: 4, child: AppBadge(t('Ảnh bìa'), tone: BadgeTone.overlay)),
                      Positioned(
                        right: 0,
                        top: 0,
                        child: AppIconButton(
                          icon: LucideIcons.x,
                          label: t('Bỏ ảnh {n}', {'n': index + 1}),
                          size: 32,
                          color: AppColors.white,
                          onPressed: () => setState(() => _images = _images.where((x) => x != url).toList()),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        const SizedBox(height: 12),
        Text(t('Vùng'), style: AppText.label),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final r in regions)
              AppChip(
                label: regionLabel(r),
                selected: _regions.contains(r),
                onTap: () => setState(() => _regions.contains(r) ? _regions.remove(r) : _regions.add(r)),
              ),
          ],
        ),
        const SizedBox(height: 12),
        AppTextField(controller: _destinations, label: t('Địa điểm (cách nhau bằng dấu phẩy)'), hint: t('Đà Lạt, Hội An')),
        if (_error != null) ...[const SizedBox(height: 12), Text(_error!, style: AppText.meta.copyWith(color: AppColors.destructive))],
        const SizedBox(height: 16),
        AppButton(label: t('Lưu thay đổi'), loading: _saving, onPressed: busy || count > 8 ? null : _save),
        const SizedBox(height: 8),
      ],
    );
  }
}

/* ------------------------------------------------------------------ runs */

class _RunsTab extends StatefulWidget {
  const _RunsTab({super.key});

  @override
  State<_RunsTab> createState() => _RunsTabState();
}

class _RunsTabState extends State<_RunsTab> {
  int _page = 1;
  AdminPage<NewsRun>? _data;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final page = await NewsService.runs(page: _page);
      if (mounted) {
        setState(() {
          _data = page;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    if (data == null) return _error == null ? const LoadingView() : ErrorPanel(error: _error, onRetry: _load);
    if (data.items.isEmpty) return Text(t('Chưa có lần cào nào. Nhật ký giữ 30 ngày.'), style: AppText.meta);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final run in data.items) ...[
          AppCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(run.sourceName, style: AppText.label),
                Text('${formatDateTime(run.createdAt)} · ${_triggerLabel(run.trigger)}', style: AppText.meta.copyWith(fontSize: 12)),
                const SizedBox(height: 4),
                Text(
                  '${t('Đọc được')} ${run.fetched} · ${t('Mới')} ${run.created} · ${t('Trùng')} ${run.duplicates} · ${t('Bị lọc')} ${run.filtered}',
                  style: AppText.bodySmall,
                ),
                Text(
                  run.error.isNotEmpty ? tx(run.error) : t('Thành công ({seconds} giây)', {'seconds': (run.durationMs / 1000).toStringAsFixed(1)}),
                  style: AppText.meta.copyWith(color: run.error.isNotEmpty ? AppColors.destructive : AppColors.meta, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        Pagination(
          page: data.page,
          pageCount: data.pageCount,
          onPage: (page) {
            setState(() => _page = page);
            _load();
          },
        ),
      ],
    );
  }
}

/* ---------------------------------------------------------------- worker */

class _WorkerTab extends ConsumerStatefulWidget {
  const _WorkerTab();

  @override
  ConsumerState<_WorkerTab> createState() => _WorkerTabState();
}

class _WorkerTabState extends ConsumerState<_WorkerTab> {
  NewsWorker? _worker;
  Object? _error;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final worker = await NewsService.worker();
      if (mounted) {
        setState(() {
          _worker = worker;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _create() async {
    setState(() => _busy = true);
    try {
      final key = await NewsService.createWorkerKey();
      await _load();
      if (!mounted) return;
      await showAppSheet<void>(
        context,
        title: t('Mã máy cào mới'),
        description: t('Chép mã này vào worker.env ngay. Đóng hộp thoại là không xem lại được.'),
        builder: (sheetContext) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SelectableText(key, style: AppText.mono.copyWith(color: AppColors.cream, fontSize: 13)),
            const SizedBox(height: 14),
            AppButton(
              label: t('Chép mã'),
              icon: LucideIcons.copy,
              variant: ButtonVariant.outline,
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: key));
                if (sheetContext.mounted) toast(sheetContext, t('Đã chép mã.'));
              },
            ),
            const SizedBox(height: 8),
            AppButton(label: t('Xong'), onPressed: () => Navigator.of(sheetContext).pop()),
          ],
        ),
      );
    } catch (e) {
      _notice(ref, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke() async {
    final ok = await confirmAction(
      context,
      title: t('Thu hồi mã máy cào?'),
      description: t('Máy cào sẽ ngừng gửi được tin cho tới khi bạn tạo mã mới.'),
      confirmLabel: t('Thu hồi mã'),
      destructive: true,
      onConfirm: NewsService.revokeWorkerKey,
    );
    if (!ok) return;
    _notice(ref, t('Đã thu hồi mã. Máy cào dùng mã cũ sẽ bị từ chối.'));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final w = _worker;
    if (w == null) return _error == null ? const LoadingView() : ErrorPanel(error: _error, onRetry: _load);
    Widget row(String label, String value) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppText.meta)),
          Text(value, style: AppText.bodySmall),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(t('Trạng thái máy cào'), style: AppText.h3),
              const SizedBox(height: 10),
              row(t('Mã kết nối'), w.hasKey ? '${w.keyHint}…' : t('Chưa tạo')),
              row(t('Tạo lúc'), w.createdAt == null ? '—' : formatDateTime(w.createdAt!)),
              row(t('Lần cuối kết nối'), w.lastSeenAt == null ? t('Chưa kết nối') : relativeTime(w.lastSeenAt!)),
              row(t('Nguồn mạng xã hội đang bật'), '${w.socialSources}'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  AppButton(
                    label: w.hasKey ? t('Tạo mã mới') : t('Tạo mã'),
                    icon: LucideIcons.keyRound,
                    size: ButtonSize.sm,
                    loading: _busy,
                    onPressed: _busy ? null : _create,
                  ),
                  if (w.hasKey) AppButton(label: t('Thu hồi mã'), size: ButtonSize.sm, variant: ButtonVariant.outline, onPressed: _revoke),
                ],
              ),
              if (w.hasKey) ...[const SizedBox(height: 6), Text(t('Tạo mã mới sẽ làm mã cũ hết hiệu lực.'), style: AppText.meta.copyWith(fontSize: 12))],
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('Cài máy cào'), style: AppText.h3),
              const SizedBox(height: 8),
              Text(
                t('Nguồn mạng xã hội cần đăng nhập nên không cào được trên máy chủ. Một máy tính chạy Agent Reach sẽ cào giúp và gửi tin về đây.'),
                style: AppText.meta,
              ),
              const SizedBox(height: 8),
              Text('1. ${t('Cài Agent Reach và đăng nhập các nền tảng bằng tài khoản phụ.')}', style: AppText.bodySmall),
              Text('2. ${t('Bấm Tạo mã ở bên trái và chép mã (chỉ hiện một lần).')}', style: AppText.bodySmall),
              Text('3. ${t('Trong thư mục tools/news-worker của dự án, tạo file worker.env gồm:')}', style: AppText.bodySmall),
              const SizedBox(height: 4),
              Text('CHILLNGO_API=https://chillgo-project.vercel.app\nCHILLNGO_WORKER_KEY=cgw_…', style: AppText.mono),
              const SizedBox(height: 4),
              Text('4. ${t('Chạy node worker.mjs, rồi đặt lịch chạy mỗi 1–2 giờ (Task Scheduler hoặc cron).')}', style: AppText.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}
