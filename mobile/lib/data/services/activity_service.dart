/// "Your Activity" (server/src/routes/activity.ts) plus the demo-backed parts
/// (likes and journey comments), as in web/src/services/activity.service.ts.
library;

import 'package:flutter/foundation.dart';

import '../api.dart';
import '../json.dart';
import '../mock_db.dart';
import '../models.dart';
import '../server_posts.dart';
import 'post_service.dart';

abstract final class ActivityService {
  static Future<List<SearchEntry>> listSearchHistory() async {
    final data = await Api.get('/api/activity/search-history');
    return listOf(data['items'], (e) => SearchEntry.fromJson(mapOf(e)));
  }

  /// Records one search. Fire-and-forget: a failure never gets in the way of the search.
  /// [type]: 'user' | 'place' | 'post' | 'journey'.
  static void recordSearch(String type, String query) {
    final trimmed = query.trim();
    if (trimmed.length < 2 || Api.readToken() == null) return;
    Api.post('/api/activity/search-history', body: {'type': type, 'query': trimmed.length > 120 ? trimmed.substring(0, 120) : trimmed}).catchError((
      Object error,
    ) {
      debugPrint('Search not recorded: $error');
      return <String, dynamic>{};
    });
  }

  static Future<void> removeSearch(String id) => Api.delete('/api/activity/search-history/$id');

  static Future<void> clearSearchHistory() => Api.delete('/api/activity/search-history');

  static Future<List<AccountEvent>> listAccountHistory() async {
    final data = await Api.get('/api/activity/account-history');
    return listOf(data['items'], (e) => AccountEvent.fromJson(mapOf(e)));
  }

  static Future<List<LiveCommentActivity>> listLiveComments() async {
    final data = await Api.get('/api/activity/live-comments');
    return listOf(data['items'], (e) => LiveCommentActivity.fromJson(mapOf(e)));
  }

  /// Journeys you liked, most recent first (likes are demo data).
  static Future<List<TripPost>> listLikedJourneys(String viewerId) async {
    await syncServerPosts();
    final db = MockDb.instance;
    return [
      for (final like in db.likes.reversed)
        if (like.userId == viewerId)
          if (db.postById(like.postId) case final post? when post.status == 'published') decorate(post, viewerId),
    ];
  }

  /// Comments you wrote on journeys, newest first (demo data).
  static Future<List<JourneyCommentActivity>> listJourneyComments(String viewerId) async {
    await syncServerPosts();
    final db = MockDb.instance;
    final mine = db.comments.where((c) => c.authorId == viewerId).toList()..sort((a, b) => byNewest(a.createdAt, b.createdAt));
    return mine.map((c) {
      final post = db.postById(c.postId);
      return JourneyCommentActivity(comment: Comment.fromJson(c.toJson()), postId: post?.id, postTitle: post?.title, postCover: post?.coverUrl);
    }).toList();
  }
}
