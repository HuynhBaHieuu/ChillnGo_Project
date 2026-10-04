/// Bridge between journeys stored by the API (server/src/routes/posts.ts) and
/// the demo collections the rest of the service layer reads (same approach as
/// web/src/services/serverPosts.ts): the API's journeys are copied into
/// `tripPosts`, and their authors into `users`, before a read.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/photos.dart';
import 'api.dart';
import 'json.dart';
import 'mock_db.dart';
import 'models.dart';

final _fromServer = <String>{};

/// API ids are MongoDB ObjectIds; demo ids look like `p_001`.
bool isServerId(String id) => RegExp(r'^[a-f0-9]{24}$', caseSensitive: false).hasMatch(id);

/// Adds or refreshes authors, without losing a richer record already there.
void upsertAuthors(List<User> authors) {
  final db = MockDb.instance;
  for (final author in authors) {
    final index = db.users.indexWhere((u) => u.id == author.id);
    if (index == -1) {
      db.users.add(author.copy());
    } else if (author.avatarUrl.isNotEmpty) {
      // The record already there (e.g. the signed-in user's own) is the richer one.
      db.users[index].avatarUrl = author.avatarUrl;
    }
  }
}

/// Puts one API journey into `tripPosts`; like/comment/bookmark counts stay the demo database's.
TripPost upsertServerPost(TripPost post) {
  final db = MockDb.instance;
  _fromServer.add(post.id);
  final stored = post.copy()
    ..author = null
    ..likedByMe = false
    ..bookmarkedByMe = false;
  if (stored.coverUrl.isEmpty) stored.coverUrl = autoCover(stored.title);
  final index = db.tripPosts.indexWhere((p) => p.id == post.id);
  if (index == -1) {
    db.tripPosts.insert(0, stored);
    return stored;
  }
  final local = db.tripPosts[index];
  stored
    ..likeCount = local.likeCount
    ..commentCount = local.commentCount
    ..bookmarkCount = local.bookmarkCount
    ..cloneCount = local.cloneCount;
  db.tripPosts[index] = stored;
  return stored;
}

void dropServerPost(String id) {
  _fromServer.remove(id);
  MockDb.instance.tripPosts.removeWhere((p) => p.id == id);
}

Future<void>? _inflight;
DateTime _syncedAt = DateTime.fromMillisecondsSinceEpoch(0);
String? _syncedFor;
const _fresh = Duration(seconds: 5);

Future<void> _pull(String? viewerId) async {
  final published = await Api.get('/api/posts', auth: false);
  final mine = viewerId == null ? <TripPost>[] : listOf((await Api.get('/api/posts/mine?status=all'))['items'], (p) => TripPost.fromJson(mapOf(p)));

  upsertAuthors(listOf(published['authors'], (u) => User.fromJson(mapOf(u))));
  final seen = <String>{};
  for (final post in [...listOf(published['items'], (p) => TripPost.fromJson(mapOf(p))), ...mine]) {
    upsertServerPost(post);
    seen.add(post.id);
  }
  for (final id in [..._fromServer]) {
    if (!seen.contains(id)) dropServerPost(id);
  }
}

/// Brings `tripPosts` up to date with the API. An unreachable API leaves the
/// demo data as it is, so the rest of the app keeps working offline.
Future<void> syncServerPosts({bool force = false}) {
  final viewerId = Api.readViewerId();
  if (!force && viewerId == _syncedFor && DateTime.now().difference(_syncedAt) < _fresh) return Future.value();
  final running = _inflight;
  if (running != null) return running;

  final future = _pull(viewerId)
      .then((_) {
        _syncedAt = DateTime.now();
        _syncedFor = viewerId;
      })
      .catchError((Object error) {
        debugPrint('Could not load journeys from the API: $error');
      })
      .whenComplete(() => _inflight = null);
  _inflight = future;
  return future;
}

/// Forget the last sync, so the next read asks the API again (pull-to-refresh).
void invalidateServerPosts() {
  _syncedAt = DateTime.fromMillisecondsSinceEpoch(0);
}
