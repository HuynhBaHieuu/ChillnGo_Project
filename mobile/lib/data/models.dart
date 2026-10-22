/// Domain types: the same contract as web/src/services/types.ts, which mirrors
/// the MongoDB collections. Keep the two in step.
///
/// Models are mutable on purpose: the in-memory demo database (mock_db.dart)
/// updates them in place, as the web app does, and hands callers copies.
library;

import 'json.dart';

/* ------------------------------------------------------------------ User */

class User {
  User({
    required this.id,
    required this.username,
    required this.displayName,
    this.email = '',
    this.avatarUrl = '',
    this.coverUrl = '',
    this.bio = '',
    this.location = '',
    this.followerCount = 0,
    this.followingCount = 0,
    this.postCount = 0,
    this.role = 'user',
    this.permissions,
    this.createdAt = '',
  });

  String id;
  String username;
  String displayName;
  String email;
  String avatarUrl;
  String coverUrl;
  String bio;
  String location;
  int followerCount;
  int followingCount;
  int postCount;

  /// 'user' | 'admin' | 'superadmin'
  String role;

  /// Admin modules this account may use. Sent by the API; absent on demo users.
  List<String>? permissions;
  String createdAt;

  factory User.fromJson(Json json) => User(
    id: str(json['_id']),
    username: str(json['username']),
    displayName: str(json['displayName'], str(json['username'])),
    email: str(json['email']),
    avatarUrl: str(json['avatarUrl']),
    coverUrl: str(json['coverUrl']),
    bio: str(json['bio']),
    location: str(json['location']),
    followerCount: intOf(json['followerCount']),
    followingCount: intOf(json['followingCount']),
    postCount: intOf(json['postCount']),
    role: str(json['role'], 'user'),
    permissions: json['permissions'] is List ? stringList(json['permissions']) : null,
    createdAt: str(json['createdAt']),
  );

  Json toJson() => {
    '_id': id,
    'username': username,
    'displayName': displayName,
    'email': email,
    'avatarUrl': avatarUrl,
    'coverUrl': coverUrl,
    'bio': bio,
    'location': location,
    'followerCount': followerCount,
    'followingCount': followingCount,
    'postCount': postCount,
    'role': role,
    if (permissions != null) 'permissions': permissions,
    'createdAt': createdAt,
  };

  User copy() => User.fromJson(toJson());
}

/* -------------------------------------------------------------- TripPost */

/// How a stop was reached from the one before it (web/src/lib/travel.ts).
enum TravelMode { driving, walking, transit, flight, ferry }

/// A road leg's route as drawn when the journey was saved.
class LegRoute {
  LegRoute({required this.key, required this.polyline, required this.duration, required this.distance});

  final String key;

  /// Mapbox polyline6.
  final String polyline;

  /// Seconds.
  final double duration;

  /// Metres.
  final double distance;

  factory LegRoute.fromJson(Json json) =>
      LegRoute(key: str(json['key']), polyline: str(json['polyline']), duration: doubleOf(json['duration']), distance: doubleOf(json['distance']));

  Json toJson() => {'key': key, 'polyline': polyline, 'duration': duration, 'distance': distance};
}

class TripLocation {
  TripLocation({
    required this.id,
    this.name = '',
    this.address,
    this.note = '',
    this.estCost = 0,
    this.photoUrl,
    required this.lng,
    required this.lat,
    this.travelMode,
    this.placeTypes,
    this.legRoute,
  });

  String id;
  String name;
  String? address;
  String note;
  int estCost;
  String? photoUrl;
  double lng;
  double lat;

  /// Raw value as stored ('driving', 'walking', …; older stops have none).
  String? travelMode;
  List<String>? placeTypes;
  LegRoute? legRoute;

