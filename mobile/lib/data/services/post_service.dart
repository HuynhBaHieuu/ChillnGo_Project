/// Journeys (trip posts). Real accounts' journeys are stored by the API;
/// seed journeys, likes, comments and bookmarks are still demo data
/// (same split as web/src/services/post.service.ts).
library;

import '../../core/images.dart';
import '../api.dart';
import '../json.dart';
import '../mock_db.dart';
import '../models.dart';
import '../server_posts.dart';
import '../upload.dart';

MockDb get _db => MockDb.instance;

/// The author of a post, or a placeholder when that account no longer exists (never throws).
User authorOf(String authorId) => _db.userById(authorId) ?? deletedUser(authorId);

/// A copy of a post with its author and the viewer's like/bookmark state.
TripPost decorate(TripPost post, String? viewerId) {
  return post.copy()
    ..author = authorOf(post.authorId).copy()
    ..companions = post.companions?.map((c) => TripCompanion(userId: c.userId, status: c.status, user: authorOf(c.userId).copy())).toList()
    ..likedByMe = viewerId != null && _db.likes.any((l) => l.userId == viewerId && l.postId == post.id)
    ..bookmarkedByMe = viewerId != null && _db.bookmarks.any((b) => b.userId == viewerId && b.postId == post.id);
}

List<TripPost> _published(Iterable<TripPost> posts) {
  final list = posts.where((p) => p.status == 'published').toList();
  list.sort((a, b) => byNewest(a.createdAt, b.createdAt));
  return list;
}

TripPost _post(Json data) => TripPost.fromJson(mapOf(data['post']));

abstract final class PostService {
  /* ----------------------------------------------------------------- reads */

  /// Published posts by the people [viewerId] follows (and their own), newest
  /// first. Everyone's when signed out. [followingIds] adds follows made through the API.
  static Future<List<TripPost>> getFeed(String? viewerId, [List<String> followingIds = const []]) async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    if (viewerId == null) return _published(_db.tripPosts).map((p) => decorate(p, null)).toList();

