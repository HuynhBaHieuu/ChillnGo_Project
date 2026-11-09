import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/roles.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/report_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../report/report_sheet.dart';
import 'admin_common.dart';
import 'admin_panels.dart';

const _statuses = ['pending', 'resolved', 'dismissed'];
const _types = ['post', 'comment', 'checkin', 'user'];
const _all = 'all';

/// The decisions, in the order they are offered (web: ACTION_META).
Map<String, ({String label, IconData icon, bool destructive})> get _actionMeta => {
  'dismiss': (label: t('Bỏ qua (không vi phạm)'), icon: LucideIcons.shieldCheck, destructive: false),
  'hide': (label: t('Ẩn nội dung'), icon: LucideIcons.eyeOff, destructive: false),
  'remove': (label: t('Gỡ nội dung'), icon: LucideIcons.trash2, destructive: true),
  'lock': (label: t('Khoá tài khoản'), icon: LucideIcons.lock, destructive: true),
};

/// Kiểm duyệt nội dung: reports grouped by what they are about, and the page
/// for one piece of content with its reports and the decision buttons
/// (web: ReportsPanel).
class ReportsPanel extends StatefulWidget {
  const ReportsPanel({super.key, required this.actor});

  final User actor;

  @override
  State<ReportsPanel> createState() => _ReportsPanelState();
}

class _ReportsPanelState extends State<ReportsPanel> {
  ({String type, String id})? _selected;

  @override
  Widget build(BuildContext context) {
    final selected = _selected;
    if (selected != null) {
      return _ReportDetail(
        key: ValueKey('${selected.type}:${selected.id}'),
        actor: widget.actor,
        targetType: selected.type,
        targetId: selected.id,
        onBack: () => setState(() => _selected = null),
      );
    }
    return _ReportQueue(onOpen: (group) => setState(() => _selected = (type: group.targetType, id: group.targetId)));
  }
}

/* ------------------------------------------------------------------ queue */

class _ReportQueue extends ConsumerStatefulWidget {
  const _ReportQueue({required this.onOpen});

  final ValueChanged<ReportGroup> onOpen;

  @override
  ConsumerState<_ReportQueue> createState() => _ReportQueueState();
}

class _ReportQueueState extends ConsumerState<_ReportQueue> {
  String _status = 'pending';
  String _type = _all;
  int _page = 1;
  AdminPage<ReportGroup>? _data;
  Object? _error;
  bool _loading = true;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final page = await ReportService.getQueue(status: _status, targetType: _type == _all ? null : _type, page: _page);
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

