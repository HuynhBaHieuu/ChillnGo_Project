import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/trip_chat.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/ai_clone_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/chat.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';
import '../../core/i18n.dart';

Map<String, String> get paceLabels => {'relaxed': t('Thong thả'), 'moderate': t('Vừa phải'), 'packed': t('Dày đặc')};

Map<Slot, String> get _questions => {
  Slot.date: t('Bạn định khởi hành ngày nào?'),
  Slot.days: t('Chuyến đi mấy ngày? Hành trình gốc là {n} ngày.'),
  Slot.group: t('Đi mấy người? Có trẻ em hay người lớn tuổi không?'),
  Slot.budget: t('Tổng ngân sách cho cả nhóm khoảng bao nhiêu?'),
  Slot.departure: t('Bạn xuất phát từ đâu?'),
  Slot.interests: t('Bạn thích kiểu điểm nào? Chọn một hoặc vài mục rồi bấm Xong.'),
  Slot.pace: t('Bạn muốn đi với nhịp độ nào?'),
  Slot.merge: t('Có hành trình khác cùng điểm đến. Bạn muốn AI gộp thêm (tối đa 2) không?'),
};

/// What to type when a reply was not understood.
Map<Slot, String> get _examples => {Slot.date: '20/11', Slot.days: t('3 ngày (1 đến 14)'), Slot.group: t('4 người, có trẻ em'), Slot.budget: t('5 triệu'), Slot.departure: 'TP.HCM', Slot.pace: t('thong thả')};

Map<Slot, String> get _labels => {
  Slot.date: t('Ngày khởi hành'),
  Slot.days: t('Số ngày'),
  Slot.group: t('Số người'),
  Slot.budget: t('Ngân sách'),
  Slot.departure: t('Điểm xuất phát'),
  Slot.interests: t('Sở thích'),
  Slot.pace: t('Nhịp độ'),
  Slot.merge: t('Gộp hành trình'),
};

/// Shown in turn while the AI works, so a minute of waiting says what is happening.
List<String> get _steps => [t('Đang đọc hành trình gốc…'), t('Đang chọn địa điểm từ dữ liệu ChillnGo…'), t('Đang xếp giờ cho từng ngày…'), t('Đang kiểm tra chi phí và giờ giấc…')];

typedef _Chip = ({String label, Map<String, Object?>? answers, String? says, bool? pressed, VoidCallback? onToggle});

/// /posts/:id/ai-clone: clone with AI as a chat (web: AiCloneDialog). It asks
/// for dates, group, budget, interests and pace one at a time, with quick
/// replies, and reads free text ("3 ngày, 4 người có trẻ em, 5 triệu"). The
/// questions are asked here, not by the AI, so only "Tạo bản nháp" spends an
/// AI request; unanswered questions take their defaults.
class AiCloneScreen extends ConsumerStatefulWidget {
  const AiCloneScreen({super.key, required this.postId});

  final String postId;

  @override
  ConsumerState<AiCloneScreen> createState() => _AiCloneScreenState();
}

class _AiCloneScreenState extends ConsumerState<AiCloneScreen> {
  late final Future<AiCloneOptions> _options = AiCloneService.getOptions(widget.postId);
  final _text = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <({bool mine, String text})>[];
  Map<String, Object?> _answers = {};
  final _settled = <Slot>{};
  final _mergeWith = <String>[];
  bool _creating = false;
  double _progress = 0;
  Timer? _ticker;
  String? _error;

