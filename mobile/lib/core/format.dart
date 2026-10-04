/// Numbers, money and dates in Vietnamese (web/src/lib/format.ts).
library;

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
String formatVnd(num amount) => '${groupThousands(amount)} ₫';

String _decimal(double value) {
  final rounded = (value * 10).round() / 10;
  final text = rounded == rounded.roundToDouble() ? rounded.toInt().toString() : rounded.toString();
  return text.replaceAll('.', ',');
}

/// 1_910_000 → "1,9tr"
String formatVndShort(num amount) {
  if (amount >= 1000000) {
    final millions = amount / 1000000;
    return millions >= 10 ? '${millions.round()}tr' : '${_decimal(millions.toDouble())}tr';
  }
  if (amount >= 1000) return '${(amount / 1000).round()}k';
  return amount.round().toString();
}

/// 1284 → "1,3k"
String formatCount(num count) {
  if (count >= 1000000) return '${_decimal(count / 1000000)}tr';
  if (count >= 1000) return '${_decimal(count / 1000)}k';
  return count.round().toString();
}

/// 12345 → "12.345"
String formatNumber(num n) => groupThousands(n);

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
    text = 'dưới 1 phút';
  } else if (minutes < 45) {
    text = '${minutes < 1 ? 1 : minutes} phút';
  } else if (minutes < 90) {
    text = 'khoảng 1 giờ';
  } else if (minutes < 1440) {
    text = 'khoảng ${(minutes / 60).round()} giờ';
  } else if (minutes < 2520) {
    text = '1 ngày';
  } else if (minutes < 43200) {
    text = '${(minutes / 1440).round()} ngày';
  } else if (minutes < 86400) {
    text = 'khoảng ${(minutes / 43200).round()} tháng';
  } else if (minutes < 525600) {
    text = '${(minutes / 43200).round()} tháng';
  } else {
    final years = minutes / 525600;
    final whole = years.floor();
    final rest = years - whole;
    if (rest < 0.25) {
      text = 'khoảng $whole năm';
    } else if (rest < 0.75) {
      text = 'hơn $whole năm';
    } else {
      text = 'gần ${whole + 1} năm';
    }
  }
  return future ? '$text nữa' : '$text trước';
}

/// "vừa xong" under a minute, otherwise [relativeTime].
String timeAgo(String iso) {
  final date = parseDate(iso);
  if (date == null) return '';
  if (DateTime.now().difference(date).inSeconds.abs() < 60) return 'vừa xong';
  return relativeTime(iso);
}

/// "Thứ năm, 16 thg 10 2025"
String formatLongDate(String date) {
  final d = parseDate(date);
  if (d == null) return date;
  return '${_weekdays[d.weekday - 1]}, ${d.day} thg ${d.month} ${d.year}';
}

/// "16/10/2025"
String formatShortDate(String date) {
  final d = parseDate(date);
  if (d == null) return date;
  return '${_two(d.day)}/${_two(d.month)}/${d.year}';
}

/// "16 – 19 thg 10, 2025"
String formatDateRange(String start, String end) {
  final from = parseDate(start);
  final to = parseDate(end);
  if (from == null || to == null) return '$start – $end';
  if (from.year == to.year && from.month == to.month) {
    return '${from.day} – ${to.day} thg ${to.month}, ${to.year}';
  }
  return '${from.day} thg ${from.month} – ${to.day} thg ${to.month}, ${to.year}';
}

/// "14:05, 12/03/2026"; "Chưa từng" when there is no date.
String formatDateTime(String? iso) {
  final d = parseDate(iso);
  if (d == null) return iso == null || iso.isEmpty ? 'Chưa từng' : iso;
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
String tripLengthLabel(int dayCount) => '${dayCount}N${dayCount - 1 < 0 ? 0 : dayCount - 1}Đ';

/// "1:05:12" or "12:04"
String clockDuration(num totalSeconds) {
  final s = totalSeconds.round() < 0 ? 0 : totalSeconds.round();
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = _two(s % 60);
  return h > 0 ? '$h:${_two(m)}:$sec' : '$m:$sec';
}
