/// Demo data layer, shared in shape with web/src/services/client.ts.
///
/// Likes, bookmarks, trip comments, cloned itineraries and the demo accounts'
/// journeys are not on the server yet (see server/README.md). They live in an
/// in-memory database seeded from the same JSON fixtures as the web app
/// (assets/mocks), so both clients show the same demo content. Writes survive
/// navigation and reset when the app restarts.
library;

import 'dart:convert';
import 'dart:math';

import 'package:flutter/services.dart';

import 'api.dart';
import 'json.dart';
import 'models.dart';

class LikeRecord {
  LikeRecord(this.userId, this.postId);

  final String userId;
  final String postId;
}

class MockDb {
  MockDb._();

  static final MockDb instance = MockDb._();

  List<User> users = [];
  List<TripPost> tripPosts = [];
  List<Comment> comments = [];
  List<Follow> follows = [];
  List<Bookmark> bookmarks = [];
  List<ClonedItinerary> clonedItineraries = [];
  List<AppNotification> notifications = [];

  /// Session-local like records; the fixtures only carry counts.
  final List<LikeRecord> likes = [];

  bool _loaded = false;

  static Future<List<Json>> _fixture(String name) async {
    final text = await rootBundle.loadString('assets/mocks/$name.json');
    final data = jsonDecode(text);
    return data is List ? data.map(mapOf).toList() : <Json>[];
  }

  /// Reads the fixtures once, at start-up.
  Future<void> load() async {
    if (_loaded) return;
    users = (await _fixture('users')).map(User.fromJson).toList();
    tripPosts = (await _fixture('tripPosts')).map(TripPost.fromJson).toList();
    comments = (await _fixture('comments')).map(Comment.fromJson).toList();
    follows = (await _fixture('follows')).map(Follow.fromJson).toList();
    bookmarks = (await _fixture('bookmarks')).map(Bookmark.fromJson).toList();
    clonedItineraries = (await _fixture('clonedItineraries')).map(ClonedItinerary.fromJson).toList();
    notifications = (await _fixture('notifications')).map(AppNotification.fromJson).toList();
    _loaded = true;
  }

  User? userById(String id) {
    for (final user in users) {
      if (user.id == id) return user;
    }
    return null;
  }

  TripPost? postById(String id) {
    for (final post in tripPosts) {
      if (post.id == id) return post;
    }
    return null;
  }
}

final _random = Random();

/// A short artificial delay so loading states behave as they will with a real API.
Future<void> mockDelay() => Future.delayed(Duration(milliseconds: 150 + _random.nextInt(100)));

var _idCounter = 0;

String nextId(String prefix) {
  _idCounter += 1;
  return '${prefix}_local_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}$_idCounter';
}

String nowIso() => DateTime.now().toUtc().toIso8601String();

T assertFound<T>(T? value, String message) {
  if (value == null) throw ApiError(message, status: 404);
  return value;
}

/// Shown for content whose author account no longer exists.
User deletedUser(String id) =>
    User(id: id, username: 'deleted', displayName: 'Tài khoản đã xoá', createdAt: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true).toIso8601String());

/// Newest first by an ISO timestamp.
int byNewest(String a, String b) => _ms(b).compareTo(_ms(a));

int _ms(String iso) => DateTime.tryParse(iso)?.millisecondsSinceEpoch ?? 0;
