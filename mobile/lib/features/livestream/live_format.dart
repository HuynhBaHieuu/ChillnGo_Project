import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../core/format.dart';

const reactionEmoji = {'heart': '❤️', 'fire': '🔥', 'clap': '👏', 'wow': '😮', 'haha': '😂'};
const reactionLabel = {'heart': 'Thả tim', 'fire': 'Cháy quá', 'clap': 'Vỗ tay', 'wow': 'Wow', 'haha': 'Haha'};

/// 1234 → "1,2 N", 2_500_000 → "2,5 Tr" (Vietnamese compact notation).
String compact(num n) {
  String one(double value) {
    final rounded = (value * 10).round() / 10;
    final text = rounded == rounded.roundToDouble() ? rounded.toInt().toString() : rounded.toString();
    return text.replaceAll('.', ',');
  }

  if (n >= 1000000000) return '${one(n / 1000000000)} T';
  if (n >= 1000000) return '${one(n / 1000000)} Tr';
  if (n >= 1000) return '${one(n / 1000)} N';
  return n.round().toString();
}

/// 3725 → "1 giờ 2 phút", 185 → "3 phút 5 giây".
String liveDuration(num totalSec) {
  final sec = totalSec.round() < 0 ? 0 : totalSec.round();
  final h = sec ~/ 3600;
  final m = (sec % 3600) ~/ 60;
  final s = sec % 60;
  if (h > 0) return m > 0 ? '$h giờ $m phút' : '$h giờ';
  if (m > 0) return s > 0 ? '$m phút $s giây' : '$m phút';
  return '$s giây';
}

/// A running time: 754 → "12:34", 3725 → "1:02:05".
String liveClock(num totalSec) => clockDuration(totalSec.floor());

const _steadyDigits = TextStyle(fontFeatures: [FontFeature.tabularFigures()]);

/// "1:05 / 3:20" with digits that don't jiggle as they tick. Only the times are
/// tabular: in some fonts (Lora) that feature also widens the space.
TextSpan clockPair(num positionSec, num lengthSec) => TextSpan(
  children: [
    TextSpan(text: liveClock(positionSec), style: _steadyDigits),
    const TextSpan(text: ' / '),
    TextSpan(text: liveClock(lengthSec), style: _steadyDigits),
  ],
);

/// "18:01, 26/09/2026"
String formatStart(String iso) => '${formatClockTime(iso)}, ${formatShortDate(iso)}';

int totalReactions(Map<String, int> reactions) => reactions.values.fold(0, (sum, n) => sum + n);

/// Seconds a stream has been live, counted on from [baseSec] measured at
/// [baseAt] (a local time), so a wrong phone clock does not show a wrong time.
double elapsedSince(double baseSec, DateTime baseAt) {
  final value = baseSec + DateTime.now().difference(baseAt).inMilliseconds / 1000;
  return value < 0 ? 0 : value;
}

/// Rebuilds every second.
class Ticker1s extends StatefulWidget {
  const Ticker1s({super.key, required this.builder});

  final WidgetBuilder builder;

  @override
  State<Ticker1s> createState() => _Ticker1sState();
}

class _Ticker1sState extends State<Ticker1s> {
  late final Timer _timer = Timer.periodic(const Duration(seconds: 1), (_) {
    if (mounted) setState(() {});
  });

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}
