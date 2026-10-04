/// Small per-phone preferences, read once at start-up so screens can use them
/// without waiting.
library;

import 'package:shared_preferences/shared_preferences.dart';

abstract final class AppPrefs {
  static const _welcomedKey = 'chillngo.welcomed';
  static const _dismissedAnnouncementKey = 'chillngo.announcement.dismissed';

  /// The welcome screen was seen once; the app then opens on the Newsfeed.
  static bool welcomed = false;

  /// The announcement text the user closed (a new text shows again).
  static String dismissedAnnouncement = '';

  static Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      welcomed = prefs.getBool(_welcomedKey) ?? false;
      dismissedAnnouncement = prefs.getString(_dismissedAnnouncementKey) ?? '';
    } catch (_) {
      // First run, or storage unavailable: defaults.
    }
  }

  static Future<void> markWelcomed() async {
    welcomed = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_welcomedKey, true);
    } catch (_) {}
  }

  static Future<void> dismissAnnouncement(String text) async {
    dismissedAnnouncement = text;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dismissedAnnouncementKey, text);
    } catch (_) {}
  }
}
