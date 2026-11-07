/// Translation, as on the web (web/src/i18n). Strings are written in
/// Vietnamese and wrapped in `t()`, the Vietnamese being the key:
///
///     t('Đăng nhập')                         → "Log in"
///     t('{n} ngày', {'n': 3})                → "3 days"
///
/// Translations come from assets/i18n: web.json is the web's catalog
/// (`node scripts/export-i18n.mjs` copies it), mobile.json the app's own
/// strings, which win. A pair ["one", "other"] is picked by the `n` param.
/// A missing translation shows the Vietnamese. Text only known at run time
/// (a label from data, a message from the API) goes through [tx].
///
/// Changing language rebuilds the whole app (app.dart keys it on [locale]),
/// so plain `t()` calls always see the current language. Tables of labels
/// are getters, so they translate on every read.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The languages the app speaks, by code, named in their own language.
const locales = {'vi': 'Tiếng Việt', 'en': 'English', 'zh': '中文', 'ja': '日本語', 'ko': '한국어'};

/// Short names for tight spots (web: LOCALE_INFO.short).
const localeShort = {'vi': 'VI', 'en': 'EN', 'zh': '中', 'ja': '日', 'ko': '한'};

/// BCP 47 tags, for dates.
const localeTags = {'vi': 'vi_VN', 'en': 'en_US', 'zh': 'zh_CN', 'ja': 'ja_JP', 'ko': 'ko_KR'};

/// The chosen language.
final locale = ValueNotifier<String>('vi');

const _prefsKey = 'chillngo.locale';
final _catalog = <String, Map<String, Object?>>{};

/// Reads the catalogs and the saved language (else the phone's, when spoken here).
Future<void> loadI18n() async {
  for (final file in ['web', 'mobile']) {
    try {
      final json = jsonDecode(await rootBundle.loadString('assets/i18n/$file.json')) as Map<String, dynamic>;
      json.forEach((key, value) => _catalog[key] = (value as Map).cast<String, Object?>());
    } catch (error) {
      debugPrint('Translations $file.json not loaded: $error');
    }
  }
  String? saved;
  try {
    saved = (await SharedPreferences.getInstance()).getString(_prefsKey);
  } catch (_) {}
  final phone = PlatformDispatcher.instance.locale.languageCode;
  locale.value = locales.containsKey(saved) ? saved! : (locales.containsKey(phone) ? phone : 'vi');
}

Future<void> setLocale(String code) async {
  locale.value = code;
  try {
    await (await SharedPreferences.getInstance()).setString(_prefsKey, code);
  } catch (_) {}
}

/// Mapbox's code for the current language, for place search.
String get mapLanguage => locale.value == 'zh' ? 'zh-Hans' : locale.value;

/// Adds translations (tests).
@visibleForTesting
void addTranslations(Map<String, Map<String, Object?>> entries) => _catalog.addAll(entries);

/// [key] in the current language, with its `{params}` filled in.
String t(String key, [Map<String, Object?>? params]) {
  final hash = key.indexOf('#');
  final source = hash < 0 ? key : key.substring(0, hash);
  final entry = locale.value == 'vi' ? null : _catalog[key]?[locale.value];
  // A pair is picked by `n`, else by the first number among the params.
  final count = params?['n'] ?? params?.values.whereType<num>().firstOrNull;
  final text = switch (entry) {
    final List<dynamic> pair => '${pair[count == 1 ? 0 : 1]}',
    final String s => s,
    _ => source,
  };
  if (params == null) return text;
  return text.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => params.containsKey(m[1]) ? '${params[m[1]]}' : m[0]!);
}

/// Server notifications write “của bạn” / “của họ” in place of an empty title.
const _noTitle = {'của bạn', 'của họ'};

