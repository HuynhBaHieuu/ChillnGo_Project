import 'dart:convert';
import 'dart:io';

import 'package:chillngo/core/i18n.dart';
import 'package:flutter_test/flutter_test.dart';

/// Every key passed to t() in lib/, as written ('…' with Dart escapes).
Set<String> keysInLib() {
  final keys = <String>{};
  final start = RegExp(r"(?<![\w.])t\('");
  for (final file in Directory('lib').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
    final src = file.readAsStringSync();
    for (final m in start.allMatches(src)) {
      final key = StringBuffer();
      var i = m.end;
      while (src[i] != "'") {
        if (src[i] == r'\') {
          final c = src[i + 1];
          key.write(c == 'n' ? '\n' : c);
          i += 2;
        } else {
          key.write(src[i++]);
        }
      }
      keys.add(key.toString());
    }
  }
  return keys;
}

void main() {
  test('every t() key has all four translations, with the same placeholders', () {
    Map<String, dynamic> read(String name) => jsonDecode(File('assets/i18n/$name.json').readAsStringSync()) as Map<String, dynamic>;
    final catalog = {...read('web'), ...read('mobile')};
    final placeholders = RegExp(r'\{(\w+)\}');
    Set<String> names(String text) => placeholders.allMatches(text).map((m) => m[1]!).toSet();

    final problems = <String>[];
    for (final key in keysInLib()) {
      final entry = catalog[key] as Map<String, dynamic>?;
      if (entry == null) {
        problems.add('missing: $key');
        continue;
      }
      for (final lang in ['en', 'zh', 'ja', 'ko']) {
        final value = entry[lang];
        final texts = value is List ? value.cast<String>() : [if (value is String) value];
        if (texts.isEmpty) problems.add('no $lang: $key');
        for (final text in texts) {
          if (!names(text).containsAll(names(key.split('#').first))) problems.add('$lang placeholders: $key → $text');
        }
      }
    }
    expect(problems, isEmpty, reason: 'Add these to assets/i18n/mobile.json');
  });

  test('t() fills params, picks plurals and falls back to Vietnamese', () {
    addTranslations({
      '{n} ngày': {'en': ['{n} day', '{n} days']},
      'Còn {left} lượt': {'en': ['{left} left', '{left} left (many)']},
    });
    locale.value = 'en';
    expect(t('{n} ngày', {'n': 1}), '1 day');
    expect(t('{n} ngày', {'n': 3}), '3 days');
    // No `n`: the first number decides.
    expect(t('Còn {left} lượt', {'left': 1}), '1 left');
    expect(t('Chưa dịch {x}', {'x': 'a'}), 'Chưa dịch a');
    expect(tx('đã thích hành trình “Huế”'), t('đã thích hành trình “{title}”', {'title': 'Huế'}));
    locale.value = 'vi';
    expect(t('{n} ngày', {'n': 3}), '3 ngày');
  });
}