  factory TripLocation.fromJson(Json json) => TripLocation(
    id: str(json['_id']),
    name: str(json['name']),
    address: strOrNull(json['address']),
    note: str(json['note']),
    estCost: intOf(json['estCost']),
    photoUrl: (json['photoUrl'] is String && (json['photoUrl'] as String).isNotEmpty) ? json['photoUrl'] as String : null,
    lng: doubleOf(json['lng']),
    lat: doubleOf(json['lat']),
    travelMode: strOrNull(json['travelMode']),
    placeTypes: json['placeTypes'] is List ? stringList(json['placeTypes']) : null,
    legRoute: mapOrNull(json['legRoute']) != null ? LegRoute.fromJson(mapOf(json['legRoute'])) : null,
  );

  Json toJson() => {
    '_id': id,
    'name': name,
    if (address != null) 'address': address,
    'note': note,
    'estCost': estCost,
    'photoUrl': photoUrl,
    'lng': lng,
    'lat': lat,
    if (travelMode != null) 'travelMode': travelMode,
    if (placeTypes != null) 'placeTypes': placeTypes,
    if (legRoute != null) 'legRoute': legRoute!.toJson(),
  };

  TripLocation copy() => TripLocation.fromJson(toJson());
}

class TripDay {
  TripDay({required this.id, required this.dayNumber, this.date = '', this.title = '', List<TripLocation>? locations, List<String>? photos})
    : locations = locations ?? [],
      photos = photos ?? [];

  String id;
  int dayNumber;

  /// "YYYY-MM-DD"
  String date;
  String title;
  List<TripLocation> locations;
  List<String> photos;

  factory TripDay.fromJson(Json json) => TripDay(
    id: str(json['_id']),
    dayNumber: intOf(json['dayNumber'], 1),
    date: str(json['date']),
    title: str(json['title']),
    locations: listOf(json['locations'], (l) => TripLocation.fromJson(mapOf(l))),
    photos: stringList(json['photos']),
  );

  Json toJson() => {'_id': id, 'dayNumber': dayNumber, 'date': date, 'title': title, 'locations': locations.map((l) => l.toJson()).toList(), 'photos': photos};

  TripDay copy() => TripDay.fromJson(toJson());
}

/// A friend the author invited along on a journey: 'pending' until they
/// accept. [user] is filled by `decorate` in the post service.
class TripCompanion {
  TripCompanion({required this.userId, this.status = 'pending', this.user});

  String userId;

  /// 'pending' | 'accepted'
  String status;
  User? user;

  factory TripCompanion.fromJson(Json json) => TripCompanion(
    userId: str(json['userId']),
    status: str(json['status'], 'pending'),
    user: mapOrNull(json['user']) != null ? User.fromJson(mapOf(json['user'])) : null,
  );

  Json toJson() => {'userId': userId, 'status': status, if (user != null) 'user': user!.toJson()};
}

/// A journey. On the web, "TripPostWithAuthor" adds the author and the
/// viewer's like and bookmark state; here those are the last three fields,
/// filled by `decorate` in the post service.
class TripPost {
  TripPost({
    required this.id,
    required this.authorId,
    this.title = '',
    this.summary = '',
    this.coverUrl = '',
    this.coverImages,
    this.region = 'north',
    this.season = 'spring',
    this.startDate = '',
    this.endDate = '',
    List<TripDay>? days,
    List<String>? tags,
    this.budgetLevel = 'medium',
    this.totalEstCost = 0,
    Json? routeGeoJson,
    this.likeCount = 0,
    this.commentCount = 0,
    this.bookmarkCount = 0,
    this.cloneCount = 0,
    this.companions,
    this.status = 'published',
    this.createdAt = '',
    this.updatedAt = '',
    this.deletedAt,
    this.purgeAt,
    this.author,
    this.likedByMe = false,
    this.bookmarkedByMe = false,
  }) : days = days ?? [],
       tags = tags ?? [],
       routeGeoJson = routeGeoJson ?? {'type': 'FeatureCollection', 'features': <Object>[]};

  String id;
  String authorId;
  String title;
  String summary;
  String coverUrl;
  List<String>? coverImages;

  /// 'north' | 'central' | 'south' | 'islands' | 'overseas'
  String region;

