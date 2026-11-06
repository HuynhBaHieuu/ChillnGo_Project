import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/ai_clone_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/chat.dart';
import '../../ui/navigation.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../map/route_map.dart';
import '../../core/i18n.dart';

/// What a change did, and its colour in the diff.
(String, Color) _labelOf(AiChange c) => switch ((c.type, c.status)) {
  ('keep', _) => (t('Giữ nguyên'), AppColors.sage),
  ('replace', 'reverted') => (t('Dùng điểm gốc'), AppColors.sage),
  ('replace', _) => (t('Thay thế'), AppColors.ochre),
  ('add', 'reverted') => (t('Bạn đã bỏ'), AppColors.meta),
  ('add', _) => (t('Thêm mới'), AppColors.teal),
  (_, 'reverted') => (t('Khôi phục'), AppColors.sage),
  _ => (t('Đã bỏ'), AppColors.destructive),
};

/// The buttons a change offers in its current state: label, the status it sets, icon.
List<(String, String, IconData)> _actionsOf(AiChange c) {
  final pending = c.status == 'pending';
  return switch ((c.type, c.status)) {
    ('keep', _) => [],
    ('replace', 'reverted') => [(t('Dùng gợi ý AI'), 'pending', LucideIcons.sparkles)],
    ('replace', _) => [if (pending) (t('Chấp nhận'), 'accepted', LucideIcons.check), (t('Hoàn tác'), 'reverted', LucideIcons.undo2)],
    ('add', 'reverted') => [(t('Thêm lại'), 'pending', LucideIcons.rotateCcw)],
    ('add', _) => [if (pending) (t('Chấp nhận'), 'accepted', LucideIcons.check), (t('Bỏ điểm này'), 'reverted', LucideIcons.undo2)],
    (_, 'reverted') => [(t('Bỏ lại'), 'pending', LucideIcons.undo2)],
    _ => [if (pending) (t('Đồng ý bỏ'), 'accepted', LucideIcons.check), (t('Khôi phục'), 'reverted', LucideIcons.rotateCcw)],
  };
}

/// Facts ChillnGo has about a place; unknown ones are left out.
List<String> _factsOf(AiPlace p) => [
  if (p.category != null) tx(p.category!),
  if (p.opens != null && p.closes != null) t('Mở {opens} - {closes}', {'opens': p.opens, 'closes': p.closes}),
  if (p.isOutdoor == true) t('Ngoài trời'),
  if (p.isOutdoor == false) t('Trong nhà'),
  if (p.requiresBooking == true) t('Cần đặt trước'),
  if (p.rating != null) '★ ${p.rating!.toStringAsFixed(1).replaceAll('.', ',')}',
];

String _km(double v) => '${v.toStringAsFixed(1).replaceAll('.', ',')} km';

/// /ai-drafts/:id: review what the AI changed, edit it in words, save it (web: AiDraftPage).
class AiDraftScreen extends ConsumerStatefulWidget {
  const AiDraftScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<AiDraftScreen> createState() => _AiDraftScreenState();
}

class _AiDraftScreenState extends ConsumerState<AiDraftScreen> {
  AiDraft? _draft;
  Object? _loadError;

  /// What is being saved ('commit', 'checklist', 'route3', a change id…); one edit at a time.
  String? _busy;
  String? _failure;
  final _routeNotes = <int, String>{};