  @override
  Widget build(BuildContext context) {
    ref.listen(adminVersionProvider, (_, _) => _load());
    final data = _data;
    final statusLabels = reportStatusLabels;
    final typeLabels = reportTargetLabels;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentTabs<String>(
          items: [for (final s in _statuses) (value: s, label: statusLabels[s]!, count: null)],
          value: _status,
          onChanged: (s) {
            setState(() {
              _status = s;
              _page = 1;
              _data = null;
            });
            _load();
          },
        ),
        const SizedBox(height: 10),
        SelectField<String>(
          value: _type,
          options: [SelectOption(_all, t('Mọi loại nội dung')), for (final tp in _types) SelectOption(tp, _capitalized(typeLabels[tp]!))],
          onChanged: (v) {
            setState(() {
              _type = v;
              _page = 1;
            });
            _load();
          },
        ),
        const SizedBox(height: 14),
        if (_loading && data == null)
          LoadingView(message: t('Đang tải danh sách…'))
        else if (_error != null && data == null)
          ErrorPanel(error: _error, onRetry: _load)
        else if (data == null || data.items.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.borderStrong),
            ),
            child: Text(
              _status == 'pending' ? t('Không có báo cáo nào đang chờ xử lý.') : t('Chưa có báo cáo nào ở mục này.'),
              style: AppText.meta,
              textAlign: TextAlign.center,
            ),
          )
        else ...[
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          for (final group in data.items) ...[
            _QueueCard(group: group, pending: _status == 'pending', onOpen: () => widget.onOpen(group)),
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              Text(t('{n} nội dung bị báo cáo', {'n': data.total}), style: AppText.meta.copyWith(fontSize: 12)),
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

String _capitalized(String text) => text.isEmpty ? text : text[0].toUpperCase() + text.substring(1);

/// The reasons that were given, most frequent first.
List<(String, int)> _topReasons(Map<String, int> reasons) {
  final list = [
    for (final r in reportReasons)
      if ((reasons[r] ?? 0) > 0) (r, reasons[r]!),
  ];
  list.sort((a, b) => b.$2.compareTo(a.$2));
  return list;
}

class _QueueCard extends StatelessWidget {
  const _QueueCard({required this.group, required this.pending, required this.onOpen});

  final ReportGroup group;
  final bool pending;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final snapshot = group.snapshot;
    final headline = snapshot.title.isNotEmpty ? snapshot.title : (snapshot.text.isNotEmpty ? snapshot.text : t('(không có tiêu đề)'));
    final labels = reportReasonLabels;
    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Thumb(snapshot: snapshot, type: group.targetType),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        _TypeBadge(type: group.targetType),
                        ?_stateBadge(group.target),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(headline, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.label),
                    if (snapshot.title.isNotEmpty && snapshot.text.isNotEmpty)
                      Text(snapshot.text, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta.copyWith(fontSize: 12)),
                  ],
                ),
              ),
              const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.meta),
            ],
          ),
          const SizedBox(height: 10),
          _PersonLine(person: group.owner),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(t('{n} báo cáo', {'n': group.count}), style: AppText.label.copyWith(fontSize: 13)),
              for (final (reason, n) in _topReasons(group.reasons).take(3)) AppBadge('${labels[reason] ?? reason} · $n'),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            group.resolvedAt != null
                ? [
                    reportActionLabels[group.action] ?? group.action,
                    formatDateTime(group.resolvedAt),
                    if (group.resolvedBy != null) t('bởi {name}', {'name': group.resolvedBy!.displayName}),
                  ].join(' · ')
                : '${t('Gần nhất')}: ${formatDateTime(group.lastReportedAt)}',
            style: AppText.meta.copyWith(fontSize: 12),
          ),
        ],
      ),
    );
  }
}

/* ----------------------------------------------------------------- detail */

class _ReportDetail extends ConsumerStatefulWidget {
  const _ReportDetail({super.key, required this.actor, required this.targetType, required this.targetId, required this.onBack});

  final User actor;
  final String targetType;
  final String targetId;
  final VoidCallback onBack;

  @override
  ConsumerState<_ReportDetail> createState() => _ReportDetailState();
}

