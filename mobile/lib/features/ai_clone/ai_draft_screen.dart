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

/// What a change did, and its colour in the diff.
(String, Color) _labelOf(AiChange c) => switch ((c.type, c.status)) {
  ('keep', _) => ('Giữ nguyên', AppColors.sage),
  ('replace', 'reverted') => ('Dùng điểm gốc', AppColors.sage),
  ('replace', _) => ('Thay thế', AppColors.ochre),
  ('add', 'reverted') => ('Bạn đã bỏ', AppColors.meta),
  ('add', _) => ('Thêm mới', AppColors.teal),
  (_, 'reverted') => ('Khôi phục', AppColors.sage),
  _ => ('Đã bỏ', AppColors.destructive),
};

/// The buttons a change offers in its current state: label, the status it sets, icon.
List<(String, String, IconData)> _actionsOf(AiChange c) {
  final pending = c.status == 'pending';
  return switch ((c.type, c.status)) {
    ('keep', _) => [],
    ('replace', 'reverted') => [('Dùng gợi ý AI', 'pending', LucideIcons.sparkles)],
    ('replace', _) => [if (pending) ('Chấp nhận', 'accepted', LucideIcons.check), ('Hoàn tác', 'reverted', LucideIcons.undo2)],
    ('add', 'reverted') => [('Thêm lại', 'pending', LucideIcons.rotateCcw)],
    ('add', _) => [if (pending) ('Chấp nhận', 'accepted', LucideIcons.check), ('Bỏ điểm này', 'reverted', LucideIcons.undo2)],
    (_, 'reverted') => [('Bỏ lại', 'pending', LucideIcons.undo2)],
    _ => [if (pending) ('Đồng ý bỏ', 'accepted', LucideIcons.check), ('Khôi phục', 'reverted', LucideIcons.rotateCcw)],
  };
}

