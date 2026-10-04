/// "Về ChillnGo" numbers and photos (web/src/services/landing.service.ts).
library;

import '../../core/text.dart';
import '../mock_db.dart';
import '../models.dart';
import '../server_posts.dart';

List<TripPost> _published() => MockDb.instance.tripPosts.where((p) => p.status == 'published').toList();

abstract final class LandingService {
  static Future<LandingStats> getStats() async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    final posts = _published();
    return LandingStats(
      tripCount: posts.length,
      cloneCount: posts.fold(0, (sum, p) => sum + p.cloneCount),
      bookmarkCount: posts.fold(0, (sum, p) => sum + p.bookmarkCount),
      stopCount: posts.fold(0, (sum, p) => sum + p.stopCount),
    );
  }

  static Future<List<DestinationRow>> getDestinationRows() async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    return [
      for (final post in _published())
        for (final day in post.days)
          for (final loc in day.locations)
            DestinationRow(id: loc.id, name: loc.name, lat: loc.lat, lng: loc.lng, postId: post.id, tripTitle: shortTitle(post.title)),
    ];
  }

  /// Trip photos taken round-robin across trips.
  static Future<List<MomentPhoto>> getMomentPhotos(int limit) async {
    await mockDelay();
    final perPost = [
      for (final p in _published())
        [
          for (final d in p.days)
            for (final url in d.photos) MomentPhoto(url: url, postId: p.id, tripTitle: shortTitle(p.title)),
        ],
    ];
    final out = <MomentPhoto>[];
    for (var i = 0; out.length < limit; i++) {
      var added = false;
      for (final photos in perPost) {
        if (i < photos.length && out.length < limit) {
          out.add(photos[i]);
          added = true;
        }
      }
      if (!added) break;
    }
    return out;
  }
}
