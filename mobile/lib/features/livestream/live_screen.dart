import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:video_player/video_player.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/livestream_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../profile/follow_button.dart';
import 'dvr.dart';
import 'live_badges.dart';
import 'live_ended.dart';
import 'live_format.dart';
import 'live_room.dart';
import 'live_widgets.dart';
import '../../ui/navigation.dart';

const _audienceNote = {'public': null, 'followers': 'Chỉ người theo dõi', 'private': 'Chỉ mình bạn xem được'};

/// /live/:id: the host's broadcast view or a viewer's watch view (decided by
/// the server's token) while live; the replay and statistics once it is over
/// (web: LivestreamPage).
class LiveScreen extends ConsumerWidget {
  const LiveScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(livestreamProvider(id));
    final stream = async.value;

    Widget notice(String title, String text) => Padding(
      padding: const EdgeInsets.all(kGutter),
      child: Center(
        child: EmptyState(
          title: title,
          description: text,
          action: AppButton(label: 'Về Newsfeed', onPressed: () => context.go('/feed')),
        ),
      ),
    );

    final Widget body;
    if (stream == null && async.isLoading) {
      body = const LoadingView(message: 'Đang mở livestream…');
    } else if (stream == null) {
      body = notice('Không mở được livestream', errorMessage(async.error));
    } else if (stream.blockedMe) {
      body = notice('Bạn không xem được livestream này', 'Người phát đã chặn bạn khỏi buổi phát này.');
    } else if (!stream.isLive) {
      body = LiveEnded(key: ValueKey('ended-${stream.id}'), stream: stream);
    } else {
      body = _LiveView(key: ValueKey('live-${stream.id}'), stream: stream, fetchedAt: DateTime.now());
    }

    return Scaffold(
      appBar: stream != null && stream.isLive ? null : AppBar(leading: const BackOrHome(), title: const Text('Livestream')),
      body: stream != null && stream.isLive ? SafeArea(bottom: false, child: body) : body,
    );
  }
}

class _LiveView extends ConsumerStatefulWidget {
  const _LiveView({super.key, required this.stream, required this.fetchedAt});

  final Livestream stream;

  /// When [stream] came from the server; the live clock counts on from its durationSec.
  final DateTime fetchedAt;

  @override
  ConsumerState<_LiveView> createState() => _LiveViewState();
}

class _LiveViewState extends ConsumerState<_LiveView> {
  LiveRoom? _room;
  ApiError? _fetchError;
  bool _connecting = true;

  /// Over: the final record is fetched and the page switches to the replay.
  bool _ended = false;
  bool _removed = false;

  final List<LiveComment> _history = [];
  final List<LiveComment> _arrived = [];
  final Set<String> _removedIds = {};
  final _floating = FloatingReactionsController();
  late Map<String, int> _reactionCounts = {...widget.stream.reactions};
  late final DvrController _dvr = DvrController(streamId: widget.stream.id, startedAt: parseDate(widget.stream.startedAt) ?? DateTime.now());
  late final DateTime _baseAt = widget.fetchedAt;
  late final double _baseSec = widget.stream.durationSec;

