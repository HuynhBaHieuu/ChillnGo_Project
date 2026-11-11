/// Travel news for the Newsfeed (server/src/routes/news.ts; web:
/// news.service.ts) and Admin → Tin tức (server/src/routes/adminNews.ts).
library;

import '../api.dart';
import '../json.dart';
import '../models.dart';

/// A travel news item gathered from an outside source. Readers open [url].
class NewsItem {
  const NewsItem({
    required this.id,
    required this.sourceId,
    required this.sourceName,
    required this.sourceType,
    required this.platform,
    required this.url,
    required this.title,
    required this.summary,
    required this.imageUrl,
    this.images = const [],
    this.content = const [],
    this.originalTitle = '',
    required this.kind,
    required this.author,
    required this.publishedAt,
    required this.pinned,
    required this.regions,
    required this.destinations,
    required this.savedByMe,
    this.status,
    this.statusReason = '',
    this.excerpt = '',
    this.headline = '',
    this.aiSummary = '',
    this.writtenAt,
    this.aiStatus,
    this.clickCount = 0,
  });

  final String id;
  final String sourceId;
  final String sourceName;
  final String sourceType;
  final String? platform;
  final String url;
  /// The AI's Vietnamese headline, or the source's own title.
  final String title;
  final String summary;

  /// The cover picture.
  final String imageUrl;

  /// Every picture of the post, the cover first.
  final List<String> images;

  /// The post's paragraphs. Only on the post's own screen and in admin views.
  final List<String> content;

  /// The source's own title. Only on the post's own screen and in admin views.
  final String originalTitle;

  /// article | video | post
  final String kind;
  final String author;
  final String publishedAt;
  final bool pinned;
  final List<String> regions;
  final List<String> destinations;
  final bool savedByMe;

  /// Admin views only.
  final String? status;
  final String statusReason;
  final String excerpt;

  /// The headline and summary as stored ('' when the AI has not written them).
  final String headline;
  final String aiSummary;

  /// When the AI last wrote the post; null when it never did.
  final String? writtenAt;
  final String? aiStatus;
  final int clickCount;

  factory NewsItem.fromJson(Json json) => NewsItem(
    id: str(json['_id']),
    sourceId: str(json['sourceId']),
    sourceName: str(json['sourceName']),
    sourceType: str(json['sourceType'], 'rss'),
    platform: strOrNull(json['platform']),
    url: str(json['url']),
    title: str(json['title']),
    summary: str(json['summary']),
    imageUrl: str(json['imageUrl']),
    images: stringList(json['images']),
    content: stringList(json['content']),
    originalTitle: str(json['originalTitle']),
    kind: str(json['kind'], 'article'),
    author: str(json['author']),
    publishedAt: str(json['publishedAt']),
    pinned: boolOf(json['pinned']),
    regions: stringList(json['regions']),
    destinations: stringList(json['destinations']),
    savedByMe: boolOf(json['savedByMe']),
    status: strOrNull(json['status']),
    statusReason: str(json['statusReason']),
    excerpt: str(json['excerpt']),
    headline: str(json['headline']),
    aiSummary: str(json['aiSummary']),
    writtenAt: strOrNull(json['writtenAt']),
    aiStatus: strOrNull(json['aiStatus']),
    clickCount: intOf(json['clickCount']),
  );

  NewsItem copyWith({bool? savedByMe}) => NewsItem(
    id: id,
    sourceId: sourceId,
    sourceName: sourceName,
    sourceType: sourceType,
    platform: platform,
    url: url,
    title: title,
    summary: summary,
    imageUrl: imageUrl,
    images: images,
    content: content,
    originalTitle: originalTitle,
    kind: kind,
    author: author,
    publishedAt: publishedAt,
    pinned: pinned,
    regions: regions,
    destinations: destinations,
    savedByMe: savedByMe ?? this.savedByMe,
    status: status,
    statusReason: statusReason,
    excerpt: excerpt,
    headline: headline,
    aiSummary: aiSummary,
    writtenAt: writtenAt,
    aiStatus: aiStatus,
    clickCount: clickCount,
  );
}

const platformNames = {
  'twitter': 'X',
  'reddit': 'Reddit',
  'youtube': 'YouTube',
  'facebook': 'Facebook',
  'instagram': 'Instagram',
  'xiaohongshu': 'Xiaohongshu',
  'bilibili': 'Bilibili',
};

