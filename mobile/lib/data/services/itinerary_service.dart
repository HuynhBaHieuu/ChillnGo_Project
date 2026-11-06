/// Cloned itineraries ("Đã sao chép"), stored by the API
/// (server/src/routes/itineraries.ts) and private to their owner, as on the
/// web (web/src/services/itinerary.service.ts).
///
/// The demo journeys (ids like p_001) exist only in this app, so cloning or
/// merging one sends its days along; the API reads its own journeys itself.
library;

import '../../core/photos.dart';
import '../api.dart';
import '../json.dart';
import '../mock_db.dart';
import '../models.dart';
import '../server_posts.dart';
import '../../core/i18n.dart';

/// A demo journey's days as the app has them; nothing for one the API stores.
Json? _sampleSource(String postId, [List<String>? dayIds]) {
  if (isServerId(postId)) return null;
  final post = assertFound(MockDb.instance.postById(postId), t('Không tìm thấy hành trình này.'));
  return {
    'title': post.title,
    'coverUrl': post.coverUrl,
    'startDate': post.startDate,
    'days': [for (final d in post.days) if (dayIds == null || dayIds.contains(d.id)) d.toJson()],
  };
}

/// The answer's itinerary, with the automatic cover a journey without photos gets.
ClonedItinerary _read(Json data) {
  final itinerary = ClonedItinerary.fromJson(mapOf(data['itinerary']));
  if (itinerary.coverUrl.isEmpty) itinerary.coverUrl = autoCover(itinerary.title);
  return itinerary;
}

abstract final class ItineraryService {
  static Future<List<ClonedItinerary>> getMyItineraries(String ownerId) async {
    final data = await Api.get('/api/itineraries');
    return listOf(data['items'], (i) => _read({'itinerary': i}));
  }

  /// Someone else's answers "not found".
  static Future<ClonedItinerary> getItineraryById(String id, {String? ownerId}) async => _read(await Api.get('/api/itineraries/$id'));

  /// Copies every day of a post into a new itinerary owned by the viewer.
  static Future<ClonedItinerary> clonePost({required String postId, required String ownerId, String? title, String? startDate}) async {
    final itinerary = _read(
      await Api.post('/api/itineraries', body: {'postId': postId, 'title': ?title, 'startDate': ?startDate, 'source': ?_sampleSource(postId)}),
    );
    // The API counted it on its own journeys; this keeps the open page in step until the next sync.
    MockDb.instance.postById(postId)?.cloneCount += 1;
    return itinerary;
  }

  /// A new day order; days are renumbered and re-dated.
  static Future<ClonedItinerary> reorderDays(String id, List<String> orderedDayIds) async =>
      _read(await Api.patch('/api/itineraries/$id/days', body: {'dayIds': orderedDayIds}));

  /// Appends the chosen days of other journeys, in order.
  static Future<ClonedItinerary> mergeInto(String itineraryId, List<({String postId, List<String> dayIds})> selections) async => _read(
    await Api.post(
      '/api/itineraries/$itineraryId/merge',
      body: {
        'selections': [
          for (final s in selections) {'postId': s.postId, 'dayIds': s.dayIds, 'source': ?_sampleSource(s.postId, s.dayIds)},
        ],
      },
    ),
  );

  static Future<ClonedItinerary> removeDay(String id, String dayId) async => _read(await Api.delete('/api/itineraries/$id/days/$dayId'));
}
