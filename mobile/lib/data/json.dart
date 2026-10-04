/// Lenient readers for JSON from the API and the fixtures: a missing or
/// mistyped field falls back to a sensible empty value instead of throwing.
library;

typedef Json = Map<String, dynamic>;

String str(Object? value, [String fallback = '']) {
  if (value == null) return fallback;
  if (value is String) return value;
  return value.toString();
}

String? strOrNull(Object? value) {
  if (value == null) return null;
  final text = value is String ? value : value.toString();
  return text;
}

int intOf(Object? value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? double.tryParse(value)?.round() ?? fallback;
  return fallback;
}

double doubleOf(Object? value, [double fallback = 0]) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

bool boolOf(Object? value, [bool fallback = false]) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value == 'true';
  return fallback;
}

Json mapOf(Object? value) => value is Map ? value.cast<String, dynamic>() : <String, dynamic>{};

Json? mapOrNull(Object? value) => value is Map ? value.cast<String, dynamic>() : null;

List<T> listOf<T>(Object? value, T Function(Object? item) read) {
  if (value is! List) return <T>[];
  return value.map(read).toList();
}

List<String> stringList(Object? value) => listOf(value, (item) => str(item)).where((s) => s.isNotEmpty).toList();
