/// Authentication against the API (server/src/routes/auth.ts). Every signed-in
/// user is mirrored into the demo `users` table so demo-backed features
/// (comments, likes, clones) can show who did what, as on the web.
library;

import '../../core/photos.dart';
import '../api.dart';
import '../json.dart';
import '../mock_db.dart';
import '../models.dart';

/// The API stores an empty avatar/cover for new accounts; the app picks a travel photo.
User withDefaultPhotos(User user) {
  final shown = user.copy();
  if (shown.avatarUrl.isEmpty) shown.avatarUrl = travelAvatar(shown.username);
  if (shown.coverUrl.isEmpty) shown.coverUrl = travelBanner(shown.username);
  return shown;
}

void _mirror(User user) {
  final db = MockDb.instance;
  final index = db.users.indexWhere((u) => u.id == user.id);
  if (index == -1) {
    db.users.add(user.copy());
  } else {
    db.users[index] = user.copy();
  }
}

/// Makes a user record from the API the one the app shows.
User adoptUser(User user) {
  final shown = withDefaultPhotos(user);
  _mirror(shown);
  return shown;
}

/// A restored session must be in the demo table before the first demo query.
void restoreMirror(User? user) {
  if (user != null) _mirror(user);
}

AuthSession _session(Json data) => AuthSession(token: str(data['token']), user: adoptUser(User.fromJson(mapOf(data['user']))));

abstract final class AuthService {
  static Future<AuthSession> login(String email, String password) async {
    final data = await Api.post('/api/auth/login', body: {'email': email.trim(), 'password': password}, auth: false);
    return _session(data);
  }

  /// Creates the account; the server emails a verification link. Returns where it was sent.
  static Future<({String email, bool emailSent})> register({
    required String displayName,
    required String username,
    required String email,
    required String password,
  }) async {
    final data = await Api.post(
      '/api/auth/register',
      body: {'displayName': displayName.trim(), 'username': username.trim(), 'email': email.trim(), 'password': password},
      auth: false,
    );
    return (email: str(data['email'], email.trim()), emailSent: boolOf(data['emailSent'], true));
  }

  static Future<AuthSession> loginWithGoogle(String credential) async {
    final data = await Api.post('/api/auth/google', body: {'credential': credential}, auth: false);
    return _session(data);
  }

  static Future<AuthSession> verifyEmail(String token) async {
    final data = await Api.post('/api/auth/verify-email', body: {'token': token}, auth: false);
    return _session(data);
  }

  static Future<String> resendVerification(String email) async {
    final data = await Api.post('/api/auth/resend-verification', body: {'email': email.trim()}, auth: false);
    return str(data['message'], 'Đã gửi lại email xác minh.');
  }

  /// Re-reads the user behind the stored token. ApiError 401 when it is no longer valid.
  static Future<User> currentUser() async {
    final data = await Api.get('/api/auth/me');
    return adoptUser(User.fromJson(mapOf(data['user'])));
  }
}