/// Text the API composes in Vietnamese, matched by pattern (web/src/i18n/server.ts).
final _rules = <(RegExp, String Function(RegExpMatch))>[
  (
    RegExp(r'^đã thích hành trình “(.*)”$', dotAll: true),
    (m) => _noTitle.contains(m[1]) ? t('đã thích hành trình của bạn') : t('đã thích hành trình “{title}”', {'title': m[1]}),
  ),
  (RegExp(r'^đang phát trực tiếp: “(.*)”$', dotAll: true), (m) => t('đang phát trực tiếp: “{title}”', {'title': m[1]})),
  (RegExp(r'^đã trả lời bình luận của bạn: “(.*)”$', dotAll: true), (m) => t('đã trả lời bình luận của bạn: “{text}”', {'text': m[1]})),
  (RegExp(r'^đã bình luận hành trình “(.*?)”: “(.*)”$', dotAll: true), (m) => t('đã bình luận hành trình “{title}”: “{text}”', {'title': m[1], 'text': m[2]})),
  (
    RegExp(r'^mời bạn đi cùng hành trình “(.*)”$', dotAll: true),
    (m) => _noTitle.contains(m[1]) ? t('mời bạn đi cùng hành trình của họ') : t('mời bạn đi cùng hành trình “{title}”', {'title': m[1]}),
  ),
  (
    RegExp(r'^đã nhận lời đi cùng hành trình “(.*)”$', dotAll: true),
    (m) => _noTitle.contains(m[1]) ? t('đã nhận lời đi cùng hành trình của bạn') : t('đã nhận lời đi cùng hành trình “{title}”', {'title': m[1]}),
  ),
  (
    RegExp(r'^đã (?:clone|sao chép) hành trình “(.*)” bằng AI$', dotAll: true),
    (m) => _noTitle.contains(m[1]) ? t('đã sao chép hành trình của bạn bằng AI') : t('đã sao chép hành trình “{title}” bằng AI', {'title': m[1]}),
  ),
  (
    RegExp(r'^đã (?:clone|sao chép) hành trình “(.*)”$', dotAll: true),
    (m) => _noTitle.contains(m[1]) ? t('đã sao chép hành trình của bạn') : t('đã sao chép hành trình “{title}”', {'title': m[1]}),
  ),
  (RegExp(r'^đã (?:clone|sao chép) lịch trình (.*) của bạn$', dotAll: true), (m) => t('đã sao chép lịch trình {title} của bạn', {'title': m[1]})),
  (
    RegExp(r'^Bản nháp “(.*)” chưa được đăng\. Hoàn thiện để chia sẻ nhé\.$', dotAll: true),
    (m) => t('Bản nháp “{title}” chưa được đăng. Hoàn thiện để chia sẻ nhé.', {'title': m[1]}),
  ),
  (RegExp(r'^Đã gửi email xác nhận mới tới (.*)\.$', dotAll: true), (m) => t('Đã gửi email xác nhận mới tới {email}.', {'email': m[1]})),
  (RegExp(r'^Đã gửi mật khẩu tạm thời tới (.*)\.$', dotAll: true), (m) => t('Đã gửi mật khẩu tạm thời tới {email}.', {'email': m[1]})),
  (
    RegExp(r'^Email vừa được gửi\. Vui lòng đợi (\d+) giây rồi thử lại\.$'),
    (m) => t('Email vừa được gửi. Vui lòng đợi {n} giây rồi thử lại.', {'n': int.parse(m[1]!)}),
  ),
  (
    RegExp(r'^Tài khoản của bạn đã bị khoá: (.*)\. Liên hệ quản trị viên', dotAll: true),
    (m) => t('Tài khoản của bạn đã bị khoá: {reason}. Liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn.', {'reason': m[1]}),
  ),
  (RegExp(r'^Hành trình “(.*)” chưa có điểm dừng nào\.$', dotAll: true), (m) => t('Hành trình “{title}” chưa có điểm dừng nào.', {'title': m[1]})),
  (RegExp(r'^(?:Clone|Sao chép) từ hành trình “(.*)”\.$', dotAll: true), (m) => t('Sao chép từ hành trình “{title}”.', {'title': m[1]})),
  (RegExp(r'^Bản nháp chỉ có (\d+) ngày\.$'), (m) => t('Bản nháp chỉ có {n} ngày.', {'n': int.parse(m[1]!)})),
  (RegExp(r'^Tối đa (\d+) ảnh$'), (m) => t('Tối đa {n} ảnh', {'n': int.parse(m[1]!)})),
  (RegExp(r'^Mỗi hành trình mời tối đa (\d+) người đi cùng\.$'), (m) => t('Mỗi hành trình mời tối đa {n} người đi cùng.', {'n': int.parse(m[1]!)})),
];

/// Text only known at run time: a catalog string is translated, a server
/// message matched by pattern, anything else comes back as is.
String tx(String text) {
  if (locale.value == 'vi' || text.isEmpty) return text;
  if (_catalog.containsKey(text)) return t(text);
  for (final (pattern, translate) in _rules) {
    final match = pattern.firstMatch(text);
    if (match != null) return translate(match);
  }
  return text;
}