/// "VnExpress", or "Reddit · r/VietNam" for social posts.
String newsOrigin(NewsItem item) {
  final platform = item.platform;
  if (platform == null) return item.sourceName;
  return [platformNames[platform] ?? platform, item.author].where((s) => s.isNotEmpty).join(' · ');
}

class NewsSource {
  const NewsSource({
    required this.id,
    required this.name,
    required this.type,
    required this.url,
    required this.query,
    required this.platform,
    required this.includeKeywords,
    required this.excludeKeywords,
    required this.defaultRegion,
    required this.enabled,
    required this.autoPublish,
    required this.intervalMinutes,
    required this.lastRunAt,
    required this.lastStatus,
    required this.lastError,
    required this.lastNewCount,
    required this.published,
    required this.pending,
  });

  final String id;
  final String name;

  /// rss | google_news | youtube_channel | social
  final String type;
  final String url;
  final String query;
  final String? platform;
  final List<String> includeKeywords;
  final List<String> excludeKeywords;
  final String? defaultRegion;
  final bool enabled;
  final bool autoPublish;
  final int intervalMinutes;
  final String? lastRunAt;
  final String? lastStatus;
  final String lastError;
  final int lastNewCount;
  final int published;
  final int pending;

  factory NewsSource.fromJson(Json json) {
    final counts = mapOf(json['counts']);
    return NewsSource(
      id: str(json['_id']),
      name: str(json['name']),
      type: str(json['type'], 'rss'),
      url: str(json['url']),
      query: str(json['query']),
      platform: strOrNull(json['platform']),
      includeKeywords: stringList(json['includeKeywords']),
      excludeKeywords: stringList(json['excludeKeywords']),
      defaultRegion: strOrNull(json['defaultRegion']),
      enabled: boolOf(json['enabled'], true),
      autoPublish: boolOf(json['autoPublish']),
      intervalMinutes: intOf(json['intervalMinutes'], 60),
      lastRunAt: strOrNull(json['lastRunAt']),
      lastStatus: strOrNull(json['lastStatus']),
      lastError: str(json['lastError']),
      lastNewCount: intOf(json['lastNewCount']),
      published: intOf(counts['published']),
      pending: intOf(counts['pending']) + intOf(counts['queued']),
    );
  }

  /// What PUT /api/admin/news/sources/:id takes, with [patch] on top.
  Json toInput([Json patch = const {}]) => {
    'name': name,
    'type': type,
    'url': url,
    'query': query,
    'platform': platform,
    'includeKeywords': includeKeywords,
    'excludeKeywords': excludeKeywords,
    'defaultRegion': defaultRegion,
    'enabled': enabled,
    'autoPublish': autoPublish,
    'intervalMinutes': intervalMinutes,
    ...patch,
  };
}

class NewsRun {
  const NewsRun({
    required this.id,
    required this.sourceName,
    required this.trigger,
    required this.fetched,
    required this.created,
    required this.duplicates,
    required this.filtered,
    required this.error,
    required this.durationMs,
    required this.createdAt,
  });

  final String id;
  final String sourceName;
  final String trigger;
  final int fetched;
  final int created;
  final int duplicates;
  final int filtered;
  final String error;
  final int durationMs;
  final String createdAt;

  factory NewsRun.fromJson(Json json) => NewsRun(
    id: str(json['_id']),
    sourceName: str(json['sourceName']),
    trigger: str(json['trigger']),
    fetched: intOf(json['fetched']),
    created: intOf(json['created']),
    duplicates: intOf(json['duplicates']),
    filtered: intOf(json['filtered']),
    error: str(json['error']),
    durationMs: intOf(json['durationMs']),
    createdAt: str(json['createdAt']),
  );
}

class NewsWorker {
  const NewsWorker({required this.hasKey, required this.keyHint, required this.createdAt, required this.lastSeenAt, required this.socialSources});

  final bool hasKey;
  final String keyHint;
  final String? createdAt;
  final String? lastSeenAt;
  final int socialSources;

  factory NewsWorker.fromJson(Json json) => NewsWorker(
    hasKey: boolOf(json['hasKey']),
    keyHint: str(json['keyHint']),
    createdAt: strOrNull(json['createdAt']),
    lastSeenAt: strOrNull(json['lastSeenAt']),
    socialSources: intOf(json['socialSources']),
  );
}

