/// The livestream's video connection: the only place the app talks to LiveKit
/// for a live room (web: useLiveRoom.ts).
///
/// Host:   publishes camera and microphone, shows its own camera.
/// Viewer: plays the host's camera and microphone.
/// Both:   live viewer count (people, not devices), server messages
///         (comments, removed comments, reactions, stream ended),
///         reconnecting / disconnected states.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../data/json.dart';
import '../../data/models.dart';

/// Same topic the server sends on (server/src/lib/livekit.ts).
const dataTopic = 'chillngo';

enum LinkState { connecting, live, reconnecting, disconnected }

/// What the setup screen hands to the live screen with the connection.
class LiveHandoff {
  LiveHandoff._();

  static final Map<String, ({LiveConnection connection, bool camera, bool frontCamera})> _waiting = {};

  static void put(String streamId, LiveConnection connection, {required bool camera, required bool frontCamera}) {
    _waiting[streamId] = (connection: connection, camera: camera, frontCamera: frontCamera);
  }

  /// Taken once: a reopened page asks the server for a fresh token instead.
  static ({LiveConnection connection, bool camera, bool frontCamera})? take(String streamId) => _waiting.remove(streamId);
}

/// A viewer's identity is "userId~device"; the host's is their user id.
String _userIdOf(String identity) => identity.split('~').first;

/// Turns camera and microphone errors into something a person can act on.
String mediaErrorMessage(Object error) {
  final text = error.toString().toLowerCase();
  if (text.contains('permission') || text.contains('denied') || text.contains('notallowed')) {
    return 'Bạn đã chặn quyền camera hoặc micro. Hãy cho phép trong Cài đặt của điện thoại rồi thử lại.';
  }
  if (text.contains('notfound') || text.contains('no camera') || text.contains('overconstrained')) return 'Không tìm thấy camera hoặc micro.';
  if (text.contains('notreadable') || text.contains('in use') || text.contains('busy')) return 'Camera hoặc micro đang được ứng dụng khác sử dụng.';
  return 'Không mở được camera hoặc micro.';
}

class LiveRoom extends ChangeNotifier {
  LiveRoom({
    required this.connection,
    required this.hostId,
    this.startWithCamera = true,
    this.frontCamera = true,
    required this.onComment,
    required this.onCommentsRemoved,
    required this.onReaction,
    required this.onEnded,
    required this.onRemoved,
  });

  final LiveConnection connection;
  final String hostId;
  final bool startWithCamera;
  final bool frontCamera;
  final void Function(LiveComment comment) onComment;
  final void Function(List<String> ids) onCommentsRemoved;
  final void Function(String kind, int count, String userId) onReaction;
  final VoidCallback onEnded;

  /// The host removed this viewer from the stream.
  final VoidCallback onRemoved;

  Room? _room;
  EventsListener<RoomEvent>? _listener;
  bool _disposed = false;
  bool _busy = false;
  bool _liveAudioMuted = false;

  LinkState state = LinkState.connecting;
  int viewerCount = 0;

  /// The picture to show: the host's own camera, or the host's for viewers.
  VideoTrack? video;
  bool micOn = true;
  bool camOn = true;
  bool backCamera = false;
  String? error;

  bool get isHost => connection.role == 'host';
  bool get hasVideo => video != null && !(video!.muted);

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _countViewers() {
    final room = _room;
    if (room == null) return;
    final everyone = <Participant>[?room.localParticipant, ...room.remoteParticipants.values];
    viewerCount = everyone.map((p) => _userIdOf(p.identity)).where((id) => id.isNotEmpty && id != hostId).toSet().length;
    _notify();
  }

  void _showHostTrack(Track track, RemoteParticipant participant) {
    if (participant.identity != hostId) return;
    if (track is VideoTrack) video = track;
    if (track is RemoteAudioTrack && _liveAudioMuted) track.disable();
    _notify();
  }

  LocalVideoTrack? get _camera {
    final publication = _room?.localParticipant?.getTrackPublicationBySource(TrackSource.camera);
    final track = publication?.track;
    return track is LocalVideoTrack ? track : null;
  }