  @override
  void dispose() {
    _ticker?.cancel();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  List<Slot> _slots(AiCloneOptions o) => [
    Slot.date, Slot.days, Slot.group, Slot.budget, Slot.departure,
    if (o.interests.isNotEmpty) Slot.interests,
    Slot.pace,
    if (o.mergeable.isNotEmpty) Slot.merge,
  ];

  AiCloneForm _form(TripPost post, [Map<String, Object?>? answers]) =>
      AiCloneForm.from(answers ?? _answers, startDate: nextWeek(DateTime.now()), days: post.days.length);

  String _question(Slot? slot, TripPost post) =>
      slot == null ? t('Đủ thông tin rồi! Bấm “Tạo bản nháp” để AI bắt đầu, hoặc nhắn thêm nếu muốn đổi gì.') : _questions[slot]!.replaceAll('{n}', '${post.days.length}');

  /// A slot's answer as the chat shows it.
  String _valueOf(Slot slot, AiCloneForm f, AiCloneOptions o) => switch (slot) {
    Slot.date => formatShortDate(f.startDate),
    Slot.days => t('{days} ngày', {'days': f.days}),
    Slot.group => ['${f.groupSize}', if (f.withChildren) t('Có trẻ em'), if (f.withElderly) t('Có người lớn tuổi')].join(', '),
    Slot.budget => f.budget == null ? t('Không giới hạn') : formatVnd(f.budget!),
    Slot.departure => f.departure.isEmpty ? t('Bỏ qua') : f.departure,
    Slot.interests => f.interests.isEmpty ? t('Tất cả') : f.interests.map((v) => tx(o.interests.where((i) => i.value == v).firstOrNull?.label ?? v)).join(', '),
    Slot.pace => paceLabels[f.pace] ?? '',
    Slot.merge => _mergeWith.isEmpty ? t('Không gộp') : _mergeWith.map((id) => o.mergeable.where((j) => j.postId == id).firstOrNull?.title ?? '').join(', '),
  };

  /// What ChillnGo's season data says about these dates; nothing without data.
  List<String> _seasonNotes(AiCloneForm f, AiCloneOptions o) {
    final start = fromDateOnly(f.startDate);
    final months = {for (var i = 0; i < f.days.clamp(1, 14); i++) start.add(Duration(days: i)).month};
    return [
      if (months.any(o.rainyMonths.contains)) t('Theo dữ liệu ChillnGo, {value} đang vào mùa mưa: AI sẽ ưu tiên điểm trong nhà.', {'value': o.destination ?? t('điểm đến')}),
      if (months.any(o.peakMonths.contains)) t('Đang mùa cao điểm: nên đặt phòng và vé sớm.'),
      for (final fest in o.festivals)
        if (months.contains(fest.month)) t('Có {name} (tháng {month}).', {'name': fest.name, 'month': fest.month}),
    ];
  }

  /// One reply: a chip ([given]) settles the question asked; typed text settles every question it answers.
  void _reply(String raw, TripPost post, AiCloneOptions o, [Map<String, Object?>? given]) {
    final said = raw.trim();
    if (said.isEmpty || _creating) return;
    final slots = _slots(o);
    final asking = slots.where((s) => !_settled.contains(s)).firstOrNull;
    // Interests are named in Vietnamese by the API, and in the reader's language on screen: either reads.
    final interests = [...o.interests, for (final i in o.interests) (value: i.value, label: tx(i.label))];
    final parsed = given ?? parseTripReply(said, asking, interests, DateTime.now());
    final skipped = given == null && asking != null && skipReply.hasMatch(said.toLowerCase());
    final next = {..._answers, ...parsed};
    final form = _form(post, next);

    final bot = <String>[];
    if (given == null && !skipped && parsed.isEmpty) {
      final example = _examples[asking];
      bot.add(example == null ? t('Mình chưa hiểu ý bạn. Hãy chọn một gợi ý bên dưới.') : t('Mình chưa hiểu ý bạn. Hãy chọn một gợi ý bên dưới, hoặc nhắn kiểu: “{example}”.', {'example': example}));
    } else {
      if (given == null && parsed.isNotEmpty) {
        final touched = {for (final k in parsed.keys) slotOf[k]!};
        bot.add(t('Đã ghi: {value}.', {'value': touched.map((s) => '${_labels[s]} ${_valueOf(s, form, o)}').join('; ')}));
      }
      if (parsed.containsKey('startDate') || parsed.containsKey('days')) {
        bot.addAll(_seasonNotes(form, o).where((note) => !_messages.any((m) => m.text == note)));
      }
    }

    setState(() {
      _answers = next;
      _settled.addAll(parsed.keys.map((k) => slotOf[k]!));
      if (asking != null && (given != null || skipped)) _settled.add(asking);
      // The question just answered stays above its answer; the next one is asked below.
      _messages.addAll([
        if (asking != null) (mine: false, text: _question(asking, post)),
        (mine: true, text: said),
        for (final b in bot) (mine: false, text: b),
      ]);
      _text.clear();
    });
    _toBottom();
  }

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  });

  List<_Chip> _chips(Slot? slot, TripPost post, AiCloneOptions o) {
    _Chip chip(String label, [Map<String, Object?>? answers]) => (label: label, answers: answers, says: null, pressed: null, onToggle: null);
    final today = DateTime.now();
    switch (slot) {
      case Slot.date:
        final week = nextWeek(today), weekend = thisWeekend(today);
        return [chip(t('Tuần sau ({date})', {'date': formatShortDate(week)}), {'startDate': week}), chip(t('Cuối tuần này ({date})', {'date': formatShortDate(weekend)}), {'startDate': weekend})];
      case Slot.days:
        final n = post.days.length;
        return [for (final d in [n - 1, n, n + 1]) if (d >= 1 && d <= 14) chip(t('{d} ngày', {'d': d}), {'days': d})];
      case Slot.group:
        return [
          chip(t('Một mình'), {'groupSize': 1, 'withChildren': false, 'withElderly': false}),
          chip(t('Cặp đôi'), {'groupSize': 2, 'withChildren': false, 'withElderly': false}),
          chip(t('Gia đình 4 người, có trẻ em'), {'groupSize': 4, 'withChildren': true}),
          chip(t('Nhóm bạn 4 người'), {'groupSize': 4, 'withChildren': false, 'withElderly': false}),
        ];
      case Slot.budget:
        return [chip(t('Không giới hạn'), {'budget': null}), for (final b in [3000000, 5000000, 10000000]) chip(formatVnd(b), {'budget': b})];
      case Slot.departure:
        return [for (final c in ['TP.HCM', t('Hà Nội'), t('Đà Nẵng')]) chip(c, {'departure': c}), chip(t('Bỏ qua'), {})];
      case Slot.interests:
        final picked = (_answers['interests'] as List<String>?) ?? const <String>[];
        return [
          for (final i in o.interests)
            (
              label: tx(i.label),
              answers: null,
              says: null,
              pressed: picked.contains(i.value),
              onToggle: () => setState(
                () => _answers = {..._answers, 'interests': picked.contains(i.value) ? [...picked.where((v) => v != i.value)] : [...picked, i.value]},
              ),
            ),
          (label: picked.isEmpty ? t('Tất cả') : 'Xong', answers: {'interests': picked}, says: _valueOf(Slot.interests, _form(post), o), pressed: null, onToggle: null),
        ];
      case Slot.pace:
        return [for (final p in paceLabels.entries) chip(p.value, {'pace': p.key})];
      case Slot.merge:
        return [
          for (final j in o.mergeable)
            (
              label: t('{title} · {days} ngày', {'title': j.title, 'days': j.days}),
              answers: null,
              says: null,
              pressed: _mergeWith.contains(j.postId),
              onToggle: () => setState(() {
                if (!_mergeWith.remove(j.postId) && _mergeWith.length < 2) _mergeWith.add(j.postId);
              }),
            ),
          (label: _mergeWith.isEmpty ? t('Không gộp') : 'Xong', answers: <String, Object?>{}, says: _valueOf(Slot.merge, _form(post), o), pressed: null, onToggle: null),
        ];
      case null:
        return [];
    }
  }

  Future<void> _create(TripPost post) async {
    if (_creating) return;
    // ponytail: the server reports no progress, so this guesses from the time
    // waited (about 67% at 30 s, 90% at 60 s), held at 95% until the draft arrives.
    final started = DateTime.now();
    setState(() {
      _creating = true;
      _progress = 0;
      _error = null;
    });
    _ticker = Timer.periodic(const Duration(milliseconds: 400), (_) {
      if (mounted) setState(() => _progress = 0.95 * (1 - math.exp(-DateTime.now().difference(started).inMilliseconds / 25000)));
    });
    _toBottom();
    try {
      final draft = await AiCloneService.create(widget.postId, _form(post), mergeWith: _mergeWith);
      if (mounted) context.pushReplacement('/ai-drafts/${draft.id}');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      _ticker?.cancel();
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final post = ref.watch(postProvider(widget.postId));
    return PopScope(
      // The AI is already working on it: leaving now would only lose the result.
      canPop: !_creating,
      child: Scaffold(
        appBar: AppBar(
          leading: AppIconButton(icon: LucideIcons.x, label: t('Đóng'), onPressed: _creating ? null : () => context.pop()),
          title: Text(t('Sao chép bằng AI')),
        ),
        body: FutureBuilder(
          future: _options,
          builder: (context, options) {
            if (options.hasError || post.hasError) {
              return Padding(padding: const EdgeInsets.all(kGutter), child: Center(child: ErrorPanel(error: options.error ?? post.error)));
            }
            final o = options.data, p = post.value;
            if (o == null || p == null) return LoadingView(message: t('Đang chuẩn bị…'));
            return _chat(p, o);
          },
        ),
      ),
    );
  }

  Widget _chat(TripPost post, AiCloneOptions o) {
    final slots = _slots(o);
    final asking = slots.where((s) => !_settled.contains(s)).firstOrNull;
    final step = _steps[_progress < 0.2 ? 0 : _progress < 0.45 ? 1 : _progress < 0.7 ? 2 : 3];

    return Column(
      children: [
        Expanded(
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 16),
            children: [
              Text(t('AI chỉ dùng địa điểm, giá và giờ mở cửa có trong dữ liệu ChillnGo; chỗ nào thiếu sẽ ghi “chưa có dữ liệu”.'), style: AppText.meta, textAlign: TextAlign.center),
              const SizedBox(height: 18),
              ChatBubble(mine: false, text: t('Chào bạn! Mình sẽ điều chỉnh “{title}” cho chuyến đi của bạn. Cứ nhắn tự nhiên, hoặc chọn gợi ý bên dưới nhé.', {'title': post.title})),
              if (o.destination == null)
                ChatBubble(mine: false, text: t('ChillnGo chưa có dữ liệu địa điểm cho nơi này, nên AI chỉ sắp xếp lại các điểm có sẵn trong hành trình gốc.')),
              for (final m in _messages) ChatBubble(mine: m.mine, text: m.text),
              if (_creating)
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(step, style: AppText.h3),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        child: LinearProgressIndicator(value: _progress, minHeight: 6, color: AppColors.teal, backgroundColor: AppColors.well),
                      ),
                      const SizedBox(height: 10),
                      Text(t('Thường mất từ 20 giây đến một phút. Đừng rời màn hình này nhé.'), style: AppText.meta),
                    ],
                  ),
                )
              else ...[
                Text(_question(asking, post), style: AppText.label),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final chip in _chips(asking, post, o))
                      AppChip(
                        label: chip.label,
                        selected: chip.pressed ?? false,
                        icon: chip.pressed == true ? LucideIcons.check : LucideIcons.plus,
                        onTap: () => chip.onToggle != null ? chip.onToggle!() : _reply(chip.says ?? chip.label, post, o, chip.answers ?? {}),
                      ),
                    if (asking == Slot.date)
                      AppChip(
                        label: t('Chọn ngày khác'),
                        icon: LucideIcons.calendar,
                        onTap: () async {
                          final today = DateTime.now();
                          final picked = await showDatePicker(context: context, firstDate: today, lastDate: DateTime(today.year + 2), cancelText: t('Huỷ'), confirmText: t('Chọn'));
                          if (picked != null) _reply(formatShortDate(toDateOnly(picked)), post, o, {'startDate': toDateOnly(picked)});
                        },
                      ),
                  ],
                ),
              ],
              if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error)],
              if (o.callsLeft == 0) ...[const SizedBox(height: 12), ErrorText(t('Bạn đã dùng hết lượt AI hôm nay. Hãy quay lại vào ngày mai nhé.'))],
            ],
          ),
        ),
        DecoratedBox(
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ChatComposer(
                    controller: _text,
                    hint: t('Ví dụ: 3 ngày, 4 người có trẻ em, 5 triệu'),
                    maxLength: 300,
                    enabled: !_creating,
                    onSend: () => _reply(_text.text, post, o),
                  ),
                  const SizedBox(height: 8),
                  AppButton(
                    label: _creating ? t('AI đang tạo bản nháp…') : _mergeWith.isEmpty ? t('Tạo bản nháp') : t('Gộp và tạo bản nháp'),
                    icon: LucideIcons.sparkles,
                    loading: _creating,
                    fullWidth: true,
                    onPressed: o.callsLeft == 0 ? null : () => _create(post),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    t('Đã có {value}/{n} mục, còn {callsLeft}/{dailyLimit} lượt AI hôm nay. Mục chưa trả lời sẽ dùng mặc định.', {'value': slots.where(_settled.contains).length, 'n': slots.length, 'callsLeft': o.callsLeft, 'dailyLimit': o.dailyLimit}),
                    style: AppText.meta.copyWith(fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
