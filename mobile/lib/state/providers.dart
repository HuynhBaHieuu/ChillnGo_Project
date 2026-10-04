/// Shared data providers: the equivalents of the web app's TanStack Query hooks.
/// Lists the whole app shows stay cached; detail screens are auto-disposed.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models.dart';
import '../data/services/admin_service.dart';
import '../data/services/checkin_service.dart';
import '../data/services/discovery_service.dart';
import '../data/services/itinerary_service.dart';
import '../data/services/landing_service.dart';
import '../data/services/livestream_service.dart';
import '../data/services/post_service.dart';
import '../data/services/social_service.dart';
import 'session.dart';

/// Refreshes a provider after [every], as long as something still watches it.
void pollEvery(Ref ref, Duration every) {
  final timer = Timer(every, ref.invalidateSelf);
  ref.onDispose(timer.cancel);
}

/* ----------------------------------------------------------------- social */

/// Ids of the accounts the signed-in user follows (API follows + demo follows).
final followingIdsProvider = FutureProvider<List<String>>((ref) async {
  final viewerId = ref.watch(viewerIdProvider);
  if (viewerId == null) return const [];
  return SocialService.getFollowingIds(viewerId);
});

/// The following ids, or [] while loading or when the API is unreachable.
Future<List<String>> _followingOrEmpty(Ref ref) async {
  try {
    return await ref.watch(followingIdsProvider.future);
  } catch (_) {
    return const [];
  }
}

final userProvider = FutureProvider.autoDispose.family<User, String>((ref, id) => SocialService.getUserById(id));

final isFollowingProvider = FutureProvider.autoDispose.family<bool, String>((ref, userId) {
  return SocialService.isFollowing(userId, ref.watch(viewerIdProvider));
});

final bookmarksProvider = FutureProvider.autoDispose.family<List<TripPost>, String>((ref, userId) {
  return SocialService.getBookmarkedPosts(userId, ref.watch(viewerIdProvider));
});

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) async {
  final viewerId = ref.watch(viewerIdProvider);
  if (viewerId == null) return const [];
  pollEvery(ref, const Duration(seconds: 30));
  return SocialService.getNotifications(viewerId);
});

final unreadCountProvider = Provider<int>((ref) {
  final list = ref.watch(notificationsProvider).value ?? const [];
  return list.where((n) => !n.read).length;
});

/* ------------------------------------------------------------------ posts */

/// The Newsfeed's journeys: yours and the people you follow, including people
/// followed through the API (which the web feed used to miss).
final feedProvider = FutureProvider<List<TripPost>>((ref) async {
  final viewerId = ref.watch(viewerIdProvider);
  final following = viewerId == null ? const <String>[] : await _followingOrEmpty(ref);
  return PostService.getFeed(viewerId, following);
});

final postProvider = FutureProvider.autoDispose.family<TripPost, String>((ref, id) {
  return PostService.getPostById(id, ref.watch(viewerIdProvider));
});

final postsByAuthorProvider = FutureProvider.autoDispose.family<List<TripPost>, String>((ref, authorId) {
  return PostService.getPostsByAuthor(authorId, ref.watch(viewerIdProvider));
});

final publishedPostsProvider = FutureProvider.autoDispose<List<TripPost>>((ref) {
  return PostService.getPublishedPosts(ref.watch(viewerIdProvider));
});

final commentsProvider = FutureProvider.autoDispose.family<List<CommentThread>, String>((ref, postId) {
  return PostService.getComments(postId);
});

final discoverProvider = FutureProvider.family<List<TripPost>, DiscoverFilters>((ref, filters) {
  return DiscoveryService.discoverPosts(filters, ref.watch(viewerIdProvider));
});

final allTagsProvider = FutureProvider<List<({String tag, int count})>>((ref) => DiscoveryService.getAllTags());

/// After a journey is created, edited, published, deleted or restored.
void invalidateJourneys(WidgetRef ref) {
  ref.invalidate(feedProvider);
  ref.invalidate(discoverProvider);
  ref.invalidate(allTagsProvider);
  ref.invalidate(postProvider);
  ref.invalidate(postsByAuthorProvider);
  ref.invalidate(publishedPostsProvider);
  ref.invalidate(bookmarksProvider);
  ref.invalidate(landingStatsProvider);
}

/* ------------------------------------------------- optimistic overlays */

/// What the viewer just did to a post (like, save), shown at once everywhere
/// the post appears, before and after the request settles.
class PostOverlay {
  const PostOverlay({this.liked, this.likeCount, this.saved, this.saveCount, this.commentCount});