  /// 'spring' | 'summer' | 'autumn' | 'winter'
  String season;
  String startDate;
  String endDate;
  List<TripDay> days;
  List<String> tags;

  /// 'low' | 'medium' | 'high'
  String budgetLevel;
  int totalEstCost;
  Json routeGeoJson;
  int likeCount;
  int commentCount;
  int bookmarkCount;
  int cloneCount;

  /// Who came along: those who accepted, plus the pending invites the viewer
  /// may see. From the API; null on sample journeys, which cannot have companions.
  List<TripCompanion>? companions;

  /// 'draft' | 'pending' | 'published' | 'rejected'
  String status;
  String createdAt;
  String updatedAt;

  /// Journeys from the API carry where they are in "Recently Deleted".
  String? deletedAt;
  String? purgeAt;

  User? author;
  bool likedByMe;
  bool bookmarkedByMe;

  int get stopCount => days.fold(0, (sum, d) => sum + d.locations.length);

  factory TripPost.fromJson(Json json) => TripPost(
    id: str(json['_id']),
    authorId: str(json['authorId']),
    title: str(json['title']),
    summary: str(json['summary']),
    coverUrl: str(json['coverUrl']),
    coverImages: json['coverImages'] is List ? stringList(json['coverImages']) : null,
    region: str(json['region'], 'north'),
    season: str(json['season'], 'spring'),
    startDate: str(json['startDate']),
    endDate: str(json['endDate']),
    days: listOf(json['days'], (d) => TripDay.fromJson(mapOf(d))),
    tags: stringList(json['tags']),
    budgetLevel: str(json['budgetLevel'], 'medium'),
    totalEstCost: intOf(json['totalEstCost']),
    routeGeoJson: mapOrNull(json['routeGeoJson']),
    likeCount: intOf(json['likeCount']),
    commentCount: intOf(json['commentCount']),
    bookmarkCount: intOf(json['bookmarkCount']),
    cloneCount: intOf(json['cloneCount']),
    companions: json['companions'] is List ? listOf(json['companions'], (c) => TripCompanion.fromJson(mapOf(c))) : null,
    status: str(json['status'], 'published'),
    createdAt: str(json['createdAt']),
    updatedAt: str(json['updatedAt']),
    deletedAt: strOrNull(json['deletedAt']),
    purgeAt: strOrNull(json['purgeAt']),
    author: mapOrNull(json['author']) != null ? User.fromJson(mapOf(json['author'])) : null,
    likedByMe: boolOf(json['likedByMe']),
    bookmarkedByMe: boolOf(json['bookmarkedByMe']),
  );

  Json toJson() => {
    '_id': id,
    'authorId': authorId,
    'title': title,
    'summary': summary,
    'coverUrl': coverUrl,
    if (coverImages != null) 'coverImages': coverImages,
    'region': region,
    'season': season,
    'startDate': startDate,
    'endDate': endDate,
    'days': days.map((d) => d.toJson()).toList(),
    'tags': tags,
    'budgetLevel': budgetLevel,
    'totalEstCost': totalEstCost,
    'routeGeoJson': routeGeoJson,
    'likeCount': likeCount,
    'commentCount': commentCount,
    'bookmarkCount': bookmarkCount,
    'cloneCount': cloneCount,
    if (companions != null) 'companions': companions!.map((c) => c.toJson()).toList(),
    'status': status,
    'createdAt': createdAt,
    'updatedAt': updatedAt,
    'deletedAt': deletedAt,
    'purgeAt': purgeAt,
    if (author != null) 'author': author!.toJson(),
    'likedByMe': likedByMe,
    'bookmarkedByMe': bookmarkedByMe,
  };

  TripPost copy() => TripPost.fromJson(toJson());
}

/// What the editor sends to create or update a journey.
class TripPostPayload {
  TripPostPayload({
    required this.authorId,
    required this.title,
    required this.summary,
    required this.coverUrl,
    required this.coverImages,
    required this.region,
    required this.season,
    required this.startDate,
    required this.endDate,
    required this.days,
    required this.tags,
    required this.budgetLevel,
    required this.totalEstCost,
    required this.routeGeoJson,
    required this.status,
  });

