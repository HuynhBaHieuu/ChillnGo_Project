import '../../core/text.dart';
import '../../data/models.dart';

class InterestTile {
  const InterestTile({required this.tag, required this.image});

  final String tag;
  final String image;
}

String interestPath(String tag) => '/discover/interest/${Uri.encodeComponent(tag)}';

const _headlines = {
  'ẩm thực': 'Đi để ăn',
  'biển': 'Ra biển thôi',
  'núi': 'Lên núi thôi',
  'tiết kiệm': 'Đi xa, tiêu ít',
  'săn mây': 'Săn mây trên đỉnh',
  'trekking': 'Xỏ giày lên đường',
  'cà phê': 'Đi để ngồi cà phê',
  'văn hóa': 'Đi để hiểu',
  'lặn biển': 'Lặn xuống biển xanh',
};

String interestHeadline(String tag) => _headlines[tag] ?? 'Dành cho người mê $tag';

/// The most-used tags, each pictured by the trip that lists it earliest among
/// its own tags; a cover is used at most once. [posts] must be sorted by saves.
List<InterestTile> pickInterestTiles(List<TripPost> posts, int count, [List<String> exclude = const []]) {
  final counts = <String, int>{};
  for (final post in posts) {
    for (final tag in post.tags) {
      if (!exclude.contains(tag)) counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  final ordered = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
  final used = <String>{};
  final tiles = <InterestTile>[];
  for (final entry in ordered) {
    final tag = entry.key;
    final candidates = posts.where((p) => p.tags.contains(tag) && !used.contains(p.coverUrl)).toList()
      ..sort((x, y) => x.tags.indexOf(tag).compareTo(y.tags.indexOf(tag)));
    if (candidates.isEmpty) continue;
    final post = candidates.first;
    used.add(post.coverUrl);
    tiles.add(InterestTile(tag: tag, image: post.coverUrl));
    if (tiles.length == count) break;
  }
  return tiles;
}

/// One row in the search dropdown (web: searchSuggestions.ts).
sealed class Suggestion {
  const Suggestion();
}

class RecentSuggestion extends Suggestion {
  const RecentSuggestion(this.query);
  final String query;
}

class TripSuggestion extends Suggestion {
  const TripSuggestion(this.post);
  final TripPost post;
}

class StopSuggestion extends Suggestion {
  const StopSuggestion(this.post, this.name);
  final TripPost post;
  final String name;
}

class TagSuggestion extends Suggestion {
  const TagSuggestion(this.tag, this.count);
  final String tag;
  final int count;
}

class AllSuggestion extends Suggestion {
  const AllSuggestion(this.query);
  final String query;
}

class SuggestionGroup {
  const SuggestionGroup(this.label, this.items);

  final String? label;
  final List<Suggestion> items;
}

/// Whether [q] (folded) starts a word in [text]: "ha" finds "Hà Giang", not "Phú".
bool _matches(String text, String q) => ' ${foldText(text)}'.contains(' $q');

List<SuggestionGroup> buildSuggestions(List<TripPost> posts, String query, String region, List<String> recent) {
  final scoped = region == 'all' ? posts : posts.where((p) => p.region == region).toList();
  final q = foldText(query.trim());

  if (q.isEmpty) {
    return [
      SuggestionGroup('Tìm kiếm gần đây', recent.take(4).map(RecentSuggestion.new).toList()),
      SuggestionGroup('Hành trình phổ biến', scoped.take(5).map(TripSuggestion.new).toList()),
    ].where((g) => g.items.isNotEmpty).toList();
  }

  final trips = scoped.where((p) => _matches(p.title, q) || _matches(p.summary, q)).take(5).toList();

  final stops = <Suggestion>[];
  final seen = <String>{};
  for (final post in scoped) {
    for (final day in post.days) {
      for (final stop in day.locations) {
        final key = foldText(stop.name);
        if (stop.name.isEmpty || !_matches(stop.name, q) || seen.contains(key)) continue;
        seen.add(key);
        stops.add(StopSuggestion(post, stop.name));
      }
    }
  }

  final tagCounts = <String, int>{};
  for (final post in scoped) {
    for (final tag in post.tags) {
      if (_matches(tag, q)) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }
  final tags = (tagCounts.entries.toList()..sort((a, b) => b.value.compareTo(a.value))).take(3).map((e) => TagSuggestion(e.key, e.value)).toList();

  return [
    SuggestionGroup('Hành trình', trips.map(TripSuggestion.new).toList()),
    SuggestionGroup('Điểm dừng', stops.take(4).toList()),
    SuggestionGroup('Thẻ', tags),
    SuggestionGroup(null, [AllSuggestion(query.trim())]),
  ].where((g) => g.items.isNotEmpty).toList();
}
