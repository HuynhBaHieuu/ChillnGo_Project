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

  /// POST /api/admin/moderation/:type/:id/unhide: shows hidden content again.
  static Future<void> unhide(ReportTargetType targetType, String targetId) async {
    await Api.post('/api/admin/moderation/$targetType/$targetId/unhide');
  }
}
