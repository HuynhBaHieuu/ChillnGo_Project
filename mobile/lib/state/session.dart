/// The signed-in session: the API token (kept in the phone's secure storage)
/// and the user record (kept in preferences), as web/src/store/auth.store.ts.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/api.dart';
import '../data/json.dart';
import '../data/models.dart';
import '../data/services/auth_service.dart';

const _tokenKey = 'chillngo.token';
const _userKey = 'chillngo.user';

const _secure = FlutterSecureStorage();

@immutable
class SessionState {
  const SessionState({this.token, this.user, this.hydrated = false});

  final String? token;
  final User? user;

  /// True once the stored session has been read at start-up.
  final bool hydrated;

  bool get signedIn => token != null && user != null;
  String? get userId => user?.id;
}

class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() => const SessionState();

  /// Reads the stored session. Called once before the first screen.
  Future<void> hydrate() async {
    String? token;
    User? user;
    try {
      token = await _secure.read(key: _tokenKey);
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_userKey);
      if (raw != null) user = User.fromJson(mapOf(jsonDecode(raw)));
    } catch (error) {
      debugPrint('Stored session unreadable: $error');
      token = null;
      user = null;
    }
    if (token == null || user == null) {
      token = null;
      user = null;
    }
    restoreMirror(user);
    state = SessionState(token: token, user: user, hydrated: true);
  }

  Future<void> signIn(AuthSession session) async {
    state = SessionState(token: session.token, user: session.user, hydrated: true);
    await _persist();
  }

  Future<void> signOut() async {
    state = const SessionState(hydrated: true);
    try {
      await _secure.delete(key: _tokenKey);
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_userKey);
    } catch (_) {
      // Nothing stored.
    }
  }

  /// Replaces the user record (after a profile edit or a /me refresh).
  Future<void> setUser(User user) async {
    if (state.token == null) return;
    state = SessionState(token: state.token, user: user, hydrated: true);
    await _persist();
  }

  Future<void> _persist() async {
    final token = state.token;
    final user = state.user;
    if (token == null || user == null) return;
    try {
      await _secure.write(key: _tokenKey, value: token);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userKey, jsonEncode(user.toJson()));
    } catch (error) {
      debugPrint('Session not saved: $error');
    }
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(SessionController.new);

/// The signed-in user's id, or null.
final viewerIdProvider = Provider<String?>((ref) => ref.watch(sessionProvider.select((s) => s.user?.id)));

/// The one provider container of the app, so code outside widgets (the API
/// transport) can read the session.
final appContainer = ProviderContainer(
  // Requests are not retried automatically; screens offer "Thử lại".
  retry: (_, _) => null,
);

/// Connects the API transport to the session.
void wireSession() {
  Api.readToken = () => appContainer.read(sessionProvider).token;
  Api.readViewerId = () => appContainer.read(sessionProvider).user?.id;
  Api.onUnauthorized = (token) {
    if (appContainer.read(sessionProvider).token == token) {
      appContainer.read(sessionProvider.notifier).signOut();
    }
  };
}

/// Notifies the router whenever the session changes.
class SessionListenable extends ChangeNotifier {
  SessionListenable() {
    _subscription = appContainer.listen<SessionState>(sessionProvider, (previous, next) {
      if (previous?.token != next.token || previous?.user?.role != next.user?.role || previous?.hydrated != next.hydrated) {
        notifyListeners();
      }
    });
  }

  late final ProviderSubscription<SessionState> _subscription;

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}
