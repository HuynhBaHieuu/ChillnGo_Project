import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../data/services/livestream_service.dart';

/// The muted, low-quality moving picture on a live card (web: LivePreview).
/// It joins with a hidden preview token: never seen by the host, never counted
/// as a viewer, never receives sound. Until the picture arrives (or when it
/// cannot), nothing is drawn and the card's poster shows.
class LivePreview extends StatefulWidget {
  const LivePreview({super.key, required this.streamId, required this.hostId});

  final String streamId;
  final String hostId;

  @override
  State<LivePreview> createState() => _LivePreviewState();
}

class _LivePreviewState extends State<LivePreview> {
  Room? _room;
  EventsListener<RoomEvent>? _listener;
  VideoTrack? _track;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  void _want(RemoteTrackPublication publication, String identity) {
    if (identity != widget.hostId || publication.source != TrackSource.camera) return;
    publication.subscribe();
    publication.setVideoQuality(VideoQuality.LOW);
  }

  Future<void> _connect() async {
    final room = Room(roomOptions: const RoomOptions(adaptiveStream: true));
    _room = room;
    final listener = room.createListener();
    _listener = listener;
    listener
      ..on<TrackPublishedEvent>((e) => _want(e.publication, e.participant.identity))
      ..on<TrackSubscribedEvent>((e) {
        final track = e.track;
        if (track is VideoTrack && !_disposed && mounted) setState(() => _track = track);
      })
      ..on<TrackUnsubscribedEvent>((_) {
        if (mounted) setState(() => _track = null);
      })
      ..on<RoomDisconnectedEvent>((_) {
        if (mounted) setState(() => _track = null);
      });

    try {
      final connection = await LivestreamService.getPreviewConnection(widget.streamId);
      if (_disposed) return;
      await room.connect(connection.url, connection.token, connectOptions: const ConnectOptions(autoSubscribe: false));
      if (_disposed) {
        await room.disconnect();
        return;
      }
      for (final participant in room.remoteParticipants.values) {
        for (final publication in participant.trackPublications.values) {
          _want(publication, participant.identity);
        }
      }
    } catch (_) {
      // Ended, blocked or offline: the poster stays.
    }
  }

  @override
  void dispose() {
    _disposed = true;
    final room = _room;
    final listener = _listener;
    Future(() async {
      await listener?.dispose();
      await room?.disconnect();
      await room?.dispose();
    });
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final track = _track;
    if (track == null) return const SizedBox.shrink();
    return VideoTrackRenderer(track, fit: VideoViewFit.cover);
  }
}
