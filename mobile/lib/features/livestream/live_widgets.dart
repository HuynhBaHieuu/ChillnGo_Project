import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/livestream_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import 'live_format.dart';

const _commentMax = 300;

/// The chat under the video (web: LiveComments). New comments appear at the bottom.
class LiveComments extends StatefulWidget {
  const LiveComments({
    super.key,
    required this.comments,
    required this.onSend,
    required this.disabled,
    this.disabledReason,
    required this.hostId,
    this.meId,
    this.onDelete,
    this.onBlock,
    this.height = 380,
  });

  final List<LiveComment> comments;

  /// Completes when the server accepted it; throws with a message to show.
  final Future<void> Function(String text) onSend;

  /// Stream over, or signed out: read only.
  final bool disabled;
  final String? disabledReason;
  final String hostId;
  final String? meId;

  /// Delete a comment: the host may delete any, others only their own.
  final void Function(LiveComment comment)? onDelete;

  /// Host only: remove this person from the stream.
  final void Function(LiveComment comment)? onBlock;
  final double height;

  @override
  State<LiveComments> createState() => _LiveCommentsState();
}

class _LiveCommentsState extends State<LiveComments> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;
  String? _error;

  /// Keep the newest comment in view, unless the reader scrolled up to read older ones.
  bool _pinned = true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (!_scroll.hasClients) return;
      _pinned = _scroll.position.maxScrollExtent - _scroll.offset < 40;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _toBottom());
  }

  @override
  void didUpdateWidget(LiveComments oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.comments.length != oldWidget.comments.length && _pinned) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _toBottom());
    }
  }

  void _toBottom() {
    if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
  }

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final value = _text.text.trim();
    if (value.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.onSend(value);
      _text.clear();
      _pinned = true;
    } catch (error) {
      setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _menu(LiveComment comment) async {
    final isHost = widget.meId != null && widget.meId == widget.hostId;
    final choice = await showActionSheet<String>(
      context,
      title: 'Bình luận của ${comment.author.displayName}',
      actions: [
        const MenuAction('delete', 'Xoá bình luận', icon: LucideIcons.trash),
        if (isHost && widget.onBlock != null && comment.author.id != widget.hostId)
          MenuAction('block', 'Chặn ${comment.author.displayName}', icon: LucideIcons.ban, destructive: true),
      ],
    );
    if (choice == 'delete') widget.onDelete?.call(comment);
    if (choice == 'block') widget.onBlock?.call(comment);
  }

  @override
  Widget build(BuildContext context) {
    final isHost = widget.meId != null && widget.meId == widget.hostId;
    return Container(
      height: widget.height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Text('Bình luận', style: AppText.label),
          ),
          Expanded(
            child: widget.comments.isEmpty
                ? Center(child: Text('Chưa có bình luận nào. Hãy là người đầu tiên!', style: AppText.meta.copyWith(fontSize: 12)))
                : ListView.separated(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                    itemCount: widget.comments.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final c = widget.comments[i];
                      final canMenu = widget.onDelete != null && (isHost || c.author.id == widget.meId);
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppAvatar(url: c.author.avatarUrl, name: c.author.displayName, size: 32),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  spacing: 6,
                                  children: [
                                    Text(
                                      c.author.displayName,
                                      style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                                    ),
                                    if (c.author.id == widget.hostId)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(color: const Color(0x330099FF), borderRadius: BorderRadius.circular(AppRadius.pill)),
                                        child: Text(
                                          'Người phát',
                                          style: AppText.meta.copyWith(fontSize: 10, color: AppColors.cream, fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                    Text(formatClockTime(c.createdAt), style: AppText.meta.copyWith(fontSize: 11)),
                                  ],
                                ),
                                Text(c.text, style: AppText.bodySmall),
                              ],
                            ),
                          ),
                          if (canMenu)
                            AppIconButton(
                              icon: LucideIcons.ellipsis,
                              label: 'Tuỳ chọn bình luận của ${c.author.displayName}',
                              size: 30,
                              onPressed: () => _menu(c),
                            ),
                        ],
                      );
                    },
                  ),
          ),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: widget.disabled
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(widget.disabledReason ?? '', style: AppText.meta.copyWith(fontSize: 12), textAlign: TextAlign.center),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: AppTextField(
                              controller: _text,
                              hint: 'Viết bình luận…',
                              maxLength: _commentMax,
                              dense: true,
                              textInputAction: TextInputAction.send,
                              onChanged: (_) => setState(() {}),
                              onSubmitted: (_) => _submit(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          AppIconButton(
                            icon: LucideIcons.send,
                            label: 'Gửi bình luận',
                            tone: IconTone.primary,
                            loading: _sending,
                            onPressed: _text.text.trim().isEmpty ? null : _submit,
                          ),
                        ],
                      ),
                      if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// One emoji rising over the video.
