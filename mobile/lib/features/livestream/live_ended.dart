import 'dart:io';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:video_player/video_player.dart';

import '../../core/images.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/livestream_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../profile/follow_button.dart';
import 'frames.dart';
import 'live_badges.dart';
import 'live_format.dart';
import 'live_widgets.dart';
import '../../ui/navigation.dart';

/// A stream, refreshed while it is live (the server re-measures the audience)
/// and while its recording is being processed.
final livestreamProvider = FutureProvider.autoDispose.family<Livestream, String>((ref, id) async {
  final stream = await LivestreamService.get(id);
  final processing = stream.recording.status == 'processing' || stream.recording.status == 'recording';
  if (stream.isLive || processing) pollEvery(ref, const Duration(seconds: 15));
  return stream;
});

final _allCommentsProvider = FutureProvider.autoDispose.family<List<LiveComment>, String>((ref, id) => LivestreamService.listComments(id, limit: 200));

/// /live/:id once the stream is over: the replay when there is one, the
/// statistics and the comments (web: LiveEnded). The host sees the same page
/// as their end-of-stream summary.
class LiveEnded extends ConsumerWidget {
  const LiveEnded({super.key, required this.stream});

  final Livestream stream;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(sessionProvider.select((s) => s.user));
    final isHost = me?.id == stream.host.id;
    final comments = ref.watch(_allCommentsProvider(stream.id)).value ?? const <LiveComment>[];
    final ready = stream.recording.status == 'ready' && (stream.recording.url ?? '').isNotEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 40),
      children: [
        _Replay(stream: stream),
        const SizedBox(height: 18),
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
                        TextSpan(text: ' · phát lúc ${formatStart(stream.startedAt)}'),
                      ],
                    ),
                  ),
                  if (stream.description.isNotEmpty) ...[const SizedBox(height: 8), Text(stream.description, style: AppText.bodySmall)],
                ],
              ),
            ),
          ],
        ),
        if (me != null && !isHost) ...[
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: FollowButton(userId: stream.host.id, size: ButtonSize.sm),
          ),
        ],
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(isHost ? 'Tổng kết buổi phát của bạn' : 'Thống kê buổi phát', style: AppText.h3),
              const SizedBox(height: 12),
              LiveStats(stream: stream),
              if (isHost) ...[
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (ready)
                      AppButton(
                        label: stream.thumbnailUrl.isNotEmpty ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa',
                        icon: LucideIcons.image,
                        variant: ButtonVariant.secondary,
                        size: ButtonSize.sm,
                        onPressed: () =>
                            Navigator.of(context).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => ThumbnailPicker(stream: stream))),
                      ),
                    AppButton(label: 'Các buổi phát của tôi', size: ButtonSize.sm, onPressed: () => context.push('/users/${stream.host.id}?tab=live')),
                    AppButton(label: 'Về Newsfeed', variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: () => context.go('/feed')),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        LiveComments(comments: comments, onSend: (_) async {}, disabled: true, disabledReason: 'Livestream đã kết thúc.', hostId: stream.host.id, height: 360),
      ],
    );
  }
}

class _Replay extends StatefulWidget {
  const _Replay({required this.stream});

  final Livestream stream;

  @override
  State<_Replay> createState() => _ReplayState();
}

class _ReplayState extends State<_Replay> {
  VideoPlayerController? _player;
  String? _openingFrame;
  bool _failed = false;

