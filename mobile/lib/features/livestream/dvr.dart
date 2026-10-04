/// Rewinding a live stream (web: useDvr). The live picture comes over WebRTC,
/// which keeps nothing to go back to; while a stream is recorded, LiveKit also
/// uploads it as HLS segments every few seconds, and this plays those.
///
/// Positions are "seconds since the stream started", the same numbers as the
/// live clock. [offset] maps them to the player's own time (the recording
/// starts a moment after the stream does).
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';

import '../../data/api.dart';
import '../../data/services/livestream_service.dart';

String _dvrError(Object error) {
  if (error is ApiError && error.code == 'DVR_UNAVAILABLE') return 'Buổi phát này không được ghi lại nên không tua được.';
  if (error is ApiError && error.code == 'DVR_NOT_READY') return 'Chưa có đoạn nào để tua. Thử lại sau vài giây nhé.';
  return 'Không tải được đoạn đã phát. Vui lòng thử lại.';
}

class DvrController extends ChangeNotifier {
  DvrController({required this.streamId, required this.startedAt});

  final String streamId;
  final DateTime startedAt;

  VideoPlayerController? player;
  bool rewinding = false;
  bool loading = false;
  String? error;

  /// Seconds between the stream's start and the recording's first frame.
  double _offset = 0;
  bool _disposed = false;

  double get position => _offset + (player?.value.position.inMilliseconds ?? 0) / 1000;
  bool get paused => !(player?.value.isPlaying ?? false);

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  /// Rewind to [elapsed] seconds into the stream (clamped to what has been recorded).
  Future<void> rewindTo(double elapsed) async {
    error = null;
    final existing = player;
    if (existing != null && existing.value.isInitialized) {
      await _seek(existing, elapsed);
      rewinding = true;
      await existing.play();
      _notify();
      return;
    }

    loading = true;
    _notify();
    try {
      final url = await LivestreamService.getDvrPlaylist(streamId);
      // The first segment's wall-clock time says when the recording began.
      final playlist = await Api.getText(url);
      if (playlist == null) throw ApiError('not ready', status: 404, code: 'DVR_NOT_READY');
      final stamp = RegExp(r'#EXT-X-PROGRAM-DATE-TIME:(\S+)').firstMatch(playlist)?.group(1);
      final first = stamp == null ? null : DateTime.tryParse(stamp);
      _offset = first == null ? 0 : math.max(0, first.difference(startedAt).inMilliseconds / 1000);

      final controller = VideoPlayerController.networkUrl(Uri.parse(url), formatHint: VideoFormat.hls);
      player = controller;
      controller.addListener(_notify);
      await controller.initialize();
      if (_disposed) {
        await controller.dispose();
        return;
      }
      await _seek(controller, elapsed);
      rewinding = true;
      await controller.play();
    } catch (e) {
      await _release();
      rewinding = false;
      error = _dvrError(e);
    } finally {
      loading = false;
      _notify();
    }
  }

  Future<void> _seek(VideoPlayerController controller, double elapsed) async {
    final end = controller.value.duration.inMilliseconds / 1000;
    final target = (elapsed - _offset).clamp(0, math.max(0, end - 1)).toDouble();
    await controller.seekTo(Duration(milliseconds: (target * 1000).round()));
  }

  /// Back to the real-time picture.
  Future<void> goLive() async {
    await _release();
    rewinding = false;
    error = null;
    _notify();
  }

  Future<void> togglePause() async {
    final controller = player;
    if (controller == null) return;
    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      await controller.play();
    }
    _notify();
  }

  Future<void> _release() async {
    final controller = player;
    player = null;
    if (controller == null) return;
    controller.removeListener(_notify);
    await controller.dispose();
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_release());
    super.dispose();
  }
}