  final bool? liked;
  final int? likeCount;
  final bool? saved;
  final int? saveCount;
  final int? commentCount;

  PostOverlay merge(PostOverlay other) => PostOverlay(
    liked: other.liked ?? liked,
    likeCount: other.likeCount ?? likeCount,
    saved: other.saved ?? saved,
    saveCount: other.saveCount ?? saveCount,
    commentCount: other.commentCount ?? commentCount,
  );
}

class PostOverlays extends Notifier<Map<String, PostOverlay>> {
  @override
  Map<String, PostOverlay> build() {
    // A different viewer sees their own state.
    ref.watch(viewerIdProvider);
    return const {};
  }

  void patch(String postId, PostOverlay patch) {
    state = {...state, postId: (state[postId] ?? const PostOverlay()).merge(patch)};
  }
}

final postOverlaysProvider = NotifierProvider<PostOverlays, Map<String, PostOverlay>>(PostOverlays.new);

/// A post with the viewer's latest like/save applied.
({bool liked, int likeCount, bool saved, int saveCount, int commentCount}) postCounts(TripPost post, PostOverlay? overlay) => (
  liked: overlay?.liked ?? post.likedByMe,
  likeCount: overlay?.likeCount ?? post.likeCount,
  saved: overlay?.saved ?? post.bookmarkedByMe,
  saveCount: overlay?.saveCount ?? post.bookmarkCount,
  commentCount: overlay?.commentCount ?? post.commentCount,
);

class FollowOverlays extends Notifier<Map<String, ({bool following, int? followerCount})>> {
  @override
  Map<String, ({bool following, int? followerCount})> build() {
    ref.watch(viewerIdProvider);
    return const {};
  }

  void set(String userId, bool following, [int? followerCount]) {
    state = {...state, userId: (following: following, followerCount: followerCount ?? state[userId]?.followerCount)};
  }
}

final followOverlaysProvider = NotifierProvider<FollowOverlays, Map<String, ({bool following, int? followerCount})>>(FollowOverlays.new);

/* -------------------------------------------------------------- itineraries */

final myItinerariesProvider = FutureProvider.autoDispose<List<ClonedItinerary>>((ref) async {
  final viewerId = ref.watch(viewerIdProvider);
  if (viewerId == null) return const [];
  return ItineraryService.getMyItineraries(viewerId);
});

final itineraryProvider = FutureProvider.autoDispose.family<ClonedItinerary, String>((ref, id) {
  return ItineraryService.getItineraryById(id, ownerId: ref.watch(viewerIdProvider));
});

/// The signed-in user's own journeys from the API, drafts included.
final myJourneysProvider = FutureProvider.autoDispose<List<TripPost>>((ref) async {
  if (ref.watch(viewerIdProvider) == null) return const [];
  return PostService.listMyJourneys();
});

/* --------------------------------------------------------------- check-ins */

/// Check-ins by these authors (comma-joined ids), or everyone's for ''.
final checkinsProvider = FutureProvider.family<List<CheckIn>, String>((ref, authorsKey) {
  return CheckInService.list(authorsKey.isEmpty ? null : authorsKey.split(','));
});

/* -------------------------------------------------------------- livestreams */

/// Everything live right now; also drives the badge on the "Đang live" tab.
final liveNowProvider = FutureProvider<List<Livestream>>((ref) {
  pollEvery(ref, const Duration(seconds: 30));
  return LivestreamService.listLive();
});

/// Live streams by these authors (comma-joined ids).
final liveByAuthorsProvider = FutureProvider.autoDispose.family<List<Livestream>, String>((ref, authorsKey) {
  pollEvery(ref, const Duration(seconds: 20));
  return LivestreamService.listLive(authorsKey.isEmpty ? null : authorsKey.split(','));
});

final liveConfigProvider = FutureProvider<LiveConfig>((ref) => LivestreamService.getConfig());

/* ------------------------------------------------------------------ landing */

final landingStatsProvider = FutureProvider<LandingStats>((ref) => LandingService.getStats());

final destinationRowsProvider = FutureProvider.autoDispose<List<DestinationRow>>((ref) => LandingService.getDestinationRows());

final momentPhotosProvider = FutureProvider.autoDispose<List<MomentPhoto>>((ref) => LandingService.getMomentPhotos(12));

/// Banner text and whether sign-up is open.
final publicSettingsProvider = FutureProvider<AppSettings>((ref) => AdminService.getPublicSettings());