  final String authorId;
  final String title;
  final String summary;
  final String coverUrl;
  final List<String> coverImages;
  final String region;
  final String season;
  final String startDate;
  final String endDate;
  final List<TripDay> days;
  final List<String> tags;
  final String budgetLevel;
  final int totalEstCost;
  final Json routeGeoJson;
  final String status;

  Json toJson() => {
    'authorId': authorId,
    'title': title,
    'summary': summary,
    'coverUrl': coverUrl,
    'coverImages': coverImages,
    'region': region,
    'season': season,
    'startDate': startDate,
    'endDate': endDate,
    'days': days.map((d) => d.toJson()).toList(),
    'tags': tags,
    'budgetLevel': budgetLevel,
    'totalEstCost': totalEstCost,
    'routeGeoJson': routeGeoJson,
    'status': status,
  };
}

/* --------------------------------------------------------------- Comment */

class Comment {
  Comment({required this.id, required this.postId, required this.authorId, this.parentId, required this.content, this.likeCount = 0, required this.createdAt});

  String id;
  String postId;
  String authorId;
  String? parentId;
  String content;
  int likeCount;
  String createdAt;

  factory Comment.fromJson(Json json) => Comment(
    id: str(json['_id']),
    postId: str(json['postId']),
    authorId: str(json['authorId']),
    parentId: strOrNull(json['parentId']),
    content: str(json['content']),
    likeCount: intOf(json['likeCount']),
    createdAt: str(json['createdAt']),
  );

  Json toJson() => {
    '_id': id,
    'postId': postId,
    'authorId': authorId,
    'parentId': parentId,
    'content': content,
    'likeCount': likeCount,
    'createdAt': createdAt,
  };
}

class CommentThread {
  CommentThread({required this.comment, required this.author, this.replies = const []});

  final Comment comment;
  final User author;
  final List<CommentThread> replies;
}

class Follow {
  Follow({required this.id, required this.followerId, required this.followingId, required this.createdAt});

  String id;
  String followerId;
  String followingId;
  String createdAt;

  factory Follow.fromJson(Json json) =>
      Follow(id: str(json['_id']), followerId: str(json['followerId']), followingId: str(json['followingId']), createdAt: str(json['createdAt']));
}

class Bookmark {
  Bookmark({required this.id, required this.userId, required this.postId, required this.createdAt});

  String id;
  String userId;
  String postId;
  String createdAt;

  factory Bookmark.fromJson(Json json) =>
      Bookmark(id: str(json['_id']), userId: str(json['userId']), postId: str(json['postId']), createdAt: str(json['createdAt']));
}

class ClonedItinerary {
  ClonedItinerary({
    required this.id,
    required this.ownerId,
    required this.sourcePostIds,
    required this.title,
    this.note = '',
    this.coverUrl = '',
    required this.startDate,
    required this.days,
    this.totalEstCost = 0,
    this.status = 'planning',
    required this.createdAt,
    required this.updatedAt,
  });

  String id;
  String ownerId;
  List<String> sourcePostIds;
  String title;
  String note;
  String coverUrl;
  String startDate;
  List<TripDay> days;
  int totalEstCost;

  /// 'planning' | 'confirmed' | 'completed'
  String status;
  String createdAt;
  String updatedAt;

  factory ClonedItinerary.fromJson(Json json) => ClonedItinerary(
    id: str(json['_id']),
    ownerId: str(json['ownerId']),
    sourcePostIds: stringList(json['sourcePostIds']),
    title: str(json['title']),
    note: str(json['note']),
    coverUrl: str(json['coverUrl']),
    startDate: str(json['startDate']),
    days: listOf(json['days'], (d) => TripDay.fromJson(mapOf(d))),
    totalEstCost: intOf(json['totalEstCost']),
    status: str(json['status'], 'planning'),
    createdAt: str(json['createdAt']),
    updatedAt: str(json['updatedAt']),
  );

