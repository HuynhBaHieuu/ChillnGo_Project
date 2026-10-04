/// Runtime configuration.
///
/// Values come from `--dart-define-from-file=.env` (see .env.example and the
/// README). Every value is optional: without them the app talks to the API on
/// this computer, maps fall back to OpenStreetMap, and Google sign-in is hidden.
library;

import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

String? _optional(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

const _apiUrlDefine = String.fromEnvironment('API_URL');
const _webUrlDefine = String.fromEnvironment('WEB_URL');
const _mapboxDefine = String.fromEnvironment('MAPBOX_TOKEN');
const _googleWebDefine = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');
const _googleIosDefine = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

/// Where an API address typed in the app (Menu, "Máy chủ API") is kept.
const kApiUrlOverrideKey = 'chillngo.apiUrl';

abstract final class Env {
  static String _apiUrl = 'http://10.0.2.2:4000';
  static String _defaultApiUrl = 'http://10.0.2.2:4000';

  /// The API's address, without a trailing slash.
  static String get apiUrl => _apiUrl;

  /// What the address would be without an override typed in the app.
  static String get defaultApiUrl => _defaultApiUrl;

  /// The web app's address, for links shared from the phone (e.g. https://chillngo.vercel.app).
  static final String? webUrl = _optional(_webUrlDefine)?.replaceFirst(RegExp(r'/$'), '');

  /// Mapbox public token: map tiles, place search, reverse geocoding, road routes.
  static final String? mapboxToken = _optional(_mapboxDefine);

  /// Google OAuth "Web" client id, the same as GOOGLE_CLIENT_ID on the server.
  static final String? googleWebClientId = _optional(_googleWebDefine);

  /// Google OAuth "iOS" client id (iOS builds only).
  static final String? googleIosClientId = _optional(_googleIosDefine);

  /// Decides the API address once, at start-up.
  ///
  /// 1. An address typed in the app (kept on the phone).
  /// 2. API_URL from .env.
  /// 3. The computer running the API on port 4000: the Android emulator reaches it
  ///    as 10.0.2.2; a phone on USB reaches it as localhost after
  ///    `adb reverse tcp:4000 tcp:4000`.
  static Future<void> load() async {
    _defaultApiUrl = await _computeDefault();
    String? override;
    try {
      final prefs = await SharedPreferences.getInstance();
      override = _optional(prefs.getString(kApiUrlOverrideKey) ?? '');
    } catch (_) {
      override = null;
    }
    _apiUrl = _clean(override ?? _defaultApiUrl);
  }

  static Future<String> _computeDefault() async {
    final configured = _optional(_apiUrlDefine);
    if (configured != null) return _clean(configured);
    if (Platform.isAndroid) {
      try {
        final info = await DeviceInfoPlugin().androidInfo;
        return info.isPhysicalDevice ? 'http://localhost:4000' : 'http://10.0.2.2:4000';
      } catch (_) {
        return 'http://10.0.2.2:4000';
      }
    }
    return 'http://localhost:4000';
  }

  /// Uses another API address from now on (null: back to the default).
  static Future<void> setApiUrlOverride(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    final value = _optional(url ?? '');
    if (value == null) {
      await prefs.remove(kApiUrlOverrideKey);
      _apiUrl = _defaultApiUrl;
    } else {
      await prefs.setString(kApiUrlOverrideKey, _clean(value));
      _apiUrl = _clean(value);
    }
  }

  static bool get hasApiUrlOverride => _apiUrl != _defaultApiUrl;

  static String _clean(String url) {
    var value = url.trim().replaceFirst(RegExp(r'/+$'), '');
    if (!value.startsWith('http://') && !value.startsWith('https://')) value = 'http://$value';
    return value;
  }
}