  /// The day shown (dayIndex); 0 shows every day.
  int _day = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final draft = await AiCloneService.get(widget.id);
      if (!mounted) return;
      setState(() {
        _draft = draft;
        _loadError = null;
      });
    } catch (error) {
      if (mounted) setState(() => _loadError = error);
    }
  }

  /// Runs one edit; every edit answers with the whole draft. A refused one reloads it.
  Future<void> _edit(String what, Future<AiDraft> Function() run) async {
    if (_busy != null) return;
    setState(() {
      _busy = what;
      _failure = null;
    });
    try {
      final draft = await run();
      if (mounted) setState(() => _draft = draft);
    } catch (error) {
      if (mounted) setState(() => _failure = errorMessage(error));
      await _load();
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  void _optimize(int day) => _edit('route$day', () async {
    final r = await AiCloneService.optimizeRoute(widget.id, day);
    _routeNotes[day] = r.changed
        ? t('Đã sắp lại tuyến: quãng đường ước tính từ {value} còn {value2}. Bữa ăn giữ nguyên giờ.', {'value': _km(r.beforeKm), 'value2': _km(r.afterKm)})
        : t('Thứ tự hiện tại đã cho tuyến ngắn hơn, nên giữ nguyên.');
    return r.draft;
  });

  Future<void> _save() async {
    if (_busy != null) return;
    setState(() {
      _busy = 'commit';
      _failure = null;
    });
    try {
      final itineraryId = await AiCloneService.commit(widget.id);
      ref.invalidate(myItinerariesProvider);
      if (mounted) context.pushReplacement('/itineraries/$itineraryId');
    } catch (error) {
      if (mounted) setState(() => _failure = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  void _openChat(AiDraft draft) => showAppSheet<void>(
    context,
    title: t('Chỉnh bằng lời'),
    tall: true,
    scroll: false,
    builder: (_) => _ChatSheet(draft: draft, onDraft: (d) => setState(() => _draft = d)),
  );

  @override
  Widget build(BuildContext context) {
    final draft = _draft;
    if (draft == null) {
      return Scaffold(
        appBar: AppBar(leading: const BackOrHome()),
        body: Padding(
          padding: const EdgeInsets.all(kGutter),
          child: _loadError == null
              ? ListView(children: [const Skeleton(height: 34), for (var i = 0; i < 3; i++) ...[const SizedBox(height: 14), const Skeleton(height: 140, radius: AppRadius.lg)]])
              : Center(
                  child: EmptyState(
                    title: t('Không mở được bản nháp'),
                    description: errorMessage(_loadError, t('Bản nháp có thể đã hết hạn.')),
                    action: AppButton(label: t('Về lịch trình của tôi'), variant: ButtonVariant.outline, onPressed: () => context.pushReplacement('/itineraries?tab=cloned')),
                  ),
                ),
        ),
      );
    }

    final committed = draft.committedItineraryId != null;
    final form = draft.form;
    final shown = _day == 0 ? draft.days : draft.days.where((d) => d.dayIndex == _day).toList();
    final season = [
      if (draft.rainy) t('Theo dữ liệu ChillnGo, chuyến đi rơi vào mùa mưa ở {value}: AI ưu tiên điểm trong nhà, và Plan B của điểm ngoài trời là chỗ trong nhà.', {'value': draft.destination ?? t('điểm đến')}),
      if (draft.peak) t('Đang mùa cao điểm: nên đặt phòng và vé sớm.'),
      for (final f in draft.festivals) t('Trong thời gian này có {name} (tháng {month}).', {'name': f.name, 'month': f.month}),
    ];

    return Scaffold(
      appBar: AppBar(
        leading: const BackOrHome(),
        title: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(LucideIcons.sparkles, size: 18, color: AppColors.teal), const SizedBox(width: 8), Text(t('Bản nháp AI'))]),
      ),
      bottomNavigationBar: _BottomBar(
        committed: committed,
        saving: _busy == 'commit',
        busy: _busy != null,
        onChat: () => _openChat(draft),
        onSave: _save,
        onOpen: () => context.push('/itineraries/${draft.committedItineraryId}'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 32),
          children: [
            Text(t('{value} {days} ngày cho {groupSize} người', {'value': draft.destination ?? t('Lịch trình'), 'days': form.days, 'groupSize': form.groupSize}), style: AppText.h1),
            const SizedBox(height: 6),
            Text(
              t('{value} {value2}. Khởi hành {date}.', {'value': draft.sources.length > 1 ? t('Gộp từ các hành trình') : t('Phỏng theo hành trình'), 'value2': draft.sources.map((s) => '“${s.title}”${s.author == null ? '' : t(' của @{author}', {'author': s.author})}').join(', '), 'date': formatLongDate(form.startDate)}),
              style: AppText.meta,
            ),
            if (draft.sources.isNotEmpty)
              Align(
                alignment: Alignment.centerLeft,
                child: TextLink(label: t('Xem hành trình gốc'), icon: LucideIcons.arrowUpRight, onPressed: () => context.push('/posts/${draft.sources.first.postId}')),
              ),
            for (final note in season) _Note(icon: LucideIcons.cloudRain, color: AppColors.teal, text: note),
            const SizedBox(height: 12),
            _CostCard(draft: draft, failure: _failure, busy: _busy != null, onAcceptAll: () => _edit('all', () => AiCloneService.acceptAll(widget.id))),
            const SizedBox(height: 16),
            RouteMap(days: draft.mapDays, height: 220, label: t('Bản đồ các điểm trong bản nháp')),
            const SizedBox(height: 16),
            SegmentTabs<int>(
              items: [(value: 0, label: t('Tất cả'), count: null), for (final d in draft.days) (value: d.dayIndex, label: t('Ngày {dayIndex}', {'dayIndex': d.dayIndex}), count: null)],
              value: _day,
              onChanged: (v) => setState(() => _day = v),
            ),
            for (final d in shown) ...[
              const SizedBox(height: 22),
              Row(
                children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: dayColor(d.dayIndex), shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(t('Ngày {dayIndex}', {'dayIndex': d.dayIndex}), style: AppText.h2)),
                  if (!committed && d.stops.length >= 3)
                    AppButton(
                      label: t('Tối ưu tuyến'),
                      icon: LucideIcons.route,
                      size: ButtonSize.sm,
                      variant: ButtonVariant.outline,
                      loading: _busy == 'route${d.dayIndex}',
                      onPressed: _busy != null ? null : () => _optimize(d.dayIndex),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                t('{date} · ước tính {amount}{value}', {'date': formatLongDate(d.date), 'amount': formatVnd(d.cost), 'value': d.missing > 0 ? t(', {missing} điểm chưa có giá', {'missing': d.missing}) : ''}),
                style: AppText.meta,
              ),
              if (_routeNotes[d.dayIndex] != null) _Note(icon: LucideIcons.route, color: AppColors.teal, text: _routeNotes[d.dayIndex]!),
              if (d.stops.isEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(t('Ngày này chưa có điểm nào.'), style: AppText.meta)),
              for (final (i, stop) in d.stops.indexed)
                _StopCard(
                  stop: stop,
                  order: i + 1,
                  color: dayColor(d.dayIndex),
                  actions: committed ? const [] : _actionsOf(stop),
                  busy: _busy,
                  onAction: (status) => _edit(stop.id, () => AiCloneService.setStatus(widget.id, stop.id, status)),
                ),
            ],
            if (draft.notInPlan.isNotEmpty) ...[
              const SizedBox(height: 26),
              Text(t('Không có trong lịch trình'), style: AppText.h2),
              const SizedBox(height: 4),
              Text(t('Điểm của hành trình gốc mà AI đã bỏ, và gợi ý bạn đã gạt đi. Khôi phục để đưa lại vào lịch trình.'), style: AppText.meta),
              for (final item in draft.notInPlan)
                _StopCard(
                  stop: item,
                  actions: committed ? const [] : _actionsOf(item),
                  busy: _busy,
                  onAction: (status) => _edit(item.id, () => AiCloneService.setStatus(widget.id, item.id, status)),
                ),
            ],
            const SizedBox(height: 26),
            SectionHeader(
              title: t('Chuẩn bị cho chuyến đi'),
              icon: LucideIcons.listChecks,
              iconColor: AppColors.teal,
              action: committed
                  ? null
                  : AppButton(
                      label: draft.checklist == null ? t('Tạo checklist') : t('Tạo lại'),
                      size: ButtonSize.sm,
                      variant: ButtonVariant.outline,
                      loading: _busy == 'checklist',
                      onPressed: _busy != null ? null : () => _edit('checklist', () => AiCloneService.checklist(widget.id)),
                    ),
            ),
            const SizedBox(height: 6),
            Text(
              draft.checklist == null
                  ? t('Đồ cần mang và chỗ cần đặt trước, chọn theo các điểm, mùa và nhóm của bạn. AI chỉ sắp xếp, không thêm mục.')
                  : draft.checklist!.sortedByAi
                  ? t('AI đã sắp theo chuyến đi của bạn, từ danh sách có sẵn của ChillnGo.')
                  : t('Theo thứ tự mặc định của ChillnGo.'),
              style: AppText.meta,
            ),
            if (draft.checklist != null) ChecklistGroups(draft.checklist!),
          ],
        ),
      ),
    );
  }
}

/// A checklist's groups and items (also on a saved itinerary).
class ChecklistGroups extends StatelessWidget {
  const ChecklistGroups(this.checklist, {super.key});

  final Checklist checklist;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      for (final g in checklist.groups) ...[
        const SizedBox(height: 14),
        Text(g.group, style: AppText.label),
        for (final item in g.items) _Note(icon: LucideIcons.check, color: AppColors.teal, text: item),
      ],
    ],
  );
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 15, color: color)),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: AppText.bodySmall.copyWith(color: color == AppColors.teal ? AppColors.body : color))),
      ],
    ),
  );
}