  Future<void> start() async {
    final room = Room(
      roomOptions: const RoomOptions(
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: true,
        defaultAudioOutputOptions: AudioOutputOptions(speakerOn: true),
      ),
    );
    _room = room;
    final listener = room.createListener();
    _listener = listener;

    listener
      ..on<ParticipantConnectedEvent>((_) => _countViewers())
      ..on<ParticipantDisconnectedEvent>((e) {
        _countViewers();
        if (e.participant.identity == hostId && !isHost) {
          video = null;
          _notify();
        }
      })
      ..on<TrackSubscribedEvent>((e) => _showHostTrack(e.track, e.participant))
      ..on<TrackUnsubscribedEvent>((e) {
        if (e.track is VideoTrack && !isHost) {
          video = null;
          _notify();
        }
      })
      ..on<TrackMutedEvent>((e) {
        if (e.participant.identity == hostId) _notify();
      })
      ..on<TrackUnmutedEvent>((e) {
        if (e.participant.identity == hostId) _notify();
      })
      ..on<DataReceivedEvent>((e) {
        if (e.topic != dataTopic) return;
        try {
          final message = mapOf(jsonDecode(utf8.decode(e.data)));
          switch (str(message['type'])) {
            case 'comment':
              onComment(LiveComment.fromJson(mapOf(message['comment'])));
            case 'comment_removed':
              onCommentsRemoved(stringList(message['commentIds']));
            case 'reaction':
              onReaction(str(message['kind']), intOf(message['count'], 1), str(message['userId']));
            case 'ended':
              onEnded();
          }
        } catch (_) {
          // Not ours.
        }
      })
      ..on<RoomReconnectingEvent>((_) {
        state = LinkState.reconnecting;
        _notify();
      })
      ..on<RoomReconnectedEvent>((_) {
        state = LinkState.live;
        _notify();
      })
      ..on<RoomDisconnectedEvent>((e) {
        state = LinkState.disconnected;
        switch (e.reason) {
          case DisconnectReason.roomDeleted:
            onEnded();
          case DisconnectReason.participantRemoved:
            onRemoved();
          case DisconnectReason.duplicateIdentity:
            // Only the host has a fixed identity: viewers can watch from as many devices as they like.
            error = 'Bạn đang phát livestream này ở một thiết bị khác.';
          case DisconnectReason.clientInitiated:
          case null:
            break;
          default:
            error = 'Mất kết nối tới livestream. Kiểm tra mạng rồi thử lại.';
        }
        _notify();
      })
      ..on<LocalTrackUnpublishedEvent>((e) {
        // The device went away (taken by another app).
        if (e.publication.source == TrackSource.camera) camOn = false;
        if (e.publication.source == TrackSource.microphone) micOn = false;
        _notify();
      });

    try {
      await room.connect(connection.url, connection.token);
      if (_disposed) {
        await room.disconnect();
        return;
      }
      state = LinkState.live;
      _countViewers();
      for (final participant in room.remoteParticipants.values) {
        for (final publication in participant.trackPublications.values) {
          final track = publication.track;
          if (track != null) _showHostTrack(track, participant);
        }
      }

      if (isHost) {
        final local = room.localParticipant!;
        try {
          await local.setMicrophoneEnabled(true);
        } catch (e) {
          micOn = false;
          error = mediaErrorMessage(e);
        }
        if (startWithCamera) {
          try {
            await local.setCameraEnabled(
              true,
              cameraCaptureOptions: CameraCaptureOptions(cameraPosition: frontCamera ? CameraPosition.front : CameraPosition.back),
            );
            backCamera = !frontCamera;
            video = _camera;
            camOn = true;
          } catch (e) {
            camOn = false;
            error = '${mediaErrorMessage(e)} Livestream tiếp tục với âm thanh.';
          }
        } else {
          camOn = false;
        }
      }
      _notify();
    } catch (_) {
      if (!_disposed) {
        state = LinkState.disconnected;
        error = 'Không kết nối được tới livestream. Vui lòng thử lại.';
        _notify();
      }
    }
  }

  Future<void> toggleMic() async {
    final local = _room?.localParticipant;
    if (local == null) return;
    final next = !micOn;
    try {
      await local.setMicrophoneEnabled(next);
      micOn = next;
    } catch (e) {
      error = mediaErrorMessage(e);
    }
    _notify();
  }

  /// Off: viewers see "camera off" and the camera itself is released. On: the same camera again.
  Future<void> toggleCamera() async {
    final local = _room?.localParticipant;
    if (local == null || _busy) return;
    _busy = true;
    error = null;
    try {
      if (camOn) {
        await local.setCameraEnabled(false);
        camOn = false;
      } else {
        await local.setCameraEnabled(true, cameraCaptureOptions: CameraCaptureOptions(cameraPosition: backCamera ? CameraPosition.back : CameraPosition.front));
        video = _camera;
        camOn = true;
      }
    } catch (e) {
      error = mediaErrorMessage(e);
    } finally {
      _busy = false;
      _notify();
    }
  }

  /// Front ↔ back.
  Future<void> switchCamera() async {
    final track = _camera;
    if (track == null || !camOn || _busy) return;
    _busy = true;
    error = null;
    try {
      await track.setCameraPosition(backCamera ? CameraPosition.front : CameraPosition.back);
      backCamera = !backCamera;
      video = track;
    } catch (_) {
      error = 'Không chuyển được sang camera khác.';
    } finally {
      _busy = false;
      _notify();
    }
  }

  /// Silence (or restore) the live sound, e.g. while the viewer rewinds.
  void muteLiveAudio(bool muted) {
    _liveAudioMuted = muted;
    final room = _room;
    if (room == null) return;
    for (final participant in room.remoteParticipants.values) {
      for (final publication in participant.audioTrackPublications) {
        final track = publication.track;
        if (track == null) continue;
        if (muted) {
          track.disable();
        } else {
          track.enable();
        }
      }
    }
  }

  /// Leaves the room; camera and microphone are released.
  Future<void> leave() async {
    final room = _room;
    if (room == null) return;
    try {
      await room.disconnect();
    } catch (_) {}
  }

  @override
  void dispose() {
    _disposed = true;
    final room = _room;
    final listener = _listener;
    _room = null;
    unawaited(() async {
      try {
        await listener?.dispose();
        await room?.disconnect();
        await room?.dispose();
      } catch (_) {}
    }());
    super.dispose();
  }
}