    final following = {..._db.follows.where((f) => f.followerId == viewerId).map((f) => f.followingId), ...followingIds, viewerId};
    return _published(_db.tripPosts.where((p) => following.contains(p.authorId))).map((p) => decorate(p, viewerId)).toList();
  }

  static Future<TripPost> getPostById(String id, String? viewerId) async {
    if (isServerId(id)) {
      final data = await Api.get('/api/posts/$id');
      upsertAuthors(listOf(data['authors'], (u) => User.fromJson(mapOf(u))));
      return decorate(upsertServerPost(_post(data)), viewerId);
    }
    await mockDelay();
    final post = assertFound(_db.postById(id), 'Không tìm thấy hành trình này. Có thể nó đã bị xoá.');
    return decorate(post, viewerId);
  }

  /// Published posts of one author, and those they came along on.
  static Future<List<TripPost>> getPostsByAuthor(String authorId, String? viewerId) async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    bool along(TripPost p) => p.companions?.any((c) => c.userId == authorId && c.status == 'accepted') ?? false;
    return _published(_db.tripPosts.where((p) => p.authorId == authorId || along(p))).map((p) => decorate(p, viewerId)).toList();
  }

  /// Every published post: the source list for the merge picker.
  static Future<List<TripPost>> getPublishedPosts(String? viewerId) async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    return _published(_db.tripPosts).map((p) => decorate(p, viewerId)).toList();
  }

  /* ---------------------------------------------------------------- writes */

  static Future<TripPost> createPost(TripPostPayload payload) async {
    final data = await Api.post('/api/posts', body: payload.toJson(), timeout: const Duration(seconds: 60));
    final post = _post(data);
    final stored = upsertServerPost(post);
    final author = _db.userById(post.authorId);
    if (author != null && post.status == 'published') author.postCount += 1;
    return stored.copy();
  }

  /// Uploads a journey image (cover or stop photo) and returns its address.
  static Future<String> uploadJourneyImage(PickedImage image, {void Function(int percent)? onProgress}) async {
    final result = await uploadPhoto('/api/posts/cover-signature', image, onProgress: onProgress);
    final url = str(result.uploaded['secure_url']);
    if (url.isEmpty) throw ApiError('Không nhận được địa chỉ ảnh sau khi tải lên.', status: 0);
    return url;
  }

  static Future<TripPost> updatePost(String id, TripPostPayload payload) async {
    if (isServerId(id)) {
      final data = await Api.patch('/api/posts/$id', body: payload.toJson(), timeout: const Duration(seconds: 60));
      return upsertServerPost(_post(data)).copy();
    }
    // Seed journeys are demo data: edits stay in this session.
    await mockDelay();
    final index = _db.tripPosts.indexWhere((p) => p.id == id);
    if (index == -1) throw ApiError('Không tìm thấy hành trình này.');
    final current = _db.tripPosts[index];
    final updated = TripPost.fromJson({...current.toJson(), ...payload.toJson(), 'updatedAt': nowIso()});
    _db.tripPosts[index] = updated;
    return updated.copy();
  }

  static Future<({int likeCount, bool likedByMe})> toggleLike(String postId, String viewerId) async {
    await mockDelay();
    final post = assertFound(_db.postById(postId), 'Không tìm thấy hành trình này.');
    final index = _db.likes.indexWhere((l) => l.userId == viewerId && l.postId == postId);
    if (index == -1) {
      _db.likes.add(LikeRecord(viewerId, postId));
      post.likeCount += 1;
    } else {
      _db.likes.removeAt(index);
      post.likeCount = post.likeCount > 0 ? post.likeCount - 1 : 0;
    }
    return (likeCount: post.likeCount, likedByMe: index == -1);
  }

  static Future<({int bookmarkCount, bool bookmarkedByMe})> toggleBookmark(String postId, String viewerId) async {
    await mockDelay();
    final post = assertFound(_db.postById(postId), 'Không tìm thấy hành trình này.');
    final index = _db.bookmarks.indexWhere((b) => b.userId == viewerId && b.postId == postId);
    if (index == -1) {
      _db.bookmarks.add(Bookmark(id: nextId('b'), userId: viewerId, postId: postId, createdAt: nowIso()));
      post.bookmarkCount += 1;
    } else {
      _db.bookmarks.removeAt(index);
      post.bookmarkCount = post.bookmarkCount > 0 ? post.bookmarkCount - 1 : 0;
    }
    return (bookmarkCount: post.bookmarkCount, bookmarkedByMe: index == -1);
  }

  /* -------------------------------------------------------------- comments */

  /// Comments as threads: roots, oldest first, each with its replies.
  static Future<List<CommentThread>> getComments(String postId) async {
    await mockDelay();
    final forPost = _db.comments.where((c) => c.postId == postId).toList()..sort((a, b) => byNewest(b.createdAt, a.createdAt));
    return forPost
        .where((c) => c.parentId == null)
        .map(
          (root) => CommentThread(
            comment: Comment.fromJson(root.toJson()),
            author: authorOf(root.authorId).copy(),
            replies: forPost
                .where((c) => c.parentId == root.id)
                .map((reply) => CommentThread(comment: Comment.fromJson(reply.toJson()), author: authorOf(reply.authorId).copy()))
                .toList(),
          ),
        )
        .toList();
  }

  static Future<Comment> addComment({required String postId, required String authorId, String? parentId, required String content}) async {
    await mockDelay();
    final text = content.trim();
    if (text.isEmpty) throw ApiError('Bình luận không được để trống.', status: 400);
    final comment = Comment(
      id: nextId('c'),
      postId: postId,
      authorId: authorId,
      parentId: parentId,
      content: text.length > 2000 ? text.substring(0, 2000) : text,
      createdAt: nowIso(),
    );
    _db.comments.add(comment);
    final post = _db.postById(postId);
    if (post != null) post.commentCount += 1;
    return Comment.fromJson(comment.toJson());
  }

  /* ------------------------------------------------------ journeys (drafts) */

  static Future<List<TripPost>> _mine(String status) async {
    final data = await Api.get('/api/posts/mine?status=$status');
    final items = listOf(data['items'], (p) => TripPost.fromJson(mapOf(p)));
    for (final post in items) {
      upsertServerPost(post);
    }
    return items;
  }

  static Future<List<TripPost>> listMyJourneys() => _mine('all');

  static Future<List<TripPost>> listDraftJourneys() => _mine('draft');

  static Future<List<TripPost>> listMyPublishedJourneys() => _mine('published');

  static Future<TripPost> publishJourney(String id) async {
    final post = _post(await Api.post('/api/posts/$id/publish'));
    upsertServerPost(post);
    final author = _db.userById(post.authorId);
    if (author != null) author.postCount += 1;
    return post;
  }

  static Future<TripPost> duplicateJourney(String id) async {
    final post = _post(await Api.post('/api/posts/$id/duplicate'));
    upsertServerPost(post);
    return post;
  }

  static Future<void> deleteJourney(String id) async {
    final post = _post(await Api.delete('/api/posts/$id'));
    dropServerPost(id);
    final author = _db.userById(post.authorId);
    if (author != null && post.status == 'published' && author.postCount > 0) author.postCount -= 1;
  }

  static Future<List<TripPost>> listDeletedJourneys() async {
    final data = await Api.get('/api/posts/deleted');
    return listOf(data['items'], (p) => TripPost.fromJson(mapOf(p)));
  }

  static Future<TripPost> restoreJourney(String id) async {
    final post = _post(await Api.post('/api/posts/$id/restore'));
    upsertServerPost(post);
    final author = _db.userById(post.authorId);
    if (author != null && post.status == 'published') author.postCount += 1;
    return post;
  }

  static Future<void> deleteJourneyPermanently(String id) async {
    await Api.delete('/api/posts/$id/permanent');
    dropServerPost(id);
  }

  /* ------------------------------------------------------------ companions */

  /// POST /api/posts/:id/companions: invite friends along on your journey.
  static Future<void> inviteCompanions(String postId, List<String> userIds) async {
    final data = await Api.post('/api/posts/$postId/companions', body: {'userIds': userIds});
    upsertAuthors(listOf(data['authors'], (u) => User.fromJson(mapOf(u))));
    upsertServerPost(_post(data));
  }

  /// POST /api/posts/:id/companions/respond: accept or decline your invite.
  static Future<void> respondToInvite(String postId, bool accept) async {
    await Api.post('/api/posts/$postId/companions/respond', body: {'accept': accept});
  }

  /// DELETE /api/posts/:id/companions/:userId: the author takes someone off, or you leave.
  static Future<void> removeCompanion(String postId, String userId) async {
    await Api.delete('/api/posts/$postId/companions/$userId');
  }
}