/// Cost against budget, what is left to review, warnings and the last failure.
class _CostCard extends StatelessWidget {
  const _CostCard({required this.draft, required this.failure, required this.busy, required this.onAcceptAll});

  final AiDraft draft;
  final String? failure;
  final bool busy;
  final VoidCallback onAcceptAll;

  @override
  Widget build(BuildContext context) {
    final committed = draft.committedItineraryId != null;
    final budget = draft.budget;
    return AppCard(
      surface: Surface.featured,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(t('Tổng chi phí ước tính'), style: AppText.meta),
          Text(formatVnd(draft.cost), style: AppText.hero.copyWith(color: draft.overBudget ? AppColors.destructive : null)),
          if (budget != null) Text(t('Ngân sách {amount}', {'amount': formatVnd(budget)}), style: AppText.meta),
          const SizedBox(height: 6),
          Text(
            [
              if (draft.overBudget && budget != null) t('Vượt ngân sách {amount}.', {'amount': formatVnd(draft.cost - budget)}),
              draft.costMissing > 0 ? t('{costMissing} điểm chưa có dữ liệu giá, chưa tính vào tổng.', {'costMissing': draft.costMissing}) : t('Tính từ giá trung bình trong dữ liệu ChillnGo nhân số người.'),
            ].join(' '),
            style: AppText.meta.copyWith(color: draft.overBudget ? AppColors.destructive : null),
          ),
          Text(t('Bản nháp tự xoá sau 24 giờ, lúc {time}.', {'time': formatDateTime(draft.expiresAt)}), style: AppText.meta),
          for (final w in draft.warnings) _Note(icon: LucideIcons.triangleAlert, color: AppColors.ochre, text: w),
          if (!committed) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: Text(draft.pendingCount > 0 ? t('Còn {n} thay đổi chờ duyệt', {'n': draft.pendingCount}) : t('Đã duyệt hết thay đổi'), style: AppText.label)),
                AppButton(
                  label: t('Chấp nhận tất cả'),
                  icon: LucideIcons.checkCheck,
                  size: ButtonSize.sm,
                  variant: ButtonVariant.outline,
                  onPressed: busy || draft.pendingCount == 0 ? null : onAcceptAll,
                ),
              ],
            ),
          ],
          if (failure != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(failure!, style: AppText.bodySmall.copyWith(color: AppColors.destructive))),
        ],
      ),
    );
  }
}