/// Facts ChillnGo has about a place; unknown ones are left out.
List<String> _factsOf(AiPlace p) => [
  ?p.category,
  if (p.opens != null && p.closes != null) 'Mở ${p.opens} - ${p.closes}',
  if (p.isOutdoor == true) 'Ngoài trời',
  if (p.isOutdoor == false) 'Trong nhà',
  if (p.requiresBooking == true) 'Cần đặt trước',
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
        ? 'Đã sắp lại tuyến: quãng đường ước tính từ ${_km(r.beforeKm)} còn ${_km(r.afterKm)}. Bữa ăn giữ nguyên giờ.'
        : 'Thứ tự hiện tại đã cho tuyến ngắn hơn, nên giữ nguyên.';
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
    title: 'Chỉnh bằng lời',
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
                    title: 'Không mở được bản nháp',
                    description: errorMessage(_loadError, 'Bản nháp có thể đã hết hạn.'),
                    action: AppButton(label: 'Về lịch trình của tôi', variant: ButtonVariant.outline, onPressed: () => context.pushReplacement('/itineraries?tab=cloned')),
                  ),
                ),
        ),
      );
    }

    final committed = draft.committedItineraryId != null;
    final form = draft.form;
    final shown = _day == 0 ? draft.days : draft.days.where((d) => d.dayIndex == _day).toList();
    final season = [
      if (draft.rainy) 'Theo dữ liệu ChillnGo, chuyến đi rơi vào mùa mưa ở ${draft.destination ?? 'điểm đến'}: AI ưu tiên điểm trong nhà, và Plan B của điểm ngoài trời là chỗ trong nhà.',
      if (draft.peak) 'Đang mùa cao điểm: nên đặt phòng và vé sớm.',
      for (final f in draft.festivals) 'Trong thời gian này có ${f.name} (tháng ${f.month}).',
    ];

    return Scaffold(
      appBar: AppBar(
        leading: const BackOrHome(),
        title: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(LucideIcons.sparkles, size: 18, color: AppColors.teal), const SizedBox(width: 8), const Text('Bản nháp AI')]),
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
            Text('${draft.destination ?? 'Lịch trình'} ${form.days} ngày cho ${form.groupSize} người', style: AppText.h1),
            const SizedBox(height: 6),
            Text(
              '${draft.sources.length > 1 ? 'Gộp từ các hành trình' : 'Phỏng theo hành trình'} '
              '${draft.sources.map((s) => '“${s.title}”${s.author == null ? '' : ' của @${s.author}'}').join(', ')}. Khởi hành ${formatLongDate(form.startDate)}.',
              style: AppText.meta,
            ),
            if (draft.sources.isNotEmpty)
              Align(
                alignment: Alignment.centerLeft,
                child: TextLink(label: 'Xem hành trình gốc', icon: LucideIcons.arrowUpRight, onPressed: () => context.push('/posts/${draft.sources.first.postId}')),
              ),
            for (final note in season) _Note(icon: LucideIcons.cloudRain, color: AppColors.teal, text: note),
            const SizedBox(height: 12),
            _CostCard(draft: draft, failure: _failure, busy: _busy != null, onAcceptAll: () => _edit('all', () => AiCloneService.acceptAll(widget.id))),
            const SizedBox(height: 16),
            RouteMap(days: draft.mapDays, height: 220, label: 'Bản đồ các điểm trong bản nháp'),
            const SizedBox(height: 16),
            SegmentTabs<int>(
              items: [(value: 0, label: 'Tất cả', count: null), for (final d in draft.days) (value: d.dayIndex, label: 'Ngày ${d.dayIndex}', count: null)],
              value: _day,
              onChanged: (v) => setState(() => _day = v),
            ),
            for (final d in shown) ...[
              const SizedBox(height: 22),
              Row(
                children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: dayColor(d.dayIndex), shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Ngày ${d.dayIndex}', style: AppText.h2)),
                  if (!committed && d.stops.length >= 3)
                    AppButton(
                      label: 'Tối ưu tuyến',
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
                '${formatLongDate(d.date)} · ước tính ${formatVnd(d.cost)}${d.missing > 0 ? ', ${d.missing} điểm chưa có giá' : ''}',
                style: AppText.meta,
              ),
              if (_routeNotes[d.dayIndex] != null) _Note(icon: LucideIcons.route, color: AppColors.teal, text: _routeNotes[d.dayIndex]!),
              if (d.stops.isEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text('Ngày này chưa có điểm nào.', style: AppText.meta)),
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
              Text('Không có trong lịch trình', style: AppText.h2),
              const SizedBox(height: 4),
              Text('Điểm của hành trình gốc mà AI đã bỏ, và gợi ý bạn đã gạt đi. Khôi phục để đưa lại vào lịch trình.', style: AppText.meta),
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
              title: 'Chuẩn bị cho chuyến đi',
              icon: LucideIcons.listChecks,
              iconColor: AppColors.teal,
              action: committed
                  ? null
                  : AppButton(
                      label: draft.checklist == null ? 'Tạo checklist' : 'Tạo lại',
                      size: ButtonSize.sm,
                      variant: ButtonVariant.outline,
                      loading: _busy == 'checklist',
                      onPressed: _busy != null ? null : () => _edit('checklist', () => AiCloneService.checklist(widget.id)),
                    ),
            ),
            const SizedBox(height: 6),
            Text(
              draft.checklist == null
                  ? 'Đồ cần mang và chỗ cần đặt trước, chọn theo các điểm, mùa và nhóm của bạn. AI chỉ sắp xếp, không thêm mục.'
                  : draft.checklist!.sortedByAi
                  ? 'AI đã sắp theo chuyến đi của bạn, từ danh sách có sẵn của ChillnGo.'
                  : 'Theo thứ tự mặc định của ChillnGo.',
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
          Text('Tổng chi phí ước tính', style: AppText.meta),
          Text(formatVnd(draft.cost), style: AppText.hero.copyWith(color: draft.overBudget ? AppColors.destructive : null)),
          if (budget != null) Text('Ngân sách ${formatVnd(budget)}', style: AppText.meta),
          const SizedBox(height: 6),
          Text(
            [
              if (draft.overBudget && budget != null) 'Vượt ngân sách ${formatVnd(draft.cost - budget)}.',
              draft.costMissing > 0 ? '${draft.costMissing} điểm chưa có dữ liệu giá, chưa tính vào tổng.' : 'Tính từ giá trung bình trong dữ liệu ChillnGo nhân số người.',
            ].join(' '),
            style: AppText.meta.copyWith(color: draft.overBudget ? AppColors.destructive : null),
          ),
          Text('Bản nháp tự xoá sau 24 giờ, lúc ${formatDateTime(draft.expiresAt)}.', style: AppText.meta),
          for (final w in draft.warnings) _Note(icon: LucideIcons.triangleAlert, color: AppColors.ochre, text: w),
          if (!committed) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: Text(draft.pendingCount > 0 ? 'Còn ${draft.pendingCount} thay đổi chờ duyệt' : 'Đã duyệt hết thay đổi', style: AppText.label)),
                AppButton(
                  label: 'Chấp nhận tất cả',
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
    final cost = place.cost == null ? 'Chưa có dữ liệu' : place.cost == 0 ? 'Miễn phí' : formatVnd(place.cost!);
    final costNote = place.costBasis == 'perPerson' && place.avgCost != null
        ? '${formatVnd(place.avgCost!)}/người'
        : place.costBasis == 'author'
        ? 'theo chi phí tác giả ghi'
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
              [if (order != null) '${stop.startTime} - ${stop.endTime}', ..._factsOf(place), if (stop.status == 'accepted' && stop.type != 'keep') 'đã chấp nhận'].join(' · '),
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
            ? AppButton(label: 'Đã lưu, mở lịch trình', icon: LucideIcons.checkCheck, fullWidth: true, onPressed: onOpen)
            : Row(
                children: [
                  Expanded(child: AppButton(label: 'Chỉnh bằng lời', icon: LucideIcons.messageSquare, variant: ButtonVariant.outline, onPressed: busy ? null : onChat)),
                  const SizedBox(width: 10),
                  Expanded(child: AppButton(label: 'Lưu lịch trình', icon: LucideIcons.save, loading: saving, onPressed: busy ? null : onSave)),
                ],
              ),
      ),
    ),
  );
}

/// Requests people often make; a tap puts one in the box, it does not spend a request.
const _suggestions = ['Rẻ hơn một chút', 'Thêm một quán ăn địa phương', 'Thêm điểm trong nhà phòng khi mưa', 'Bớt một điểm để đi thong thả hơn'];

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
      ChatBubble(mine: false, child: Text('Ví dụ: “Bỏ chợ đêm, thêm một quán cà phê sáng ngày 2”. AI chỉ chọn địa điểm có trong dữ liệu ChillnGo.', style: AppText.meta)),
      for (final m in _draft.chat) ChatBubble(mine: m.mine, text: m.text),
      if (sending != null) ...[ChatBubble(mine: true, text: sending), const ChatPending('AI đang sửa lịch trình…')],
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
        ChatComposer(controller: _text, hint: 'Bạn muốn đổi gì?', enabled: sending == null && _draft.callsLeft > 0, onSend: _send),
        const SizedBox(height: 6),
        Text('Mỗi tin nhắn dùng một lượt AI, còn ${_draft.callsLeft}/${_draft.dailyLimit} lượt hôm nay.', style: AppText.meta.copyWith(fontSize: 12)),
      ],
    );
  }
}
