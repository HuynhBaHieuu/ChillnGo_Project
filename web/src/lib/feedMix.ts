/**
 * The "Dành cho bạn" timeline: posts from people you follow, with one news
 * item after every `every` posts. Kept free of imports so it can be tested
 * on its own (web/tests/feedMix.test.ts).
 */

export type Mixed<P, N> = { kind: 'main'; value: P } | { kind: 'news'; value: N }

/**
 * Puts one news item after every `every` main items. When the main items run
 * out, the remaining news follows, so an empty timeline still shows news.
 */
export function interleave<P, N>(main: readonly P[], news: readonly N[], every = 3): Mixed<P, N>[] {
  const out: Mixed<P, N>[] = []
  let n = 0
  main.forEach((value, i) => {
    out.push({ kind: 'main', value })
    if ((i + 1) % every === 0 && n < news.length) out.push({ kind: 'news', value: news[n++] })
  })
  while (n < news.length) out.push({ kind: 'news', value: news[n++] })
  return out
}