class Float {
  Float(this.id, this.kind, this.drift, this.offset);

  final int id;
  final String kind;
  final double drift;
  final double offset;
}

/// Reactions rising over the video (web: useFloatingReactions).
class FloatingReactionsController extends ChangeNotifier {
  final List<Float> floats = [];
  int _next = 0;
  final _random = math.Random();

  void add(String kind, [int count = 1]) {
    for (var i = 0; i < math.min(count, 5); i++) {
      floats.add(Float(++_next, kind, (_random.nextDouble() - 0.5) * 60, _random.nextDouble() * 30));
    }
    if (floats.length > 30) floats.removeRange(0, floats.length - 30);
    notifyListeners();
  }

  void done(int id) {
    floats.removeWhere((f) => f.id == id);
    notifyListeners();
  }
}

class FloatingReactions extends StatelessWidget {
  const FloatingReactions({super.key, required this.controller});

  final FloatingReactionsController controller;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ListenableBuilder(
        listenable: controller,
        builder: (context, _) => SizedBox(
          width: 96,
          height: 240,
          child: Stack(
            clipBehavior: Clip.none,
            children: [for (final f in controller.floats) _Rising(key: ValueKey(f.id), float: f, onDone: () => controller.done(f.id))],
          ),
        ),
      ),
    );
  }
}

class _Rising extends StatelessWidget {
  const _Rising({super.key, required this.float, required this.onDone});

  final Float float;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 2200),
      curve: Curves.easeOut,
      onEnd: onDone,
      builder: (context, t, child) => Positioned(
        right: float.offset + float.drift * t,
        bottom: 240 * t,
        child: Opacity(
          opacity: t < 0.75 ? 1 : (1 - t) * 4,
          child: Transform.scale(scale: 0.7 + 0.5 * math.min(1, t * 4), child: child),
        ),
      ),
      child: Text(
        reactionEmoji[float.kind] ?? '❤️',
        style: const TextStyle(fontSize: 30, shadows: [Shadow(blurRadius: 6, color: Color(0x66000000))]),
      ),
    );
  }
}

/// Quick taps are bundled into one request per reaction, at most every half second.
const _flushMs = 500;
const _maxBundle = 10;

/// The row of reaction buttons (web: ReactionBar). Each tap shows the emoji
/// right away; the server gets the taps in bundles and passes them on.
class ReactionBar extends StatefulWidget {
  const ReactionBar({super.key, required this.streamId, required this.counts, required this.onTap});

  final String streamId;
  final Map<String, int> counts;
  final void Function(String kind) onTap;

  @override
  State<ReactionBar> createState() => _ReactionBarState();
}

class _ReactionBarState extends State<ReactionBar> {
  final Map<String, int> _pending = {};
  Timer? _timer;
  String? _note;
  Timer? _noteTimer;