  Json toJson() => {
    '_id': id,
    'ownerId': ownerId,
    'sourcePostIds': sourcePostIds,
    'title': title,
    'note': note,
    'coverUrl': coverUrl,
    'startDate': startDate,
    'days': days.map((d) => d.toJson()).toList(),
    'totalEstCost': totalEstCost,
    'status': status,
    'createdAt': createdAt,
    'updatedAt': updatedAt,
  };

  ClonedItinerary copy() => ClonedItinerary.fromJson(toJson());
}

class AppNotification {
  AppNotification({
    required this.id,
    required this.userId,
    required this.type,
    this.actorId,
    this.postId,
    this.livestreamId,
    required this.message,
    this.read = false,
    required this.createdAt,
    this.actor,
  });

  String id;
  String userId;

  /// 'like' | 'comment' | 'follow' | 'clone' | 'bookmark' | 'system' | 'live' | 'invite' | 'invite_accepted'
  String type;
  String? actorId;
  String? postId;
  String? livestreamId;
  String message;
  bool read;
  String createdAt;
  User? actor;

  factory AppNotification.fromJson(Json json) => AppNotification(
    id: str(json['_id']),
    userId: str(json['userId']),
    type: str(json['type'], 'system'),
    actorId: strOrNull(json['actorId']),
    postId: strOrNull(json['postId']),
    livestreamId: strOrNull(json['livestreamId']),
    message: str(json['message']),
    read: boolOf(json['read']),
    createdAt: str(json['createdAt']),
    actor: mapOrNull(json['actor']) != null ? User.fromJson(mapOf(json['actor'])) : null,
  );

  AppNotification copy() => AppNotification(
    id: id,
    userId: userId,
    type: type,
    actorId: actorId,
    postId: postId,
    livestreamId: livestreamId,
    message: message,
    read: read,
    createdAt: createdAt,
    actor: actor?.copy(),
  );
}

class AuthSession {
  AuthSession({required this.token, required this.user});

  final String token;
  final User user;
}

class LandingStats {
  const LandingStats({required this.tripCount, required this.cloneCount, required this.bookmarkCount, required this.stopCount});

  final int tripCount;
  final int cloneCount;
  final int bookmarkCount;
  final int stopCount;
}

class DestinationRow {
  const DestinationRow({required this.id, required this.name, required this.lat, required this.lng, required this.postId, required this.tripTitle});

  final String id;
  final String name;
  final double lat;
  final double lng;
  final String postId;
  final String tripTitle;
}

class MomentPhoto {
  const MomentPhoto({required this.url, required this.postId, required this.tripTitle});

  final String url;
  final String postId;
  final String tripTitle;
}

/* ----------------------------------------------------------------- Places */

class Place {
  const Place({required this.name, required this.address, required this.lat, required this.lng, this.types = const []});

  final String name;
  final String address;
  final double lat;
  final double lng;

  /// Mapbox categories (e.g. "airport"), which suggest how a leg was travelled.
  final List<String> types;

  factory Place.fromJson(Json json) => Place(name: str(json['name']), address: str(json['address']), lat: doubleOf(json['lat']), lng: doubleOf(json['lng']));

  Place copyWith({String? name, String? address, double? lat, double? lng}) =>
      Place(name: name ?? this.name, address: address ?? this.address, lat: lat ?? this.lat, lng: lng ?? this.lng, types: types);
}

/* --------------------------------------------------------------- Check-in */

/// The short author record the check-in and livestream APIs send.
class MiniUser {
  const MiniUser({required this.id, required this.username, required this.displayName, required this.avatarUrl});

  final String id;
  final String username;
  final String displayName;
  final String avatarUrl;

  factory MiniUser.fromJson(Json json) => MiniUser(
    id: str(json['_id']),
    username: str(json['username']),
    displayName: str(json['displayName'], str(json['username'])),
    avatarUrl: str(json['avatarUrl']),
  );

  MiniUser withAvatar(String url) => MiniUser(id: id, username: username, displayName: displayName, avatarUrl: url);
}

class CheckInPhoto {
  const CheckInPhoto({required this.url, required this.width, required this.height});