/// One stop: photo, numbered name in its day's colour (as on the map), cost, facts, the AI's reason, its buttons.
class _StopCard extends StatelessWidget {
  const _StopCard({required this.stop, this.order, this.color, required this.actions, required this.busy, required this.onAction});

  final AiChange stop;

  /// Null for a stop not in the plan.
  final int? order;
  final Color? color;
  final List<(String, String, IconData)> actions;
  final String? busy;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final place = stop.place;
    final (label, tone) = _labelOf(stop);
    final cost = place.cost == null ? t('Chưa có dữ liệu') : place.cost == 0 ? t('Miễn phí') : formatVnd(place.cost!);
    final costNote = place.costBasis == 'perPerson' && place.avgCost != null
        ? t('{amount}/người', {'amount': formatVnd(place.avgCost!)})
        : place.costBasis == 'author'
        ? t('theo chi phí tác giả ghi')
        : null;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: AppCard(
        accent: tone,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (order != null && place.photoUrl != null) ...[NetImage(place.photoUrl, height: 140, radius: AppRadius.md), const SizedBox(height: 12)],
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(children: [
                      if (order != null) TextSpan(text: '$order. ', style: TextStyle(color: color)),
                      TextSpan(text: place.name),
                    ]),
                    style: AppText.h3,
                  ),
                ),
                const SizedBox(width: 10),
                AppBadge(label, tone: BadgeTone.outline),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [if (order != null) '${stop.startTime} - ${stop.endTime}', ..._factsOf(place), if (stop.status == 'accepted' && stop.type != 'keep') t('đã chấp nhận')].join(' · '),
              style: AppText.meta,
            ),
            if (order != null) Text([cost, ?costNote].join(', '), style: AppText.bodySmall.copyWith(color: AppColors.cream, fontWeight: FontWeight.w600)),
            if (stop.type == 'replace' && stop.status != 'reverted' && stop.original != null)
              Text.rich(TextSpan(children: [const TextSpan(text: 'Thay cho '), TextSpan(text: stop.original!.name, style: const TextStyle(decoration: TextDecoration.lineThrough))]), style: AppText.meta),
            // A reverted change is the user's call: the AI's reason for it no longer applies.
            if (stop.reason.isNotEmpty && stop.status != 'reverted') ...[const SizedBox(height: 8), Text(stop.reason, style: AppText.bodySmall)],
            if (stop.planB != null) _Note(icon: LucideIcons.cornerDownRight, color: AppColors.meta, text: 'Plan B: ${stop.planB!.name}. ${stop.planB!.reason}'),
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final (text, status, icon) in actions)
                    AppButton(
                      label: text,
                      icon: icon,
                      size: ButtonSize.sm,
                      variant: ButtonVariant.outline,
                      loading: busy == stop.id && status == actions.last.$2,
                      onPressed: busy != null ? null : () => onAction(status),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.committed, required this.saving, required this.busy, required this.onChat, required this.onSave, required this.onOpen});

  final bool committed;
  final bool saving;
  final bool busy;
  final VoidCallback onChat;
  final VoidCallback onSave;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(color: AppColors.surface, border: Border(top: BorderSide(color: AppColors.border))),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 10),
        child: committed
            ? AppButton(label: t('Đã lưu, mở lịch trình'), icon: LucideIcons.checkCheck, fullWidth: true, onPressed: onOpen)
            : Row(
                children: [
                  Expanded(child: AppButton(label: t('Chỉnh bằng lời'), icon: LucideIcons.messageSquare, variant: ButtonVariant.outline, onPressed: busy ? null : onChat)),
                  const SizedBox(width: 10),
                  Expanded(child: AppButton(label: t('Lưu lịch trình'), icon: LucideIcons.save, loading: saving, onPressed: busy ? null : onSave)),
                ],
              ),
      ),
    ),
  );
}

