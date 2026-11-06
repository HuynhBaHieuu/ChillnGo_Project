/// Numbers, money and dates (web/src/lib/format.ts). Dates read the Vietnamese
/// way in Vietnamese, and as intl formats them in the other languages.
library;

import 'package:intl/intl.dart';

import 'i18n.dart';

bool get _vi => locale.value == 'vi';

String get _tag => localeTags[locale.value]!;

/// 1910000 → "1.910.000"
String groupThousands(num amount) {
  final rounded = amount.abs().round().toString();
  final out = StringBuffer();
  for (var i = 0; i < rounded.length; i++) {
    if (i > 0 && (rounded.length - i) % 3 == 0) out.write('.');
    out.write(rounded[i]);
  }
  return amount < 0 ? '-$out' : out.toString();
}

/// 1_910_000 → "1.910.000 ₫"
String formatVnd(num amount) =>
    _vi ? '${groupThousands(amount)} ₫' : NumberFormat.currency(locale: _tag, name: 'VND', symbol: '₫', decimalDigits: 0).format(amount);

String _decimal(double value) {
  final rounded = (value * 10).round() / 10;
  final text = rounded == rounded.roundToDouble() ? rounded.toInt().toString() : rounded.toString();
  return text.replaceAll('.', ',');
}

/// 1_910_000 → "1,9tr"
String formatVndShort(num amount) {
  if (!_vi) return NumberFormat.compactCurrency(locale: _tag, symbol: '₫', decimalDigits: 1).format(amount);
  if (amount >= 1000000) {
    final millions = amount / 1000000;
    return millions >= 10 ? '${millions.round()}tr' : '${_decimal(millions.toDouble())}tr';
  }
  if (amount >= 1000) return '${(amount / 1000).round()}k';
  return amount.round().toString();
}

/// 1284 → "1,3k"
String formatCount(num count) {
  if (!_vi) return NumberFormat.compact(locale: _tag).format(count);
  if (count >= 1000000) return '${_decimal(count / 1000000)}tr';
  if (count >= 1000) return '${_decimal(count / 1000)}k';
  return count.round().toString();
}

/// 3.2 → "3,2" in Vietnamese, "3.2" in English.
String formatDecimal(num n) => NumberFormat.decimalPatternDigits(locale: _tag, decimalDigits: 1).format(n);

/// 12345 → "12.345"
String formatNumber(num n) => _vi ? groupThousands(n) : NumberFormat.decimalPattern(_tag).format(n);

DateTime? parseDate(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  return DateTime.tryParse(iso)?.toLocal();
}

String _two(int n) => n.toString().padLeft(2, '0');

const _weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

/// "khoảng 2 tháng trước", "3 phút trước", "vừa xong".
String relativeTime(String iso) {
  final date = parseDate(iso);
  if (date == null) return '';
  final diff = DateTime.now().difference(date);
  final future = diff.isNegative;
  final seconds = diff.inSeconds.abs();
  final minutes = (seconds / 60).round();

  String text;
  if (seconds < 30) {
    text = t('dưới 1 phút');
  } else if (minutes < 45) {
    text = t('{value} phút', {'value': minutes < 1 ? 1 : minutes});
  } else if (minutes < 90) {
    text = t('khoảng 1 giờ');
  } else if (minutes < 1440) {
    text = t('khoảng {value} giờ', {'value': (minutes / 60).round()});
  } else if (minutes < 2520) {
    text = t('1 ngày');
  } else if (minutes < 43200) {
    text = t('{value} ngày', {'value': (minutes / 1440).round()});
  } else if (minutes < 86400) {
    text = t('khoảng {value} tháng', {'value': (minutes / 43200).round()});
  } else if (minutes < 525600) {
    text = t('{value} tháng', {'value': (minutes / 43200).round()});
  } else {
    final years = minutes / 525600;
    final whole = years.floor();
    final rest = years - whole;
    if (rest < 0.25) {
      text = t('khoảng {whole} năm', {'whole': whole});
    } else if (rest < 0.75) {
      text = t('hơn {whole} năm', {'whole': whole});
    } else {
      text = t('gần {value} năm', {'value': whole + 1});
    }
  }
  return future ? t('{text} nữa', {'text': text}) : t('{text} trước', {'text': text});
}