  final String url;
  final int width;
  final int height;
}

class CheckIn {
  CheckIn({
    required this.id,
    required this.caption,
    this.feeling,
    required this.photos,
    this.location,
    required this.createdAt,
    this.deletedAt,
    this.purgeAt,
    required this.author,
  });

  final String id;
  final String caption;
  final String? feeling;
  final List<CheckInPhoto> photos;
  final Place? location;
  final String createdAt;
  final String? deletedAt;
  final String? purgeAt;
  MiniUser author;

  factory CheckIn.fromJson(Json json) => CheckIn(
    id: str(json['_id']),
    caption: str(json['caption']),
    feeling: strOrNull(json['feeling']),
    photos: listOf(json['photos'], (p) {
      final m = mapOf(p);
      return CheckInPhoto(url: str(m['url']), width: intOf(m['width']), height: intOf(m['height']));
    }),
    location: mapOrNull(json['location']) != null ? Place.fromJson(mapOf(json['location'])) : null,
    createdAt: str(json['createdAt']),
    deletedAt: strOrNull(json['deletedAt']),
    purgeAt: strOrNull(json['purgeAt']),
    author: MiniUser.fromJson(mapOf(json['author'])),
  );
}

/* ------------------------------------------------------------- Livestream */

const reactionKinds = ['heart', 'fire', 'clap', 'wow', 'haha'];

class Recording {
  const Recording({required this.status, this.url, this.durationSec = 0});

  /// 'none' | 'recording' | 'processing' | 'ready' | 'failed'
  final String status;
  final String? url;
  final double durationSec;
}

class Livestream {
  Livestream({
    required this.id,
    required this.title,
    required this.description,
    required this.audience,
    required this.status,
    required this.startedAt,
    this.endedAt,
    this.durationSec = 0,
    this.viewerCount = 0,
    this.peakViewers = 0,
    this.uniqueViewers = 0,
    this.commentCount = 0,
    required this.reactions,
    required this.recording,
    this.dvr = false,
    this.thumbnailUrl = '',
    required this.host,
    this.blockedMe = false,
  });

  final String id;
  final String title;
  final String description;

  /// 'public' | 'followers' | 'private'
  final String audience;

  /// 'live' | 'ended'
  final String status;
  final String startedAt;
  final String? endedAt;
  final double durationSec;
  final int viewerCount;
  final int peakViewers;
  final int uniqueViewers;
  final int commentCount;
  final Map<String, int> reactions;
  final Recording recording;
  final bool dvr;
  final String thumbnailUrl;
  final MiniUser host;
  final bool blockedMe;

  bool get isLive => status == 'live';

  factory Livestream.fromJson(Json json, {bool blockedMe = false}) {
    final reactions = mapOf(json['reactions']);
    final recording = mapOf(json['recording']);
    return Livestream(
      id: str(json['_id']),
      title: str(json['title']),
      description: str(json['description']),
      audience: str(json['audience'], 'public'),
      status: str(json['status'], 'ended'),
      startedAt: str(json['startedAt']),
      endedAt: strOrNull(json['endedAt']),
      durationSec: doubleOf(json['durationSec']),
      viewerCount: intOf(json['viewerCount']),
      peakViewers: intOf(json['peakViewers']),
      uniqueViewers: intOf(json['uniqueViewers']),
      commentCount: intOf(json['commentCount']),
      reactions: {for (final kind in reactionKinds) kind: intOf(reactions[kind])},
      recording: Recording(status: str(recording['status'], 'none'), url: strOrNull(recording['url']), durationSec: doubleOf(recording['durationSec'])),
      dvr: boolOf(json['dvr']),
      thumbnailUrl: str(json['thumbnailUrl']),
      host: MiniUser.fromJson(mapOf(json['host'])),
      blockedMe: blockedMe,
    );
  }

