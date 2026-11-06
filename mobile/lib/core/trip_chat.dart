/// Reads the AI clone chat's replies, in Vietnamese or plain English
/// (web/src/features/ai-clone/chatParse.ts). Answers are a map keyed by the
/// form's fields (startDate, days, groupSize, withChildren, withElderly,
/// budget, departure, interests, pace); a missing key keeps its default, and
/// `budget: null` means no budget.
library;

/// The questions, in the order the chat asks them.
enum Slot { date, days, group, budget, departure, interests, pace, merge }

/// Which question each answer settles.
const slotOf = {
  'startDate': Slot.date,
  'days': Slot.days,
  'groupSize': Slot.group,
  'withChildren': Slot.group,
  'withElderly': Slot.group,
  'budget': Slot.budget,
  'departure': Slot.departure,
  'interests': Slot.interests,
  'pace': Slot.pace,
};

/// "Skip", "no", "don't know": the asked question keeps its default.
final skipReply = RegExp(r'^(bỏ qua|không|ko|k|no|skip|chưa biết|tuỳ|tùy|sao cũng được|không có)$');

const _notLetter = r'(?!\p{L})';

RegExp _re(String pattern) => RegExp(pattern, unicode: true);

String _iso(DateTime d) => DateTime.utc(d.year, d.month, d.day).toIso8601String().substring(0, 10);

String _plusDays(DateTime today, int n) => _iso(DateTime.utc(today.year, today.month, today.day + n));

/// The coming Saturday (today if it is Saturday).
String thisWeekend(DateTime today) => _plusDays(today, (6 - today.weekday % 7 + 7) % 7);

String nextWeek(DateTime today) => _plusDays(today, 7);

String? _parseDate(String text, DateTime today) {
  // "/" and "-" only: "5.000.000" is money, not 5 January.
  final m = RegExp(r'(?<!\d)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?(?!\d)').firstMatch(text);
  if (m != null) {
    final day = int.parse(m[1]!), month = int.parse(m[2]!);
    final y = m[3];
    var year = y == null ? today.year : int.parse(y.length == 2 ? '20$y' : y);
    var date = DateTime.utc(year, month, day);
    if (date.month != month) return null; // 31/02
    // No year and already past: they mean next year.
    if (y == null && date.isBefore(DateTime.utc(today.year, today.month, today.day))) date = DateTime.utc(++year, month, day);
    return _iso(date);
  }
  if (RegExp('ngày mai|tomorrow').hasMatch(text)) return _plusDays(today, 1);
  if (RegExp('tuần sau|tuần tới|next week').hasMatch(text)) return nextWeek(today);
  if (RegExp('cuối tuần|weekend').hasMatch(text)) return thisWeekend(today);
  return null;
}

/// Null: nothing said about money. `(amount: null)`: no budget.
({int? amount})? _parseBudget(String text) {
  if (RegExp('không giới hạn|thoải mái|no limit|unlimited|không có ngân sách').hasMatch(text)) return (amount: null);
  final million = _re('(\\d+(?:[.,]\\d+)?)\\s*(triệu|tr|củ|m|million)$_notLetter').firstMatch(text);
  if (million != null) return (amount: (double.parse(million[1]!.replaceFirst(',', '.')) * 1000000).round());
  final thousand = _re('(\\d+)\\s*(k|nghìn|ngàn)$_notLetter').firstMatch(text);
  if (thousand != null) return (amount: int.parse(thousand[1]!) * 1000);
  final plain = RegExp(r'\d{1,3}(?:[.,]\d{3})+|\d{6,}').firstMatch(text);
  if (plain != null) return (amount: int.parse(plain[0]!.replaceAll(RegExp(r'\D'), '')));
  return null;
}

int? _inRange(num n, int min, int max) => n == n.roundToDouble() && n >= min && n <= max ? n.toInt() : null;