/// Requests people often make; a tap puts one in the box, it does not spend a request.
List<String> get _suggestions => [t('Rẻ hơn một chút'), t('Thêm một quán ăn địa phương'), t('Thêm điểm trong nhà phòng khi mưa'), t('Bớt một điểm để đi thong thả hơn')];

/// Edit the draft in words (web: ChatPanel). Each message is one AI request.
class _ChatSheet extends StatefulWidget {
  const _ChatSheet({required this.draft, required this.onDraft});

  final AiDraft draft;
  final ValueChanged<AiDraft> onDraft;

  @override
  State<_ChatSheet> createState() => _ChatSheetState();
}

class _ChatSheetState extends State<_ChatSheet> {
  late AiDraft _draft = widget.draft;
  final _text = TextEditingController();
  String? _sending;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final message = _text.text.trim();
    if (message.isEmpty || _sending != null || _draft.callsLeft == 0) return;
    setState(() {
      _sending = message;
      _error = null;
    });
    _text.clear();
    try {
      final draft = await AiCloneService.chat(_draft.id, message);
      widget.onDraft(draft);
      if (mounted) setState(() => _draft = draft);
    } catch (error) {
      // Give the text back so a failed message can be resent without retyping it.
      if (mounted) {
        setState(() => _error = errorMessage(error));
        if (_text.text.isEmpty) _text.text = message;
      }
    } finally {
      if (mounted) setState(() => _sending = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sending = _sending;
    final items = [
      ChatBubble(mine: false, child: Text(t('Ví dụ: “Bỏ chợ đêm, thêm một quán cà phê sáng ngày 2”. AI chỉ chọn địa điểm có trong dữ liệu ChillnGo.'), style: AppText.meta)),
      for (final m in _draft.chat) ChatBubble(mine: m.mine, text: m.text),
      if (sending != null) ...[ChatBubble(mine: true, text: sending), ChatPending(t('AI đang sửa lịch trình…'))],
      if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: AppText.bodySmall.copyWith(color: AppColors.destructive))),
    ];
    return Column(
      children: [
        Expanded(
          // Newest at the bottom, in view, as messages arrive.
          child: ListView(reverse: true, children: items.reversed.toList()),
        ),
        if (sending == null)
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final s in _suggestions) Padding(padding: const EdgeInsets.only(right: 8, bottom: 8), child: AppChip(label: s, icon: LucideIcons.plus, onTap: () => _text.text = s)),
              ],
            ),
          ),
        ChatComposer(controller: _text, hint: t('Bạn muốn đổi gì?'), enabled: sending == null && _draft.callsLeft > 0, onSend: _send),
        const SizedBox(height: 6),
        Text(t('Mỗi tin nhắn dùng một lượt AI, còn {callsLeft}/{dailyLimit} lượt hôm nay.', {'callsLeft': _draft.callsLeft, 'dailyLimit': _draft.dailyLimit}), style: AppText.meta.copyWith(fontSize: 12)),
      ],
    );
  }
}