  Livestream copyWith({MiniUser? host, String? thumbnailUrl, bool? blockedMe}) => Livestream(
    id: id,
    title: title,
    description: description,
    audience: audience,
    status: status,
    startedAt: startedAt,
    endedAt: endedAt,
    durationSec: durationSec,
    viewerCount: viewerCount,
    peakViewers: peakViewers,
    uniqueViewers: uniqueViewers,
    commentCount: commentCount,
    reactions: reactions,
    recording: recording,
    dvr: dvr,
    thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
    host: host ?? this.host,
    blockedMe: blockedMe ?? this.blockedMe,
  );
}

class LiveComment {
  const LiveComment({required this.id, required this.text, required this.createdAt, required this.author});

  final String id;
  final String text;
  final String createdAt;
  final MiniUser author;

  factory LiveComment.fromJson(Json json) =>
      LiveComment(id: str(json['_id']), text: str(json['text']), createdAt: str(json['createdAt']), author: MiniUser.fromJson(mapOf(json['author'])));

  LiveComment withAuthor(MiniUser author) => LiveComment(id: id, text: text, createdAt: createdAt, author: author);
}

class LiveConnection {
  const LiveConnection({required this.url, required this.token, required this.role});

  final String url;
  final String token;

  /// 'host' | 'viewer' | 'preview'
  final String role;

  factory LiveConnection.fromJson(Json json) => LiveConnection(url: str(json['url']), token: str(json['token']), role: str(json['role'], 'viewer'));
}

class LiveConfig {
  const LiveConfig({required this.live, required this.recording});

  final bool live;
  final bool recording;
}

class CursorPage<T> {
  const CursorPage({required this.items, this.nextBefore});

  final List<T> items;
  final String? nextBefore;
}

/* ---------------------------------------------------------------- Activity */

class SearchEntry {
  const SearchEntry({required this.id, required this.type, required this.query, required this.searchedAt});

  final String id;

  /// 'user' | 'place' | 'post' | 'journey'
  final String type;
  final String query;
  final String searchedAt;

  factory SearchEntry.fromJson(Json json) =>
      SearchEntry(id: str(json['_id']), type: str(json['type']), query: str(json['query']), searchedAt: str(json['searchedAt']));
}

class AccountEvent {
  const AccountEvent({required this.id, required this.type, required this.details, required this.createdAt});

  final String id;
  final String type;
  final Map<String, String> details;
  final String createdAt;

  factory AccountEvent.fromJson(Json json) => AccountEvent(
    id: str(json['_id']),
    type: str(json['type']),
    details: mapOf(json['details']).map((k, v) => MapEntry(k, str(v))),
    createdAt: str(json['createdAt']),
  );
}

class LiveCommentActivity {
  const LiveCommentActivity({
    required this.id,
    required this.text,
    required this.createdAt,
    this.livestreamId,
    this.livestreamTitle,
    this.livestreamLive = false,
    this.host,
  });

  final String id;
  final String text;
  final String createdAt;
  final String? livestreamId;
  final String? livestreamTitle;
  final bool livestreamLive;
  final MiniUser? host;

  factory LiveCommentActivity.fromJson(Json json) {
    final stream = mapOrNull(json['livestream']);
    final host = stream == null ? null : mapOrNull(stream['host']);
    return LiveCommentActivity(
      id: str(json['_id']),
      text: str(json['text']),
      createdAt: str(json['createdAt']),
      livestreamId: stream == null ? null : str(stream['_id']),
      livestreamTitle: stream == null ? null : str(stream['title']),
      livestreamLive: stream != null && str(stream['status']) == 'live',
      host: host == null ? null : MiniUser.fromJson(host),
    );
  }
}

class JourneyCommentActivity {
  const JourneyCommentActivity({required this.comment, this.postId, this.postTitle, this.postCover});

  final Comment comment;
  final String? postId;
  final String? postTitle;
  final String? postCover;
}

/* ------------------------------------------------------------------- Admin */

class AdminUser {
  AdminUser({
    required this.id,
    required this.username,
    required this.displayName,
    required this.email,
    required this.avatarUrl,
    required this.role,
    required this.permissions,
    required this.status,
    required this.lockedReason,
    this.lockedAt,
    required this.emailVerified,
    required this.googleLinked,
    this.lastLoginAt,
    required this.createdAt,
  });