  Livestream get stream => widget.stream;

  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
    _dvr.addListener(_onDvr);
    _loadComments();
    _connect();
  }

  @override
  void dispose() {
    WakelockPlus.disable();
    _dvr.removeListener(_onDvr);
    _dvr.dispose();
    _room?.removeListener(_onRoom);
    _room?.dispose();
    _floating.dispose();
    super.dispose();
  }

  void _onRoom() {
    if (mounted) setState(() {});
  }

  bool _wasRewinding = false;

  void _onDvr() {
    if (!mounted) return;
    if (_dvr.rewinding != _wasRewinding) {
      _wasRewinding = _dvr.rewinding;
      // The live connection stays up underneath, for comments and reactions; only its sound is silenced.
      _room?.muteLiveAudio(_dvr.rewinding);
    }
    setState(() {});
  }

  Future<void> _loadComments() async {
    try {
      final comments = await LivestreamService.listComments(stream.id);
      if (mounted) setState(() => _history.addAll(comments));
    } catch (_) {}
  }

  Future<void> _connect() async {
    // A connection handed over by the setup screen; a reopened page asks for a fresh one.
    final handoff = LiveHandoff.take(stream.id);
    LiveConnection connection;
    try {
      connection = handoff?.connection ?? await LivestreamService.getConnection(stream.id);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() {
        _fetchError = error;
        _connecting = false;
      });
      // Ended before we got in (e.g. an old link): fetch the final record.
      if (error.code == 'LIVE_ENDED') ref.invalidate(livestreamProvider(stream.id));
      return;
    }
    if (!mounted) return;
    final room = LiveRoom(
      connection: connection,
      hostId: stream.host.id,
      startWithCamera: handoff?.camera ?? true,
      frontCamera: handoff?.frontCamera ?? true,
      onComment: _addComment,
      onCommentsRemoved: _dropComments,
      onReaction: _onReaction,
      onEnded: _finish,
      onRemoved: () {
        if (mounted) setState(() => _removed = true);
      },
    );
    room.addListener(_onRoom);
    setState(() {
      _room = room;
      _connecting = false;
    });
    await room.start();
  }

  void _addComment(LiveComment comment) {
    final shown = showComment(comment);
    if (!mounted) return;
    setState(() {
      if (!_arrived.any((c) => c.id == shown.id) && !_history.any((c) => c.id == shown.id)) _arrived.add(shown);
    });
  }

  void _dropComments(List<String> ids) {
    if (mounted) setState(() => _removedIds.addAll(ids));
  }

  void _onReaction(String kind, int count, String userId) {
    // Your own taps were already shown and counted.
    if (userId == ref.read(viewerIdProvider)) return;
    _floating.add(kind, count);
    if (mounted) setState(() => _reactionCounts = {..._reactionCounts, kind: (_reactionCounts[kind] ?? 0) + count});
  }

  void _tapReaction(String kind) {
    _floating.add(kind);
    setState(() => _reactionCounts = {..._reactionCounts, kind: (_reactionCounts[kind] ?? 0) + 1});
  }

  void _finish() {
    if (!mounted || _ended) return;
    setState(() => _ended = true);
    ref.invalidate(livestreamProvider(stream.id));
    ref.invalidate(liveNowProvider);
    ref.invalidate(liveByAuthorsProvider);
  }

  List<LiveComment> get _comments =>
      [..._history, ..._arrived.where((a) => !_history.any((h) => h.id == a.id))].where((c) => !_removedIds.contains(c.id)).toList();

  Future<void> _confirmEnd() async {
    await confirmAction(
      context,
      title: 'Kết thúc livestream?',
      description: 'Người xem sẽ được báo là buổi phát đã kết thúc. Camera và micro sẽ tắt.',
      confirmLabel: 'Kết thúc',
      destructive: true,
      onConfirm: () async {
        await LivestreamService.end(stream.id);
        await _room?.leave();
        _finish();
      },
    );
  }

  Future<void> _deleteComment(LiveComment comment) async {
    try {
      await LivestreamService.deleteComment(stream.id, comment.id);
      _dropComments([comment.id]);
    } catch (error) {
      if (mounted) toast(context, errorMessage(error), error: true);
    }
  }

  Future<void> _block(LiveComment comment) async {
    final done = await confirmAction(
      context,
      title: 'Chặn ${comment.author.displayName}?',
      description:
          'Người này bị đưa ra khỏi livestream, không vào xem lại, bình luận hay thả cảm xúc được nữa. Các bình luận của họ trong buổi phát này sẽ bị xoá.',
      confirmLabel: 'Chặn',
      destructive: true,
      onConfirm: () => LivestreamService.blockViewer(stream.id, comment.author.id),
    );
    if (done) _dropComments(_comments.where((c) => c.author.id == comment.author.id).map((c) => c.id).toList());
  }

  Future<void> _leave() async {
    final room = _room;
    if (room != null && room.isHost && !_ended) {
      await _confirmEnd();
      return;
    }
    if (mounted) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/feed');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(sessionProvider.select((s) => s.user));
    final room = _room;
    final isHost = (room?.isHost ?? false) || me?.id == stream.host.id;
    final blocked = _removed || _fetchError?.code == 'LIVE_BLOCKED';
    final isOver = _ended || _fetchError?.code == 'LIVE_ENDED';
    final rewinding = _dvr.rewinding;
    final canRewind = stream.dvr && !isHost && room != null;
    final reactionTotal = totalReactions(_reactionCounts);

    if (blocked) {
      return Padding(
        padding: const EdgeInsets.all(kGutter),
        child: Center(
          child: EmptyState(
            title: 'Bạn đã bị chặn',
            description: 'Người phát đã chặn bạn khỏi livestream này.',
            action: AppButton(label: 'Về Newsfeed', onPressed: () => context.go('/feed')),
          ),
        ),
      );
    }

    final errorText = room?.error ?? (_fetchError != null && _fetchError!.code != 'LIVE_ENDED' ? _fetchError!.message : null) ?? _dvr.error;
    final video = room?.video;
    final showVideo = video != null && (room?.hasVideo ?? false) && !isOver && (!isHost || (room?.camOn ?? false));

    return PopScope(
      canPop: !(room?.isHost ?? false) || _ended,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmEnd();
      },
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          AspectRatio(
            aspectRatio: 9 / 12,
            child: ColoredBox(
              color: Colors.black,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (showVideo)
                    VideoTrackRenderer(
                      video,
                      fit: VideoViewFit.cover,
                      mirrorMode: isHost && !(room?.backCamera ?? false) ? VideoViewMirrorMode.mirror : VideoViewMirrorMode.off,
                    ),
                  // The rewound picture, over the live one while rewinding.
                  if (rewinding && !isOver && _dvr.player != null && _dvr.player!.value.isInitialized)
                    ColoredBox(
                      color: Colors.black,
                      child: Center(
                        child: AspectRatio(aspectRatio: _dvr.player!.value.aspectRatio, child: VideoPlayer(_dvr.player!)),
                      ),
                    ),
                  if (!showVideo && !(rewinding && !isOver))
                    Stack(
                      fit: StackFit.expand,
                      children: [
                        Opacity(
                          opacity: 0.35,
                          child: ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: 22, sigmaY: 22), child: NetImage(stream.host.avatarUrl)),
                        ),
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                AppAvatar(url: stream.host.avatarUrl, name: stream.host.displayName, size: 80, ring: true),
                                const SizedBox(height: 14),
                                if (isOver)
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.cream)),
                                      const SizedBox(width: 10),
                                      Text('Livestream đã kết thúc', style: AppText.h2),
                                    ],
                                  )
                                else if (_connecting || room?.state == LinkState.connecting)
                                  Text('Đang kết nối…', style: AppText.label)
                                else if (isHost && !(room?.camOn ?? true))
                                  Text('Camera đang tắt. Người xem vẫn nghe được bạn.', style: AppText.label, textAlign: TextAlign.center)
                                else
                                  Text(isHost ? 'Đang bật camera…' : 'Đang chờ hình ảnh từ người phát…', style: AppText.label, textAlign: TextAlign.center),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  if (!isOver)
                    Positioned(
                      right: 12,
                      bottom: canRewind || isHost ? 88 : 20,
                      child: FloatingReactions(controller: _floating),
                    ),
                  // Top bar
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(12, 10, 8, 24),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x99000000), Color(0x00000000)]),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: [
                                if (!isOver && !rewinding) LiveClock(baseSec: _baseSec, baseAt: _baseAt),
                                if (!isOver && rewinding)
                                  const AppBadge('Đang xem lại', icon: LucideIcons.rotateCcwClock, tone: BadgeTone.overlay, uppercase: true),
                                if (!isOver) ViewerCount(count: room?.viewerCount ?? 0),
                                if (!isOver && reactionTotal > 0)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                    decoration: BoxDecoration(color: const Color(0x66000000), borderRadius: BorderRadius.circular(AppRadius.pill)),
                                    child: Text(
                                      '${reactionEmoji['heart']} ${compact(reactionTotal)}',
                                      style: AppText.label.copyWith(fontSize: 12, color: AppColors.white),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          AppIconButton(
                            icon: LucideIcons.x,
                            label: (room?.isHost ?? false) && !isOver ? 'Kết thúc và rời livestream' : 'Rời livestream',
                            tone: IconTone.overlay,
                            onPressed: _leave,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (room?.state == LinkState.reconnecting && !isOver)
                    Positioned(
                      top: 64,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(color: const Color(0x99000000), borderRadius: BorderRadius.circular(AppRadius.pill)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(LucideIcons.wifiOff, size: 14, color: AppColors.white),
                              const SizedBox(width: 8),
                              Text('Mạng chập chờn, đang kết nối lại…', style: AppText.meta.copyWith(color: AppColors.white, fontSize: 12)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  // Viewers: the timeline, to rewind and come back to live.
                  if (canRewind && !isOver)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(10, 32, 10, 10),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0xB3000000), Color(0x00000000)]),
                        ),
                        child: DvrBar(
                          baseSec: _baseSec,
                          baseAt: _baseAt,
                          rewinding: rewinding,
                          loading: _dvr.loading,
                          paused: _dvr.paused,
                          position: _dvr.position,
                          onRewind: (t) => _dvr.rewindTo(t),
                          onGoLive: () => _dvr.goLive(),
                          onTogglePause: () => _dvr.togglePause(),
                        ),
                      ),
                    ),
                  // Host controls
                  if ((room?.isHost ?? false) && !isOver)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(12, 32, 12, 14),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0x99000000), Color(0x00000000)]),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _ControlButton(
                              on: room!.micOn,
                              iconOn: LucideIcons.mic,
                              iconOff: LucideIcons.micOff,
                              labelOn: 'Tắt micro',
                              labelOff: 'Bật micro',
                              onTap: room.toggleMic,
                            ),
                            const SizedBox(width: 12),
                            _ControlButton(
                              on: room.camOn,
                              iconOn: LucideIcons.video,
                              iconOff: LucideIcons.videoOff,
                              labelOn: 'Tắt camera',
                              labelOff: 'Bật camera',
                              onTap: room.toggleCamera,
                            ),
                            if (room.camOn) ...[
                              const SizedBox(width: 12),
                              _ControlButton(
                                on: true,
                                iconOn: LucideIcons.switchCamera,
                                iconOff: LucideIcons.switchCamera,
                                labelOn: 'Đổi camera',
                                labelOff: 'Đổi camera',
                                onTap: room.switchCamera,
                              ),
                            ],
                            const SizedBox(width: 12),
                            Material(
                              color: AppColors.live,
                              shape: const StadiumBorder(),
                              child: InkWell(
                                customBorder: const StadiumBorder(),
                                onTap: _confirmEnd,
                                child: Container(
                                  height: 48,
                                  padding: const EdgeInsets.symmetric(horizontal: 18),
                                  child: Row(
                                    children: [
                                      const Icon(LucideIcons.phoneOff, size: 16, color: AppColors.white),
                                      const SizedBox(width: 8),
                                      Text('Kết thúc', style: AppText.label.copyWith(color: AppColors.white)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 14, kGutter, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (errorText != null && !isOver) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(color: const Color(0x1AE5534B), borderRadius: BorderRadius.circular(AppRadius.lg)),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(errorText, style: AppText.bodySmall.copyWith(color: AppColors.destructive)),
                        ),
                        if (room?.state == LinkState.disconnected)
                          AppButton(
                            label: 'Thử lại',
                            icon: LucideIcons.refreshCw,
                            variant: ButtonVariant.ghost,
                            size: ButtonSize.sm,
                            onPressed: () => context.pushReplacement('/live/${stream.id}'),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                // Reactions: viewers tap them; the host sees the running totals.
                if (!isOver && me != null && !isHost) ...[
                  ReactionBar(streamId: stream.id, counts: _reactionCounts, onTap: _tapReaction),
                  const SizedBox(height: 16),
                ],
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: () => context.push('/users/${stream.host.id}'),
                      child: AppAvatar(url: stream.host.avatarUrl, name: stream.host.displayName, size: 48),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(stream.title, style: AppText.h2),
                          const SizedBox(height: 4),
                          Text.rich(
                            TextSpan(
                              style: AppText.meta,
                              children: [
                                TextSpan(
                                  text: stream.host.displayName,
                                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.cream),
                                ),
                                TextSpan(
                                  text:
                                      ' · bắt đầu ${relativeTime(stream.startedAt)}${_audienceNote[stream.audience] != null ? ' · ${_audienceNote[stream.audience]}' : ''}${stream.recording.status == 'recording' ? ' · Đang được ghi lại' : ''}',
                                ),
                              ],
                            ),
                          ),
                          if (stream.description.isNotEmpty) ...[const SizedBox(height: 8), Text(stream.description, style: AppText.bodySmall)],
                        ],
                      ),
                    ),
                  ],
                ),
                if (!isHost && me != null) ...[
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FollowButton(userId: stream.host.id, size: ButtonSize.sm),
                  ),
                ],
                const SizedBox(height: 16),
                LiveComments(
                  comments: _comments,
                  onSend: (text) async => _addComment(await LivestreamService.sendComment(stream.id, text)),
                  disabled: isOver || me == null,
                  disabledReason: isOver ? 'Livestream đã kết thúc.' : 'Đăng nhập để bình luận.',
                  hostId: stream.host.id,
                  meId: me?.id,
                  onDelete: _deleteComment,
                  onBlock: _block,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({required this.on, required this.iconOn, required this.iconOff, required this.labelOn, required this.labelOff, required this.onTap});

  final bool on;
  final IconData iconOn;
  final IconData iconOff;
  final String labelOn;
  final String labelOff;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: on ? labelOn : labelOff,
      child: Semantics(
        button: true,
        label: on ? labelOn : labelOff,
        excludeSemantics: true,
        child: Material(
          color: on ? const Color(0xE6FFFFFF) : AppColors.live,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(width: 48, height: 48, child: Icon(on ? iconOn : iconOff, size: 20, color: on ? AppColors.ground : AppColors.white)),
          ),
        ),
      ),
    );
  }
}
