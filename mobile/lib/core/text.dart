/// Text helpers for search and validation (web/src/lib/text.ts).
library;

const _vietnamese = <String, String>{
  'a': 'àáạảãâầấậẩẫăằắặẳẵ',
  'e': 'èéẹẻẽêềếệểễ',
  'i': 'ìíịỉĩ',
  'o': 'òóọỏõôồốộổỗơờớợởỡ',
  'u': 'ùúụủũưừứựửữ',
  'y': 'ỳýỵỷỹ',
  'd': 'đ',
};

final Map<int, String> _fold = () {
  final map = <int, String>{};
  _vietnamese.forEach((base, marked) {
    for (final rune in marked.runes) {
      final ch = String.fromCharCode(rune);
      map[rune] = base;
      map[ch.toUpperCase().runes.first] = base;
    }
  });
  return map;
}();

/// Lower-case and drop Vietnamese diacritics, so "ha giang" finds "Hà Giang"
/// and "da lat" finds "Đà Lạt".
String foldText(String text) {
  final out = StringBuffer();
  for (final rune in text.toLowerCase().runes) {
    // Combining marks, in case the text arrived decomposed.
    if (rune >= 0x0300 && rune <= 0x036F) continue;
    out.write(_fold[rune] ?? String.fromCharCode(rune));
  }
  return out.toString();
}

/// A letter in any script: it has an upper and a lower case form.
bool isLetter(String ch) => ch.toLowerCase() != ch.toUpperCase();

bool isUpperLetter(String ch) => isLetter(ch) && ch == ch.toUpperCase() && ch != ch.toLowerCase();

bool isDigit(String ch) => ch.compareTo('0') >= 0 && ch.compareTo('9') <= 0 && ch.length == 1;

bool isSpace(String ch) => ch.trim().isEmpty;

/// The characters of a string (code points).
Iterable<String> chars(String text) => text.runes.map(String.fromCharCode);

/// Splits text into words of letters and digits, dropping punctuation.
List<String> words(String text) {
  final out = <String>[];
  final current = StringBuffer();
  for (final ch in chars(text.toLowerCase())) {
    if (isLetter(ch) || isDigit(ch)) {
      current.write(ch);
    } else if (current.isNotEmpty) {
      out.add(current.toString());
      current.clear();
    }
  }
  if (current.isNotEmpty) out.add(current.toString());
  return out;
}

/// "Hà Giang Loop 4N3Đ — cung đường đá và mây" → "Hà Giang Loop 4N3Đ"
String shortTitle(String title) => title.split(' — ').first.trim();

/// The first letter, for an avatar without a photo.
String initialOf(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return '?';
  return String.fromCharCode(trimmed.runes.first).toUpperCase();
}