  final String id;
  final String username;
  final String displayName;
  final String email;
  final String avatarUrl;
  final String role;
  final List<String> permissions;

  /// 'active' | 'locked'
  final String status;
  final String lockedReason;
  final String? lockedAt;
  final bool emailVerified;
  final bool googleLinked;
  final String? lastLoginAt;
  final String createdAt;

  factory AdminUser.fromJson(Json json) => AdminUser(
    id: str(json['_id']),
    username: str(json['username']),
    displayName: str(json['displayName']),
    email: str(json['email']),
    avatarUrl: str(json['avatarUrl']),
    role: str(json['role'], 'user'),
    permissions: stringList(json['permissions']),
    status: str(json['status'], 'active'),
    lockedReason: str(json['lockedReason']),
    lockedAt: strOrNull(json['lockedAt']),
    emailVerified: boolOf(json['emailVerified']),
    googleLinked: boolOf(json['googleLinked']),
    lastLoginAt: strOrNull(json['lastLoginAt']),
    createdAt: str(json['createdAt']),
  );
}

class AdminPage<T> {
  const AdminPage({required this.items, required this.total, required this.page, required this.pageSize});

  final List<T> items;
  final int total;
  final int page;
  final int pageSize;

  int get pageCount => pageSize <= 0 ? 1 : ((total + pageSize - 1) ~/ pageSize).clamp(1, 1 << 30);
}

class AdminStats {
  const AdminStats({
    required this.scope,
    required this.total,
    required this.verified,
    required this.locked,
    required this.googleLinked,
    required this.new7,
    required this.new30,
    required this.signupsByDay,
    this.byRole,
    this.adminActions7,
  });

  /// 'users' | 'full'
  final String scope;
  final int total;
  final int verified;
  final int locked;
  final int googleLinked;
  final int new7;
  final int new30;
  final List<(String date, int count)> signupsByDay;
  final Map<String, int>? byRole;
  final int? adminActions7;

  factory AdminStats.fromJson(Json json) {
    final users = mapOf(json['users']);
    final byRole = mapOrNull(json['byRole']);
    return AdminStats(
      scope: str(json['scope'], 'users'),
      total: intOf(users['total']),
      verified: intOf(users['verified']),
      locked: intOf(users['locked']),
      googleLinked: intOf(users['googleLinked']),
      new7: intOf(users['new7']),
      new30: intOf(users['new30']),
      signupsByDay: listOf(json['signupsByDay'], (d) {
        final m = mapOf(d);
        return (str(m['date']), intOf(m['count']));
      }),
      byRole: byRole?.map((k, v) => MapEntry(k, intOf(v))),
      adminActions7: json['adminActions7'] == null ? null : intOf(json['adminActions7']),
    );
  }
}

class AuditEntry {
  const AuditEntry({
    required this.id,
    required this.actorName,
    required this.actorRole,
    required this.action,
    required this.targetLabel,
    required this.details,
    required this.ip,
    required this.createdAt,
  });

  final String id;
  final String actorName;
  final String actorRole;
  final String action;
  final String targetLabel;
  final Json details;
  final String ip;
  final String createdAt;

  factory AuditEntry.fromJson(Json json) => AuditEntry(
    id: str(json['_id']),
    actorName: str(json['actorName']),
    actorRole: str(json['actorRole']),
    action: str(json['action']),
    targetLabel: str(json['targetLabel']),
    details: mapOf(json['details']),
    ip: str(json['ip']),
    createdAt: str(json['createdAt']),
  );
}

class AppSettings {
  const AppSettings({required this.registrationOpen, required this.announcement});

  final bool registrationOpen;
  final String announcement;

  factory AppSettings.fromJson(Json json) => AppSettings(registrationOpen: boolOf(json['registrationOpen'], true), announcement: str(json['announcement']));

  Json toJson() => {'registrationOpen': registrationOpen, 'announcement': announcement};
}