class _ReportDetailState extends ConsumerState<_ReportDetail> {
  final _note = TextEditingController();
  ({ReportTargetDetail target, List<ReportEntry> reports})? _data;
  Object? _error;
  bool _loading = true;
  String? _busy;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ReportService.getTarget(widget.targetType, widget.targetId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  /// After a decision: this page, the queue, the counts and the user list reload.
  void _refresh() {
    ref.read(adminVersionProvider.notifier).bump();
    _load();
  }

  Future<void> _resolve(String action) async {
    final notice = ref.read(adminNoticeProvider.notifier);
    final label = _actionMeta[action]!.label;
    setState(() => _busy = action);
    try {
      final resolved = await ReportService.resolve(widget.targetType, widget.targetId, action, _note.text);
      _note.clear();
      notice.show(Notice(t('{action}: đã xử lý {n} báo cáo.', {'action': label, 'n': resolved})));
      _refresh();
    } catch (error) {
      notice.show(Notice(errorMessage(error), error: true));
      rethrow;
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _decide(String action) async {
    final meta = _actionMeta[action]!;
    if (!meta.destructive) {
      await _resolve(action).catchError((Object _) {});
      return;
    }
    final target = _data!.target;
    final owner = target.owner;
    final name = owner != null ? '${owner.displayName} (@${owner.username})' : t('Chủ nội dung');
    await confirmAction(
      context,
      title: action == 'lock' ? t('Khoá tài khoản của chủ nội dung?') : t('Gỡ nội dung này?'),
      description: action == 'lock'
          ? t('{name} sẽ không đăng nhập được nữa, buổi phát trực tiếp đang chạy sẽ kết thúc và nội dung bị báo cáo sẽ bị ẩn. Mở khoá lại ở mục Người dùng.', {
              'name': name,
            })
          : widget.targetType == 'comment'
          ? t('Bình luận (và các trả lời của nó) sẽ bị xoá hẳn.')
          : t('Nội dung bị ẩn khỏi mọi người và chuyển vào mục Đã xoá gần đây của tác giả, tác giả không tự khôi phục được.'),
      confirmLabel: meta.label,
      destructive: true,
      onConfirm: () => _resolve(action),
    );
  }

  Future<void> _unhide() async {
    final notice = ref.read(adminNoticeProvider.notifier);
    setState(() => _busy = 'unhide');
    try {
      await ReportService.unhide(widget.targetType, widget.targetId);
      notice.show(Notice(t('Nội dung đã hiện lại.')));
      _refresh();
    } catch (error) {
      notice.show(Notice(errorMessage(error), error: true));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final back = Align(
      alignment: Alignment.centerLeft,
      child: AppButton(
        label: t('Về danh sách báo cáo'),
        icon: LucideIcons.arrowLeft,
        variant: ButtonVariant.ghost,
        size: ButtonSize.sm,
        onPressed: widget.onBack,
      ),
    );
    final data = _data;
    if (_loading && data == null) {
      return Column(
        children: [
          back,
          const SizedBox(height: 12),
          LoadingView(message: t('Đang tải…')),
        ],
      );
    }
    if (data == null) {
      return Column(
        children: [
          back,
          const SizedBox(height: 12),
          ErrorPanel(error: _error, onRetry: _load),
        ],
      );
    }

    final target = data.target;
    final snapshot = target.snapshot;
    final actor = widget.actor;
    bool can(String action) => target.allowedActions.contains(action) && (action != 'lock' || hasModule(actor, 'users'));
    final actions = ['dismiss', 'hide', 'remove', 'lock'].where(can).toList();
    final busy = _busy != null;
    final canUnhide = widget.targetType != 'user' && target.state.exists && target.state.hidden && hasModule(actor, 'content');
    final reasonLabels = reportReasonLabels;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        back,
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        const SizedBox(height: 8),

        // Preview
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  _TypeBadge(type: widget.targetType),
                  ?_stateBadge(target.state),
                ],
              ),
              if (snapshot.imageUrl.isNotEmpty) ...[
                const SizedBox(height: 12),
                if (widget.targetType == 'user')
                  Align(
                    alignment: Alignment.centerLeft,
                    child: AppAvatar(url: snapshot.imageUrl, name: snapshot.title, size: 72),
                  )
                else
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: SizedBox(height: 200, child: NetImage(snapshot.imageUrl)),
                  ),
              ],
              if (snapshot.title.isNotEmpty) ...[const SizedBox(height: 12), Text(snapshot.title, style: AppText.h2)],
              if (snapshot.text.isNotEmpty) ...[const SizedBox(height: 8), Text(snapshot.text, style: AppText.bodySmall.copyWith(color: AppColors.meta))],
              if (!target.state.exists) ...[
                const SizedBox(height: 8),
                Text(t('Nội dung đã bị xoá. Đây là bản lưu lúc bị báo cáo.'), style: AppText.meta.copyWith(fontSize: 12)),
              ],
              const Divider(height: 28),
              _PersonLine(person: target.owner),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Decision
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(t('Đang chờ xử lý'), style: AppText.meta),
              Text('${target.pendingCount}', style: AppText.hero),
              if (target.pendingCount > 0) ...[
                const SizedBox(height: 6),
                for (final (reason, n) in _topReasons(target.reasons))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Expanded(child: Text(reasonLabels[reason] ?? reason, style: AppText.bodySmall)),
                        Text('$n', style: AppText.meta),
                      ],
                    ),
                  ),
                const SizedBox(height: 10),
                AppTextField(controller: _note, label: t('Ghi chú quyết định (không bắt buộc)'), maxLength: 500, maxLines: 3, minLines: 2),
                const SizedBox(height: 12),
                for (final action in actions) ...[
                  AppButton(
                    label: _actionMeta[action]!.label,
                    icon: _actionMeta[action]!.icon,
                    fullWidth: true,
                    loading: _busy == action,
                    variant: _actionMeta[action]!.destructive
                        ? ButtonVariant.destructive
                        : action == 'hide'
                        ? ButtonVariant.primary
                        : ButtonVariant.outline,
                    onPressed: busy ? null : () => _decide(action),
                  ),
                  const SizedBox(height: 8),
                ],
                if (target.allowedActions.contains('lock') && !hasModule(actor, 'users'))
                  Text(t('Khoá tài khoản cần thêm quyền Người dùng.'), style: AppText.meta.copyWith(fontSize: 12)),
              ] else
                Text(t('Mọi báo cáo về nội dung này đã được xử lý.'), style: AppText.meta),
              if (canUnhide) ...[
                const SizedBox(height: 8),
                AppButton(
                  label: t('Hiện lại nội dung'),
                  icon: LucideIcons.eye,
                  variant: ButtonVariant.outline,
                  fullWidth: true,
                  loading: _busy == 'unhide',
                  onPressed: busy ? null : _unhide,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Reports
        Text(t('Người báo cáo ({n})', {'n': data.reports.length}), style: AppText.label),
        const SizedBox(height: 10),
        for (final r in data.reports) ...[
          AppCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _PersonLine(person: r.reporter),
                const SizedBox(height: 8),
                Text(reasonLabels[r.reason] ?? r.reason, style: AppText.label.copyWith(fontSize: 13)),
                if (r.note.isNotEmpty) ...[const SizedBox(height: 2), Text(r.note, style: AppText.meta.copyWith(fontSize: 12))],
                const SizedBox(height: 6),
                Text(
                  [
                    formatDateTime(r.createdAt),
                    reportStatusLabels[r.status] ?? r.status,
                    if (r.status != 'pending') reportActionLabels[r.action] ?? r.action,
                    ?r.resolvedBy?.displayName,
                  ].join(' · '),
                  style: AppText.meta.copyWith(fontSize: 12),
                ),
                if (r.resolutionNote.isNotEmpty) Text('“${r.resolutionNote}”', style: AppText.meta.copyWith(fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

/* ---------------------------------------------------------------- pieces */

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.type});

  final String type;

  @override
  Widget build(BuildContext context) => AppBadge(_capitalized(reportTargetLabels[type] ?? type), tone: BadgeTone.outline);
}

Widget? _stateBadge(ReportTargetState state) {
  if (!state.exists) return AppBadge(t('Đã bị xoá'));
  if (!state.hidden) return null;
  final label = state.action == 'lock'
      ? t('Tài khoản đã khoá')
      : state.action == 'remove'
      ? t('Đã gỡ')
      : state.hiddenBy == 'system'
      ? t('Tự động ẩn tạm')
      : t('Đã ẩn');
  return AppBadge(label, tone: BadgeTone.danger);
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.snapshot, required this.type});

  final ReportSnapshot snapshot;
  final String type;

  @override
  Widget build(BuildContext context) {
    if (snapshot.imageUrl.isEmpty) {
      return Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: AppColors.well, borderRadius: BorderRadius.circular(AppRadius.md)),
        child: Text(type.substring(0, 2).toUpperCase(), style: AppText.meta.copyWith(fontWeight: FontWeight.w700)),
      );
    }
    if (type == 'user') return AppAvatar(url: snapshot.imageUrl, name: snapshot.title, size: 48);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: SizedBox(width: 48, height: 48, child: NetImage(snapshot.imageUrl)),
    );
  }
}

class _PersonLine extends StatelessWidget {
  const _PersonLine({required this.person});

  final ReportPerson? person;

  @override
  Widget build(BuildContext context) {
    final p = person;
    if (p == null) return Text(t('Tài khoản đã xoá'), style: AppText.meta.copyWith(fontSize: 12));
    return Row(
      children: [
        AppAvatar(url: p.avatarUrl, name: p.displayName, size: 32),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(p.displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.label.copyWith(fontSize: 13)),
              Text(
                '@${p.username}${p.status == 'locked' ? ' · ${t('Đã khoá')}' : ''}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.meta.copyWith(fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
