/// Reports ("Báo cáo") and the moderation queue, stored by the API:
/// server/src/routes/reports.ts for reporting, /api/admin/reports for
/// moderators (web/src/services/report.service.ts).
///
/// Only content the API stores can be reported; the sample journeys and
/// accounts that live only in this app (ids like p_001) cannot.
library;

import '../api.dart';
import '../json.dart';
import '../models.dart';
import '../server_posts.dart';

abstract final class ReportService {
  /// Whether [id] is something the API stores, and so can be reported.
  static bool canReport(String? id) => id != null && isServerId(id);

  /// POST /api/reports: 409 ALREADY_REPORTED the second time, 400 SELF_REPORT for your own.
  static Future<void> createReport({required ReportTargetType targetType, required String targetId, required String reason, String note = ''}) async {
    await Api.post('/api/reports', body: {'targetType': targetType, 'targetId': targetId, 'reason': reason, 'note': note.trim()});
  }

  /// GET /api/admin/reports: reports grouped by the content they are about.
  static Future<AdminPage<ReportGroup>> getQueue({String status = 'pending', ReportTargetType? targetType, int page = 1}) async {
    final data = await Api.get('/api/admin/reports${queryString({'status': status, 'targetType': targetType, 'page': page > 1 ? page : null})}');
    return AdminPage(
      items: listOf(data['items'], (g) => ReportGroup.fromJson(mapOf(g))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  /// GET /api/admin/reports/target/:type/:id: the content and every report about it.
  static Future<({ReportTargetDetail target, List<ReportEntry> reports})> getTarget(ReportTargetType targetType, String targetId) async {
    final data = await Api.get('/api/admin/reports/target/$targetType/$targetId');
    return (target: ReportTargetDetail.fromJson(mapOf(data['target'])), reports: listOf(data['reports'], (r) => ReportEntry.fromJson(mapOf(r))));
  }

  /// POST /api/admin/reports/target/:type/:id/resolve: decides every pending report about it.
  /// Returns how many reports were decided.
  static Future<int> resolve(ReportTargetType targetType, String targetId, String action, String note) async {
    final data = await Api.post('/api/admin/reports/target/$targetType/$targetId/resolve', body: {'action': action, 'note': note.trim()});
    return intOf(data['resolved']);
  }

  /// GET /api/admin/moderation: what moderation has hidden or removed right now.
  /// [targetType]: 'post' | 'checkin' | 'comment'.
  static Future<AdminPage<HiddenItem>> listHidden({required ReportTargetType targetType, int page = 1}) async {
    final data = await Api.get('/api/admin/moderation${queryString({'targetType': targetType, 'page': page})}');
    return AdminPage(
      items: listOf(data['items'], (i) => HiddenItem.fromJson(mapOf(i))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  /// GET /api/admin/livestreams: every stream live right now [content].
  static Future<List<LiveStreamRow>> listLiveStreams() async =>
      listOf((await Api.get('/api/admin/livestreams'))['items'], (i) => LiveStreamRow.fromJson(mapOf(i)));

  /// POST /api/admin/livestreams/:id/end: stops a stream; the host is told why.
  static Future<void> endLiveStream(String id, String reason) async {
    await Api.post('/api/admin/livestreams/$id/end', body: {'reason': reason.trim()});
  }

  /// POST /api/admin/moderation/:type/:id/unhide: shows hidden content again.
  static Future<void> unhide(ReportTargetType targetType, String targetId) async {
    await Api.post('/api/admin/moderation/$targetType/$targetId/unhide');
  }
}

/// Content hidden or removed by moderation (web: HiddenItem).
class HiddenItem {
  const HiddenItem({
    required this.targetType,
    required this.targetId,
    required this.snapshot,
    this.owner,
    this.action = 'hide',
    this.reason = '',
    this.hiddenAt,
    this.hiddenBySystem = false,
    this.hiddenBy,
  });

  final ReportTargetType targetType;
  final String targetId;
  final ReportSnapshot snapshot;
  final ReportPerson? owner;

  /// 'hide' | 'remove' ("remove" also put it in the author's Recently Deleted).
  final String action;
  final String reason;
  final String? hiddenAt;
  final bool hiddenBySystem;
  final ReportPerson? hiddenBy;

  factory HiddenItem.fromJson(Json json) => HiddenItem(
    targetType: str(json['targetType']),
    targetId: str(json['targetId']),
    snapshot: ReportSnapshot.fromJson(json['snapshot']),
    owner: ReportPerson.fromJson(json['owner']),
    action: str(json['action'], 'hide'),
    reason: str(json['reason']),
    hiddenAt: strOrNull(json['hiddenAt']),
    hiddenBySystem: boolOf(json['hiddenBySystem']),
    hiddenBy: ReportPerson.fromJson(json['hiddenBy']),
  );
}

/// A stream on air, for moderators (web: LiveStreamRow).
class LiveStreamRow {
  const LiveStreamRow({
    required this.id,
    required this.title,
    this.audience = 'public',
    this.startedAt,
    this.viewerCount = 0,
    this.peakViewers = 0,
    this.commentCount = 0,
    this.host,
  });

  final String id;
  final String title;

  /// 'public' | 'followers' | 'private'
  final String audience;
  final String? startedAt;
  final int viewerCount;
  final int peakViewers;
  final int commentCount;
  final ReportPerson? host;

  factory LiveStreamRow.fromJson(Json json) => LiveStreamRow(
    id: str(json['_id']),
    title: str(json['title']),
    audience: str(json['audience'], 'public'),
    startedAt: strOrNull(json['startedAt']),
    viewerCount: intOf(json['viewerCount']),
    peakViewers: intOf(json['peakViewers']),
    commentCount: intOf(json['commentCount']),
    host: ReportPerson.fromJson(json['host']),
  );
}
