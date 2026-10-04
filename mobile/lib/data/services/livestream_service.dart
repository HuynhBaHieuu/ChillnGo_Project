/// Livestreams (server/src/routes/livestreams.ts). The video itself flows
/// through LiveKit; see features/livestream/live_room.dart.
library;

import '../../core/photos.dart';
import '../api.dart';
import '../json.dart';
import '../models.dart';

MiniUser _withAvatar(MiniUser person) => person.avatarUrl.isNotEmpty ? person : person.withAvatar(travelAvatar(person.username));

Livestream _shown(Json json, {bool blocked = false}) {
  final stream = Livestream.fromJson(json, blockedMe: blocked);
  return stream.copyWith(host: _withAvatar(stream.host));
}

LiveComment showComment(LiveComment comment) => comment.withAuthor(_withAvatar(comment.author));

CursorPage<Livestream> _page(Json data) => CursorPage(items: listOf(data['items'], (s) => _shown(mapOf(s))), nextBefore: strOrNull(data['nextBefore']));

abstract final class LivestreamService {
  static Future<LiveConfig> getConfig() async {
    final data = await Api.get('/api/livestreams/config', auth: false);
    return LiveConfig(live: boolOf(data['live']), recording: boolOf(data['recording']));
  }

  /// Streams live right now; [authors] narrows to those accounts.
  static Future<List<Livestream>> listLive([List<String>? authors]) async {
    final data = await Api.get('/api/livestreams${queryString({'authors': authors?.join(',')})}');
    return listOf(data['items'], (s) => _shown(mapOf(s)));
  }

  static Future<CursorPage<Livestream>> listHistory(String hostId, [String? before]) async =>
      _page(await Api.get('/api/livestreams/history${queryString({'host': hostId, 'before': before})}'));

  static Future<CursorPage<Livestream>> listReplays({List<String>? authors, String? before}) async =>
      _page(await Api.get('/api/livestreams/replays${queryString({'authors': authors?.join(','), 'before': before})}'));

  static Future<Livestream> get(String id) async {
    final data = await Api.get('/api/livestreams/$id');
    return _shown(mapOf(data['livestream']), blocked: boolOf(data['blocked']));
  }

  static Future<({Livestream livestream, LiveConnection connection})> start({
    required String title,
    required String description,
    required String audience,
    required bool record,
  }) async {
    final data = await Api.post('/api/livestreams', body: {'title': title, 'description': description, 'audience': audience, 'record': record});
    return (livestream: _shown(mapOf(data['livestream'])), connection: LiveConnection.fromJson(mapOf(data['connection'])));
  }

  static Future<LiveConnection> getConnection(String id) async =>
      LiveConnection.fromJson(mapOf((await Api.post('/api/livestreams/$id/connection'))['connection']));

  static Future<LiveConnection> getPreviewConnection(String id) async =>
      LiveConnection.fromJson(mapOf((await Api.post('/api/livestreams/$id/preview'))['connection']));

  /// The rewind playlist of a recorded live stream: a full address with a 6-hour access token.
  static Future<String> getDvrPlaylist(String id) async => Api.url(str((await Api.get('/api/livestreams/$id/dvr'))['playlist']));

  static Future<Livestream> end(String id) async => _shown(mapOf((await Api.post('/api/livestreams/$id/end'))['livestream']));

  static Future<List<LiveComment>> listComments(String id, {int limit = 50}) async {
    final data = await Api.get('/api/livestreams/$id/comments?limit=$limit');
    return listOf(data['items'], (c) => showComment(LiveComment.fromJson(mapOf(c))));
  }

  static Future<LiveComment> sendComment(String id, String text) async {
    final data = await Api.post('/api/livestreams/$id/comments', body: {'text': text});
    return showComment(LiveComment.fromJson(mapOf(data['comment'])));
  }

  static Future<void> deleteComment(String id, String commentId) => Api.delete('/api/livestreams/$id/comments/$commentId');

  static Future<void> sendReaction(String id, String kind, int count) => Api.post('/api/livestreams/$id/reactions', body: {'kind': kind, 'count': count});

  static Future<void> blockViewer(String id, String userId) => Api.post('/api/livestreams/$id/block', body: {'userId': userId});

  /// Host only, once the replay is ready: uploads the image and makes it the replay's cover.
  static Future<String> setThumbnail(String id, String filePath, {void Function(int percent)? onProgress}) async {
    final signature = await Api.post('/api/livestreams/$id/thumbnail-signature');
    await Api.uploadSigned(signature, filePath, onProgress: onProgress);
    final data = await Api.put('/api/livestreams/$id/thumbnail');
    return str(data['thumbnailUrl']);
  }

  static Future<void> removeThumbnail(String id) => Api.delete('/api/livestreams/$id/thumbnail');
}