  void _flush() {
    _timer?.cancel();
    _timer = null;
    final batch = Map<String, int>.from(_pending);
    _pending.clear();
    batch.forEach((kind, count) {
      if (count <= 0) return;
      LivestreamService.sendReaction(widget.streamId, kind, count).catchError((Object error) {
        final tooFast = error is ApiError && error.code == 'REACTION_RATE_LIMIT';
        if (!mounted) return;
        setState(() => _note = tooFast ? 'Bạn thả nhanh quá, nghỉ tay một chút nhé.' : errorMessage(error));
        _noteTimer?.cancel();
        _noteTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _note = null);
        });
      });
    });
  }

  @override
  void dispose() {
    // Send whatever is still waiting when the page closes.
    _flush();
    _noteTimer?.cancel();
    super.dispose();
  }

  void _tap(String kind) {
    HapticFeedback.lightImpact();
    widget.onTap(kind);
    final count = (_pending[kind] ?? 0) + 1;
    _pending[kind] = count;
    if (count >= _maxBundle) {
      _flush();
    } else {
      _timer ??= Timer(const Duration(milliseconds: _flushMs), _flush);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          label: 'Thả cảm xúc',
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final kind in reactionKinds)
                Tooltip(
                  message: reactionLabel[kind] ?? kind,
                  child: Material(
                    color: AppColors.card,
                    shape: const StadiumBorder(side: BorderSide(color: AppColors.borderStrong)),
                    child: InkWell(
                      customBorder: const StadiumBorder(),
                      onTap: () => _tap(kind),
                      child: Container(
                        height: 40,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(reactionEmoji[kind]!, style: const TextStyle(fontSize: 18)),
                            if ((widget.counts[kind] ?? 0) > 0) ...[
                              const SizedBox(width: 6),
                              Text(compact(widget.counts[kind]!), style: AppText.label.copyWith(fontSize: 12)),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (_note != null) ...[const SizedBox(height: 6), Text(_note!, style: AppText.meta.copyWith(fontSize: 12))],
      ],
    );
  }
}

/// The recording trails live by roughly this much: aiming closer means "live".
const liveMarginSec = 12.0;

/// The timeline under a live video for viewers (web: DvrBar): drag back to
/// rewind, press "Trực tiếp" to return. The full width is the time since the stream began.
class DvrBar extends StatefulWidget {
  const DvrBar({
    super.key,
    required this.baseSec,
    required this.baseAt,
    required this.rewinding,
    required this.loading,
    required this.paused,
    required this.position,
    required this.onRewind,
    required this.onGoLive,
    required this.onTogglePause,
  });

  final double baseSec;
  final DateTime baseAt;
  final bool rewinding;
  final bool loading;
  final bool paused;

  /// Where the rewound picture is, in seconds since the stream started.
  final double position;
  final ValueChanged<double> onRewind;
  final VoidCallback onGoLive;
  final VoidCallback onTogglePause;

  @override
  State<DvrBar> createState() => _DvrBarState();
}

class _DvrBarState extends State<DvrBar> {
  double? _scrub;

  @override
  Widget build(BuildContext context) {
    return Ticker1s(
      builder: (context) {
        final total = math.max(1.0, elapsedSince(widget.baseSec, widget.baseAt).floorToDouble());
        final shown = _scrub ?? (widget.rewinding ? math.min(widget.position, total) : total);
        final behind = math.max(0.0, total - shown);
        final white = AppText.label.copyWith(fontSize: 12, color: AppColors.white, fontFeatures: const [FontFeature.tabularFigures()]);
        return Row(
          children: [
            AppIconButton(
              icon: LucideIcons.rotateCcw,
              label: 'Tua lại 10 giây',
              tone: IconTone.overlay,
              size: 36,
              onPressed: () => widget.onRewind((widget.rewinding ? widget.position : total - liveMarginSec) - 10),
            ),
            if (widget.rewinding) ...[
              const SizedBox(width: 6),
              AppIconButton(
                icon: widget.paused ? LucideIcons.play : LucideIcons.pause,
                label: widget.paused ? 'Phát' : 'Tạm dừng',
                tone: IconTone.overlay,
                size: 36,
                onPressed: widget.onTogglePause,
              ),
            ],
            Expanded(
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 4,
                  activeTrackColor: const Color(0xFFF43F5E),
                  inactiveTrackColor: const Color(0x40FFFFFF),
                  thumbColor: AppColors.white,
                  overlayShape: SliderComponentShape.noOverlay,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                ),
                child: Slider(
                  value: shown.clamp(0, total),
                  max: total,
                  semanticFormatterCallback: (_) =>
                      !widget.rewinding && _scrub == null ? 'Trực tiếp, đã phát ${liveClock(total)}' : '${liveClock(shown)} trên ${liveClock(total)}',
                  onChanged: (v) => setState(() => _scrub = v),
                  onChangeEnd: (v) {
                    setState(() => _scrub = null);
                    if (v >= total - liveMarginSec / 2) {
                      if (widget.rewinding) widget.onGoLive();
                      return;
                    }
                    widget.onRewind(v);
                  },
                ),
              ),
            ),
            Text(!widget.rewinding && _scrub == null ? liveClock(total) : '-${liveClock(behind)}', style: white),
            const SizedBox(width: 8),
            Semantics(
              button: true,
              label: widget.rewinding ? 'Về trực tiếp' : 'Đang xem trực tiếp',
              child: GestureDetector(
                onTap: widget.rewinding ? widget.onGoLive : null,
                child: Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: widget.rewinding ? const Color(0xE6FFFFFF) : AppColors.live,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (widget.loading)
                        SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2, color: widget.rewinding ? AppColors.ground : AppColors.white),
                        )
                      else
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(color: widget.rewinding ? AppColors.live : AppColors.white, shape: BoxShape.circle),
                        ),
                      const SizedBox(width: 6),
                      Text(
                        'TRỰC TIẾP',
                        style: TextStyle(
                          fontFamily: AppFonts.body,
                          fontWeight: FontWeight.w700,
                          fontSize: 10.5,
                          letterSpacing: 1,
                          color: widget.rewinding ? AppColors.ground : AppColors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
