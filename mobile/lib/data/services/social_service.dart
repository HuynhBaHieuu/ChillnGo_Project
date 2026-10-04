/// Users, follows, bookmarks and notifications (web/src/services/social.service.ts).
/// Real accounts (MongoDB ids) go to the API; the demo accounts from the
/// fixtures ("u_001"…) stay in the demo database.
library;

import '../api.dart';
import '../json.dart';
import '../mock_db.dart';
import '../models.dart';
import '../server_posts.dart';
import 'auth_service.dart';
import 'post_service.dart';

MockDb get _db => MockDb.instance;

abstract final class SocialService {
  static Future<({User user, bool followedByMe})> _profile(String id) async {
    final data = await Api.get('/api/users/$id');
    return (user: withDefaultPhotos(User.fromJson(mapOf(data['user']))), followedByMe: boolOf(data['followedByMe']));
  }

  static Future<User> getUserById(String id) async {
    if (isServerId(id)) return (await _profile(id)).user;
    await mockDelay();
    return assertFound(_db.userById(id), 'Không tìm thấy người dùng này.').copy();
  }

  /// Ids of the accounts [viewerId] follows: server follows plus demo accounts followed this session.
  static Future<List<String>> getFollowingIds(String viewerId) async {
    final local = _db.follows.where((f) => f.followerId == viewerId).map((f) => f.followingId).toList();
    if (!isServerId(viewerId)) return local;
    final data = await Api.get('/api/users/me/following');
    return {...stringList(data['ids']), ...local}.toList();
  }

  static Future<bool> isFollowing(String userId, String? viewerId) async {
    if (viewerId == null) return false;
    if (isServerId(userId)) return (await _profile(userId)).followedByMe;
    await mockDelay();
    return _db.follows.any((f) => f.followerId == viewerId && f.followingId == userId);
  }

  /// POST /api/users/:id/follow toggles.
  static Future<({bool following, int followerCount})> toggleFollow(String userId, String viewerId) async {
    if (isServerId(userId)) {
      final data = await Api.post('/api/users/$userId/follow');
      return (following: boolOf(data['following']), followerCount: intOf(data['followerCount']));
    }

    await mockDelay();
    final target = assertFound(_db.userById(userId), 'Không tìm thấy người dùng này.');
    final viewer = _db.userById(viewerId);
    final index = _db.follows.indexWhere((f) => f.followerId == viewerId && f.followingId == userId);
    if (index == -1) {
      _db.follows.add(Follow(id: nextId('f'), followerId: viewerId, followingId: userId, createdAt: nowIso()));
      target.followerCount += 1;
      if (viewer != null) viewer.followingCount += 1;
    } else {
      _db.follows.removeAt(index);
      target.followerCount = target.followerCount > 0 ? target.followerCount - 1 : 0;
      if (viewer != null && viewer.followingCount > 0) viewer.followingCount -= 1;
    }
    return (following: index == -1, followerCount: target.followerCount);
  }

  /// The posts a user has saved, most recently saved first.
  static Future<List<TripPost>> getBookmarkedPosts(String userId, String? viewerId) async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    final saved = _db.bookmarks.where((b) => b.userId == userId).toList()..sort((a, b) => byNewest(a.createdAt, b.createdAt));
    return [
      for (final bookmark in saved)
        if (_db.postById(bookmark.postId) case final post?) decorate(post, viewerId),
    ];
  }

  /// The server's notifications together with the demo ones for fixture accounts, newest first.
  static Future<List<AppNotification>> getNotifications(String viewerId) async {
    final local = _db.notifications.where((n) => n.userId == viewerId).map((n) {
      final copy = n.copy();
      copy.actor = n.actorId == null ? null : _db.userById(n.actorId!)?.copy();
      return copy;
    }).toList();

    var remote = <AppNotification>[];
    if (isServerId(viewerId)) {
      final data = await Api.get('/api/notifications');
      remote = listOf(data['items'], (n) {
        final notification = AppNotification.fromJson(mapOf(n));
        if (notification.actor != null) notification.actor = withDefaultPhotos(notification.actor!);
        return notification;
      });
    } else {
      await mockDelay();
    }
    return [...remote, ...local]..sort((a, b) => byNewest(a.createdAt, b.createdAt));
  }

  static Future<void> markAllNotificationsRead(String viewerId) async {
    for (final n in _db.notifications) {
      if (n.userId == viewerId) n.read = true;
    }
    if (isServerId(viewerId)) await Api.post('/api/notifications/read');
  }
}
