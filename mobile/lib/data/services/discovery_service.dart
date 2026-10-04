/// Discover (web/src/services/discovery.service.ts): filtering over the merged
/// demo + API journeys, accent-insensitive like the search suggestions.
library;

import '../../core/text.dart';
import '../mock_db.dart';
import '../models.dart';
import '../server_posts.dart';
import 'post_service.dart';

class DiscoverFilters {
  const DiscoverFilters({
    this.region = 'all',
    this.season = 'all',
    this.tags = const [],
    this.budgetLevels = const [],
    this.minCost = 0,
    this.maxCost = 1 << 52,
    this.query = '',
  });

  final String region;
  final String season;
  final List<String> tags;
  final List<String> budgetLevels;
  final int minCost;
  final int maxCost;
  final String query;

  DiscoverFilters copyWith({String? region, String? season, List<String>? tags, List<String>? budgetLevels, String? query}) => DiscoverFilters(
    region: region ?? this.region,
    season: season ?? this.season,
    tags: tags ?? this.tags,
    budgetLevels: budgetLevels ?? this.budgetLevels,
    minCost: minCost,
    maxCost: maxCost,
    query: query ?? this.query,
  );

  String get key => [region, season, tags.join('|'), budgetLevels.join('|'), minCost, maxCost, query].join('#');

  @override
  bool operator ==(Object other) => other is DiscoverFilters && other.key == key;

  @override
  int get hashCode => key.hashCode;
}

abstract final class DiscoveryService {
  /// Published posts matching the filters, most-saved first.
  static Future<List<TripPost>> discoverPosts(DiscoverFilters filters, String? viewerId) async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    final query = foldText(filters.query.trim());
    bool has(String text) => foldText(text).contains(query);

    final posts =
        MockDb.instance.tripPosts
            .where((p) => p.status == 'published')
            .where((p) => filters.region == 'all' || p.region == filters.region)
            .where((p) => filters.season == 'all' || p.season == filters.season)
            .where((p) => filters.tags.isEmpty || filters.tags.any(p.tags.contains))
            .where((p) => filters.budgetLevels.isEmpty || filters.budgetLevels.contains(p.budgetLevel))
            .where((p) => p.totalEstCost >= filters.minCost && p.totalEstCost <= filters.maxCost)
            .where((p) => query.isEmpty || has(p.title) || has(p.summary) || p.tags.any(has) || p.days.any((d) => d.locations.any((l) => has(l.name))))
            .toList()
          ..sort((a, b) => b.bookmarkCount.compareTo(a.bookmarkCount));
    return posts.map((p) => decorate(p, viewerId)).toList();
  }

  /// Every tag in use, most common first.
  static Future<List<({String tag, int count})>> getAllTags() async {
    await Future.wait([mockDelay(), syncServerPosts()]);
    final counts = <String, int>{};
    for (final post in MockDb.instance.tripPosts) {
      if (post.status != 'published') continue;
      for (final tag in post.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    final list = counts.entries.map((e) => (tag: e.key, count: e.value)).toList()
      ..sort((a, b) => b.count != a.count ? b.count.compareTo(a.count) : foldText(a.tag).compareTo(foldText(b.tag)));
    return list;
  }
}
