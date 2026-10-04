/// Back office (server/src/routes/admin.ts). Every call needs a signed-in admin
/// or superadmin; the server checks the exact permission.
library;

import '../api.dart';
import '../json.dart';
import '../models.dart';

AdminUser _user(Json data) => AdminUser.fromJson(mapOf(data['user']));

abstract final class AdminService {
  static Future<AdminStats> getStats() async => AdminStats.fromJson(await Api.get('/api/admin/stats'));

  static Future<AdminPage<AdminUser>> listUsers({String? q, String? role, String? status, int page = 1}) async {
    final data = await Api.get('/api/admin/users${queryString({'q': q, 'role': role, 'status': status, 'page': page})}');
    return AdminPage(
      items: listOf(data['items'], (u) => AdminUser.fromJson(mapOf(u))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  static Future<AdminUser> lockUser(String id, String reason) async => _user(await Api.post('/api/admin/users/$id/lock', body: {'reason': reason}));

  static Future<AdminUser> unlockUser(String id) async => _user(await Api.post('/api/admin/users/$id/unlock'));

  static Future<String> resetPassword(String id) async =>
      str((await Api.post('/api/admin/users/$id/reset-password'))['message'], 'Đã gửi mật khẩu tạm qua email.');

  static Future<AdminUser> createAdmin({
    required String displayName,
    required String username,
    required String email,
    required String password,
    required List<String> permissions,
  }) async => _user(
    await Api.post(
      '/api/admin/admins',
      body: {'displayName': displayName, 'username': username, 'email': email, 'password': password, 'permissions': permissions},
    ),
  );

  /// [role]: 'user' | 'admin'.
  static Future<AdminUser> setRole(String id, String role, [List<String>? permissions]) async =>
      _user(await Api.patch('/api/admin/users/$id/role', body: {'role': role, 'permissions': ?permissions}));

  static Future<AdminUser> setPermissions(String id, List<String> permissions) async =>
      _user(await Api.patch('/api/admin/admins/$id/permissions', body: {'permissions': permissions}));

  static Future<AdminPage<AuditEntry>> listAuditLogs({String? q, String? action, int page = 1}) async {
    final data = await Api.get('/api/admin/audit-logs${queryString({'q': q, 'action': action, 'page': page})}');
    return AdminPage(
      items: listOf(data['items'], (e) => AuditEntry.fromJson(mapOf(e))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  static Future<AppSettings> getSettings() async => AppSettings.fromJson(mapOf((await Api.get('/api/admin/settings'))['settings']));

  static Future<AppSettings> saveSettings(AppSettings settings) async =>
      AppSettings.fromJson(mapOf((await Api.put('/api/admin/settings', body: settings.toJson()))['settings']));

  /// Public: banner text and whether sign-up is open.
  static Future<AppSettings> getPublicSettings() async => AppSettings.fromJson(mapOf((await Api.get('/api/settings/public', auth: false))['settings']));
}