abstract final class NewsService {
  /// Published news, newest first; pinned first on the first page.
  static Future<CursorPage<NewsItem>> list({String? region, String? before, int limit = 20}) async {
    final data = await Api.get('/api/news${queryString({'region': region, 'before': before, 'limit': limit})}');
    return CursorPage(items: listOf(data['items'], (i) => NewsItem.fromJson(mapOf(i))), nextBefore: strOrNull(data['nextBefore']));
  }

  static Future<List<NewsItem>> saved() async {
    final data = await Api.get('/api/news/saved');
    return listOf(data['items'], (i) => NewsItem.fromJson(mapOf(i)).copyWith(savedByMe: true));
  }

  /// Saves or unsaves; returns whether it is now saved.
  static Future<bool> toggleSave(String id) async => boolOf((await Api.post('/api/news/$id/save'))['saved']);

  /// One published item with its post (paragraphs and pictures).
  static Future<NewsItem> get(String id) async => NewsItem.fromJson(mapOf((await Api.get('/api/news/$id'))['item']));

  /// Counts a reader opening the post; never fails the screen itself.
  static void recordClick(String id) {
    Api.post('/api/news/$id/click', auth: false).catchError((_) => <String, dynamic>{});
  }

  /* ---------------------------------------------------------------- admin */

  static Future<List<NewsSource>> sources() async => listOf((await Api.get('/api/admin/news/sources'))['items'], (s) => NewsSource.fromJson(mapOf(s)));

  static Future<void> createSource(Json input) async => Api.post('/api/admin/news/sources', body: input);

  static Future<void> updateSource(String id, Json input) async => Api.put('/api/admin/news/sources/$id', body: input);

  static Future<void> deleteSource(String id) async => Api.delete('/api/admin/news/sources/$id');

  /// Up to 5 items the source would bring in, and how many it has.
  static Future<({List<Json> items, int total})> preview({required String type, required String url, required String query}) async {
    final data = await Api.post('/api/admin/news/sources/preview', body: {'type': type, 'url': url, 'query': query}, timeout: const Duration(seconds: 40));
    return (items: listOf(data['items'], mapOf), total: intOf(data['total']));
  }

  static Future<({Json result, int enriched})> runSource(String id) async {
    final data = await Api.post('/api/admin/news/sources/$id/run', timeout: const Duration(seconds: 60));
    return (result: mapOf(data['result']), enriched: intOf(data['enriched']));
  }

  static Future<({List<Json> sources, int enriched})> runAll() async {
    final data = await Api.post('/api/admin/news/run', timeout: const Duration(seconds: 90));
    return (sources: listOf(data['sources'], mapOf), enriched: intOf(data['enriched']));
  }

  static Future<AdminPage<NewsItem>> items({required String status, String? q, int page = 1}) async {
    final data = await Api.get('/api/admin/news/items${queryString({'status': status, 'q': q, 'page': page > 1 ? page : null})}');
    return AdminPage(
      items: listOf(data['items'], (i) => NewsItem.fromJson(mapOf(i))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  static Future<void> patchItem(String id, Json patch) async => Api.patch('/api/admin/news/items/$id', body: patch);

  /// The AI reads the original again and writes the post anew.
  static Future<NewsItem> rewriteItem(String id) async => NewsItem.fromJson(mapOf((await Api.post('/api/admin/news/items/$id/rewrite'))['item']));

  /// approve | reject | hide | unhide.
  static Future<int> review(List<String> ids, String action, {String reason = ''}) async =>
      intOf((await Api.post('/api/admin/news/items/review', body: {'ids': ids, 'action': action, 'reason': reason}))['updated']);

  static Future<AdminPage<NewsRun>> runs({int page = 1}) async {
    final data = await Api.get('/api/admin/news/runs${queryString({'page': page > 1 ? page : null})}');
    return AdminPage(
      items: listOf(data['items'], (r) => NewsRun.fromJson(mapOf(r))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  static Future<NewsWorker> worker() async => NewsWorker.fromJson(await Api.get('/api/admin/news/worker'));

  static Future<String> createWorkerKey() async => str((await Api.post('/api/admin/news/worker/key'))['key']);

  static Future<void> revokeWorkerKey() async => Api.delete('/api/admin/news/worker/key');
}