/// "vừa xong" under a minute, otherwise [relativeTime].
String timeAgo(String iso) {
  final date = parseDate(iso);
  if (date == null) return '';
  if (DateTime.now().difference(date).inSeconds.abs() < 60) return t('vừa xong');
  return relativeTime(iso);
}

/// "Thứ năm, 16 thg 10 2025"
String formatLongDate(String date) {
  final d = parseDate(date);
  if (d == null) return date;
  if (!_vi) return DateFormat.yMMMMEEEEd(_tag).format(d);
  return '${_weekdays[d.weekday - 1]}, ${d.day} thg ${d.month} ${d.year}';
}

/// "16/10/2025"
String formatShortDate(String date) {
  final d = parseDate(date);
  if (d == null) return date;
  if (!_vi) return DateFormat.yMd(_tag).format(d);
  return '${_two(d.day)}/${_two(d.month)}/${d.year}';
}

/// "16 – 19 thg 10, 2025"
String formatDateRange(String start, String end) {
  final from = parseDate(start);
  final to = parseDate(end);
  if (from == null || to == null) return '$start – $end';
  if (!_vi) return '${DateFormat.MMMd(_tag).format(from)} – ${DateFormat.yMMMd(_tag).format(to)}';
  if (from.year == to.year && from.month == to.month) {
    return '${from.day} – ${to.day} thg ${to.month}, ${to.year}';
  }
  return '${from.day} thg ${from.month} – ${to.day} thg ${to.month}, ${to.year}';
}

/// "14:05, 12/03/2026"; "Chưa từng" when there is no date.
String formatDateTime(String? iso) {
  final d = parseDate(iso);
  if (d == null) return iso == null || iso.isEmpty ? t('Chưa từng') : iso;
  if (!_vi) return DateFormat.yMd(_tag).add_Hm().format(d);
  return '${_two(d.hour)}:${_two(d.minute)}, ${_two(d.day)}/${_two(d.month)}/${d.year}';
}

/// "14:05"
String formatClockTime(String iso) {
  final d = parseDate(iso);
  if (d == null) return '';
  return '${_two(d.hour)}:${_two(d.minute)}';
}

/// DateTime → "2025-10-16" (local calendar day).
String toDateOnly(DateTime date) => '${date.year}-${_two(date.month)}-${_two(date.day)}';

/// "2025-10-16" → a local DateTime at midnight.
DateTime fromDateOnly(String value) {
  final parts = value.split('-').map((p) => int.tryParse(p) ?? 1).toList();
  return DateTime(parts.isNotEmpty ? parts[0] : 2000, parts.length > 1 ? parts[1] : 1, parts.length > 2 ? parts[2] : 1);
}

/// Whole days from now until `iso` (never negative).
int daysUntil(String iso) {
  final d = parseDate(iso);
  if (d == null) return 0;
  final ms = d.difference(DateTime.now()).inMilliseconds;
  return ms <= 0 ? 0 : (ms / (24 * 3600 * 1000)).ceil();
}

/// "4N3Đ" from a day count.
String tripLengthLabel(int dayCount) => t('{days}N{nights}Đ', {'days': dayCount, 'nights': dayCount - 1 < 0 ? 0 : dayCount - 1});

/// "1:05:12" or "12:04"
String clockDuration(num totalSeconds) {
  final s = totalSeconds.round() < 0 ? 0 : totalSeconds.round();
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = _two(s % 60);
  return h > 0 ? '$h:${_two(m)}:$sec' : '$m:$sec';
}