  String? get _url => widget.stream.recording.status == 'ready' ? widget.stream.recording.url : null;

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void didUpdateWidget(_Replay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.stream.recording.url != widget.stream.recording.url || oldWidget.stream.recording.status != widget.stream.recording.status) _open();
  }

  Future<void> _open() async {
    final url = _url;
    if (url == null || url.isEmpty || _player != null) return;
    // No cover chosen: the opening picture stands in, rather than the black first frame.
    if (widget.stream.thumbnailUrl.isEmpty) {
      videoFrame(url, 2, maxWidth: 960).then((path) {
        if (mounted && path != null) setState(() => _openingFrame = path);
      });
    }
    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    setState(() => _player = controller);
    controller.addListener(() {
      if (mounted) setState(() {});
    });
    try {
      await controller.initialize();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stream = widget.stream;
    final player = _player;
    final status = stream.recording.status;

    Widget frame(Widget child) => ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: ColoredBox(color: Colors.black, child: child),
      ),
    );

    if (player != null && !_failed) {
      final ready = player.value.isInitialized;
      final started = player.value.position > Duration.zero || player.value.isPlaying;
      return frame(
        Stack(
          fit: StackFit.expand,
          children: [
            if (ready)
              Center(
                child: AspectRatio(aspectRatio: player.value.aspectRatio, child: VideoPlayer(player)),
              ),
            if (!started)
              stream.thumbnailUrl.isNotEmpty
                  ? NetImage(stream.thumbnailUrl, fit: BoxFit.contain, placeholderColor: Colors.black)
                  : _openingFrame != null
                  ? Image.file(File(_openingFrame!), fit: BoxFit.contain)
                  : const SizedBox.shrink(),
            if (!ready) const Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
            if (ready)
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => player.value.isPlaying ? player.pause() : player.play(),
                  child: AnimatedOpacity(
                    opacity: player.value.isPlaying ? 0 : 1,
                    duration: const Duration(milliseconds: 200),
                    child: Center(
                      child: Container(
                        width: 58,
                        height: 58,
                        decoration: const BoxDecoration(color: AppColors.social, shape: BoxShape.circle),
                        child: Icon(player.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 34, color: AppColors.onPrimary),
                      ),
                    ),
                  ),
                ),
              ),
            if (ready)
              Positioned(
                left: 10,
                right: 10,
                bottom: 8,
                child: Row(
                  children: [
                    Expanded(
                      child: VideoProgressIndicator(
                        player,
                        allowScrubbing: true,
                        colors: const VideoProgressColors(playedColor: AppColors.social, bufferedColor: Color(0x66FFFFFF), backgroundColor: Color(0x33FFFFFF)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text.rich(
                      clockPair(player.value.position.inSeconds, player.value.duration.inSeconds),
                      style: AppText.meta.copyWith(fontSize: 11, color: AppColors.white),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
    }

    final (IconData icon, bool spin, String title, String text) = status == 'processing' || status == 'recording'
        ? (LucideIcons.loaderCircle, true, 'Bản ghi đang được xử lý', 'Thường chỉ mất vài phút. Trang sẽ tự hiện video khi xong.')
        : status == 'failed'
        ? (LucideIcons.film, false, 'Livestream đã kết thúc', 'Buổi phát này không lưu được bản ghi.')
        : _failed
        ? (LucideIcons.film, false, 'Không phát được bản ghi', 'Kiểm tra mạng rồi mở lại trang.')
        : (LucideIcons.film, false, 'Livestream đã kết thúc', 'Buổi phát này không được lưu lại để xem lại.');

    return frame(
      Stack(
        fit: StackFit.expand,
        children: [
          Opacity(
            opacity: 0.3,
            child: ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: 22, sigmaY: 22), child: NetImage(stream.host.avatarUrl)),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                spin
                    ? const SizedBox(width: 30, height: 30, child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.cream))
                    : Icon(icon, size: 32, color: AppColors.cream),
                const SizedBox(height: 10),
                Text(title, style: AppText.h2, textAlign: TextAlign.center),
                const SizedBox(height: 4),
                Text(
                  text,
                  style: AppText.bodySmall.copyWith(color: const Color(0xCCFFFFFF)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// How many frames, evenly spread over the replay, are offered to pick from.
const _suggestedFrames = 6;

/// The host picks the replay's cover: a frame of the video (one of the
/// suggestions, or any moment on the timeline), or a photo of their own (web: ThumbnailPicker).
class ThumbnailPicker extends ConsumerStatefulWidget {
  const ThumbnailPicker({super.key, required this.stream});

  final Livestream stream;

  @override
  ConsumerState<ThumbnailPicker> createState() => _ThumbnailPickerState();
}

class _ThumbnailPickerState extends ConsumerState<ThumbnailPicker> {
  double _duration = 0;
  double _time = 0;

  /// The picture shown for [_time] (a frame read from the video).
  String? _preview;
  final List<({double time, String path})> _frames = [];

  /// Frames cannot be read on this phone: photos only.
  bool _framesBlocked = false;
  PickedImage? _photo;
  bool _busy = false;
  int _progress = 0;
  String? _error;
  int _previewRequest = 0;

  String get _url => widget.stream.recording.url ?? '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final length = await videoDuration(_url);
    if (!mounted) return;
    if (length == null) {
      setState(() => _framesBlocked = true);
      return;
    }
    setState(() {
      _duration = length;
      // Start on the first suggestion rather than the (often black) first frame.
      _time = length / (_suggestedFrames * 2);
    });
    _showFrame(_time);
    for (var i = 0; i < _suggestedFrames && mounted; i++) {
      final at = length * (i + 0.5) / _suggestedFrames;
      final path = await videoFrame(_url, at, maxWidth: 320);
      if (path != null && mounted) setState(() => _frames.add((time: at, path: path)));
    }
  }

  Future<void> _showFrame(double at) async {
    final request = ++_previewRequest;
    final path = await videoFrame(_url, at, maxWidth: 960);
    if (mounted && request == _previewRequest && path != null) setState(() => _preview = path);
  }

  void _seek(double at) {
    setState(() {
      _photo = null;
      _time = at;
    });
    _showFrame(at);
  }

  Future<void> _pickPhoto() async {
    try {
      final images = await pickImages(maxSide: 1920);
      if (images.isEmpty) return;
      setState(() {
        _error = null;
        _photo = images.first;
      });
    } catch (error) {
      setState(() => _error = errorMessage(error));
    }
  }

  void _done(String thumbnailUrl) {
    ref.invalidate(livestreamProvider(widget.stream.id));
    // Lists that show this replay (Newsfeed, profile, "Đang live") pick up the new cover.
    ref.invalidate(liveNowProvider);
    ref.invalidate(liveByAuthorsProvider);
    Navigator.of(context).pop();
    toast(context, thumbnailUrl.isEmpty ? 'Đã gỡ ảnh bìa.' : 'Đã lưu ảnh bìa.');
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
    });
    try {
      final path = _photo?.path ?? await videoFrame(_url, _time);
      if (path == null) throw Exception('Không chụp được khung hình này. Vui lòng thử lại.');
      final url = await LivestreamService.setThumbnail(
        widget.stream.id,
        path,
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
      );
      if (mounted) _done(url);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error, 'Không lưu được ảnh bìa. Vui lòng thử lại.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await LivestreamService.removeThumbnail(widget.stream.id);
      if (mounted) _done('');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSave = _photo != null || (!_framesBlocked && _duration > 0);
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Ảnh bìa video xem lại')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 24),
        children: [
          Text('Chọn một khung hình trong video, hoặc tải ảnh của bạn lên. Ảnh bìa hiện trên Newsfeed và trang cá nhân.', style: AppText.meta),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: ColoredBox(
                color: Colors.black,
                child: _photo != null
                    ? Image.file(File(_photo!.path), fit: BoxFit.cover)
                    : _preview != null
                    ? Image.file(File(_preview!), fit: BoxFit.contain, gaplessPlayback: true)
                    : _framesBlocked
                    ? (widget.stream.thumbnailUrl.isNotEmpty ? NetImage(widget.stream.thumbnailUrl, fit: BoxFit.contain) : const SizedBox.shrink())
                    : const Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (_framesBlocked)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: const Color(0x14FFFFFF), borderRadius: BorderRadius.circular(AppRadius.md)),
              child: Text(
                'Không lấy được khung hình từ video này. Bạn vẫn có thể tải ảnh của mình lên.',
                style: AppText.bodySmall.copyWith(color: AppColors.meta),
              ),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: _time.clamp(0, _duration <= 0 ? 1 : _duration),
                    max: _duration <= 0 ? 1 : _duration,
                    onChanged: _duration == 0 || _busy ? null : (v) => setState(() => _time = v),
                    onChangeEnd: _duration == 0 || _busy ? null : _seek,
                    semanticFormatterCallback: (v) => 'Thời điểm ${liveClock(v)}',
                  ),
                ),
                Text.rich(clockPair(_time, _duration), style: AppText.meta.copyWith(fontSize: 12)),
              ],
            ),
            const SizedBox(height: 8),
            LayoutBuilder(
              builder: (context, constraints) {
                final width = (constraints.maxWidth - 16) / 3;
                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (var i = 0; i < _suggestedFrames; i++)
                      SizedBox(
                        width: width,
                        child: AspectRatio(
                          aspectRatio: 16 / 9,
                          child: i < _frames.length
                              ? Semantics(
                                  button: true,
                                  label: 'Khung hình lúc ${liveClock(_frames[i].time)}',
                                  selected: _photo == null && (_frames[i].time - _time).abs() < 0.05,
                                  child: GestureDetector(
                                    onTap: _busy ? null : () => _seek(_frames[i].time),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: _photo == null && (_frames[i].time - _time).abs() < 0.05 ? AppColors.primary : Colors.transparent,
                                          width: 2,
                                        ),
                                      ),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(6),
                                        child: Image.file(File(_frames[i].path), fit: BoxFit.cover),
                                      ),
                                    ),
                                  ),
                                )
                              : const Skeleton(height: double.infinity, radius: 8),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              AppButton(
                label: 'Tải ảnh lên',
                icon: LucideIcons.imageUp,
                variant: ButtonVariant.outline,
                size: ButtonSize.sm,
                onPressed: _busy ? null : _pickPhoto,
              ),
              if (_photo != null && !_framesBlocked)
                AppButton(
                  label: 'Dùng khung hình trong video',
                  variant: ButtonVariant.ghost,
                  size: ButtonSize.sm,
                  onPressed: _busy ? null : () => _seek(_time),
                ),
            ],
          ),
          if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 12),
          child: Row(
            children: [
              if (widget.stream.thumbnailUrl.isNotEmpty) ...[
                AppButton(label: 'Gỡ ảnh bìa', icon: LucideIcons.trash, variant: ButtonVariant.ghost, onPressed: _busy ? null : _remove),
                const Spacer(),
              ] else
                const Spacer(),
              AppButton(label: _busy ? 'Đang lưu${_progress > 0 ? ' $_progress%' : ''}' : 'Lưu ảnh bìa', loading: _busy, onPressed: canSave ? _save : null),
            ],
          ),
        ),
      ),
    );
  }
}