/// Whatever a reply says about the trip: "3 ngày, 4 người có trẻ em, 5 triệu,
/// từ Hà Nội". A bare number or place name answers the question being asked.
/// Out-of-range values are left out, so the question is asked again.
Map<String, Object?> parseTripReply(String raw, Slot? asking, List<({String value, String label})> interests, DateTime today) {
  final source = raw.trim();
  // Vietnamese letters lowercase one to one, so indexes carry over to `source`.
  final text = source.toLowerCase();
  final out = <String, Object?>{};
  void put(String key, Object? value) => value == null ? out.remove(key) : out[key] = value;

  final startDate = _parseDate(text, today);
  put('startDate', startDate);

  // "3 ngày", "3n2đ", "3 days"; not "2 người".
  final days = _re('(\\d{1,2})\\s*(?:ngày|n|days?)$_notLetter').firstMatch(text);
  if (days != null) put('days', _inRange(int.parse(days[1]!), 1, 14));

  final people = _re('(\\d{1,2})\\s*(?:người|ng|khách|pax|people|persons?)$_notLetter').firstMatch(text);
  if (people != null) {
    put('groupSize', _inRange(int.parse(people[1]!), 1, 30));
  } else if (RegExp('một mình|1 mình|solo|alone').hasMatch(text)) {
    out['groupSize'] = 1;
  } else if (RegExp('cặp đôi|vợ chồng|người yêu|couple|partner').hasMatch(text)) {
    out['groupSize'] = 2;
  }

  if (RegExp(r'không\s+(?:có\s+)?(?:trẻ|con|em bé)|no kids?').hasMatch(text)) {
    out['withChildren'] = false;
  } else if (RegExp('trẻ em|trẻ nhỏ|con nhỏ|em bé|kids?|child').hasMatch(text)) {
    out['withChildren'] = true;
  }
  if (RegExp(r'không\s+(?:có\s+)?(?:người già|người lớn tuổi)').hasMatch(text)) {
    out['withElderly'] = false;
  } else if (RegExp('người già|lớn tuổi|cao tuổi|ông bà|elderly|grandparents?').hasMatch(text)) {
    out['withElderly'] = true;
  }

  // A date's digits are not money.
  final budget = _parseBudget(startDate != null ? text.replaceFirst(RegExp(r'\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?'), '') : text);
  if (budget != null) out['budget'] = budget.amount;

  // "từ Hà Nội", not "từ 20/11"; cut at punctuation or the next number.
  final from = _re(r'(?:^|\s)(?:từ|from)\s+(\p{L}[^,.;!?\n\d]*)').firstMatch(text);
  if (from != null) {
    final departure = source.substring(from.end - from[1]!.length, from.end).trim();
    out['departure'] = departure.length > 100 ? departure.substring(0, 100) : departure;
  }

  if (RegExp('thong thả|nhẹ nhàng|thư giãn|chill|relax|chậm rãi').hasMatch(text)) {
    out['pace'] = 'relaxed';
  } else if (RegExp('dày đặc|nhiều điểm|đi nhiều|tối đa|packed').hasMatch(text)) {
    out['pace'] = 'packed';
  } else if (RegExp('vừa phải|moderate').hasMatch(text) || (asking == Slot.pace && RegExp('vừa|bình thường|normal').hasMatch(text))) {
    out['pace'] = 'moderate';
  }

  final picked = [for (final i in interests) if (text.contains(i.label.toLowerCase())) i.value];
  if (picked.isNotEmpty) {
    out['interests'] = picked;
  } else if (asking == Slot.interests && RegExp(r'^(tất cả|all|gì cũng được)$').hasMatch(text)) {
    out['interests'] = <String>[];
  }

  // A bare answer to the question being asked.
  final bare = RegExp(r'^\d+([.,]\d+)?$').hasMatch(text) ? double.parse(text.replaceFirst(',', '.')) : null;
  if (bare != null) {
    if (asking == Slot.days) put('days', _inRange(bare, 1, 14));
    if (asking == Slot.group) put('groupSize', _inRange(bare, 1, 30));
    // "5" for a budget means 5 million.
    if (asking == Slot.budget) out['budget'] = (bare < 1000 ? bare * 1000000 : bare).round();
  }
  if (asking == Slot.departure && !out.containsKey('departure') && !skipReply.hasMatch(text) && !RegExp(r'\d').hasMatch(text)) {
    out['departure'] = source.length > 100 ? source.substring(0, 100) : source;
  }
  return out;
}
