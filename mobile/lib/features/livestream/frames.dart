/// Pictures taken from a recorded video, for the replay's cover (web: frames.ts).
/// Android reads them natively (MainActivity.kt, MediaMetadataRetriever); where
/// that is not available, callers fall back to a photo the host picks.
library;

import 'package:flutter/services.dart';

const _channel = MethodChannel('chillngo/frames');

/// The video's length in seconds, or null when it cannot be read.
Future<double?> videoDuration(String url) async {
  try {
    final ms = await _channel.invokeMethod<int>('duration', {'url': url});
    return ms == null || ms <= 0 ? null : ms / 1000;
  } on MissingPluginException {
    return null;
  } on PlatformException {
    return null;
  }
}

/// A JPEG of the frame at [seconds], saved to a temporary file; its path, or null.
Future<String?> videoFrame(String url, double seconds, {int maxWidth = 1920}) async {
  try {
    return await _channel.invokeMethod<String>('frame', {'url': url, 'timeMs': (seconds * 1000).round(), 'maxWidth': maxWidth});
  } on MissingPluginException {
    return null;
  } on PlatformException {
    return null;
  }
}
