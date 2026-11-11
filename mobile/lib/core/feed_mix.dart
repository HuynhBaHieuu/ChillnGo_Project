/// The "Dành cho bạn" timeline (web/src/lib/feedMix.ts): one news item after
/// every [every] main items; leftover news follows, so an empty timeline still
/// shows news.
library;

List<Object> interleave<P extends Object, N extends Object>(List<P> main, List<N> news, {int every = 3}) {
  final out = <Object>[];
  var n = 0;
  for (var i = 0; i < main.length; i++) {
    out.add(main[i]);
    if ((i + 1) % every == 0 && n < news.length) out.add(news[n++]);
  }
  while (n < news.length) {
    out.add(news[n++]);
  }
  return out;
}
