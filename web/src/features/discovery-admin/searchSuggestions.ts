import { foldText as fold } from '@/lib/format'
import type { Region, TripPostWithAuthor } from '@/services/types'

/** One row in the search dropdown. */
export type Suggestion =
  | { kind: 'recent'; id: string; query: string }
  | { kind: 'trip'; id: string; post: TripPostWithAuthor }
  | { kind: 'stop'; id: string; post: TripPostWithAuthor; name: string }
  | { kind: 'tag'; id: string; tag: string; count: number }
  | { kind: 'all'; id: string; query: string }

export interface SuggestionGroup {
  label: string | null
  items: Suggestion[]
}

/** Whether `q` (already folded) starts a word in `text`: "ha" finds "Hà Giang", not "Phú". */
function matches(text: string, q: string): boolean {
  return ` ${fold(text)}`.includes(` ${q}`)
}

const LIMITS = { recent: 4, popular: 5, trips: 5, stops: 4, tags: 3 }

/**
 * What the dropdown shows. With nothing typed: the reader's recent searches
 * and the most-saved trips. While typing: matching trips, stops along a trip,
 * and tags, then a row that runs the full search.
 *
 * `posts` must already be sorted by saves; `region` scopes every group but
 * the recent searches.
 */
export function buildSuggestions(
  posts: TripPostWithAuthor[],
  query: string,
  region: Region | 'all',
  recent: string[],
): SuggestionGroup[] {
  const scoped = region === 'all' ? posts : posts.filter((p) => p.region === region)
  const q = fold(query.trim())

  if (!q) {
    const groups: SuggestionGroup[] = [
      {
        label: 'Tìm kiếm gần đây',
        items: recent
          .slice(0, LIMITS.recent)
          .map((text): Suggestion => ({ kind: 'recent', id: `recent-${text}`, query: text })),
      },
      {
        label: 'Hành trình phổ biến',
        items: scoped
          .slice(0, LIMITS.popular)
          .map((post): Suggestion => ({ kind: 'trip', id: `trip-${post._id}`, post })),
      },
    ]
    return groups.filter((group) => group.items.length > 0)
  }

  const trips = scoped
    .filter((p) => matches(p.title, q) || matches(p.summary, q))
    .slice(0, LIMITS.trips)

  const stops: Suggestion[] = []
  const seenStops = new Set<string>()
  for (const post of scoped) {
    for (const day of post.days) {
      for (const stop of day.locations) {
        const key = fold(stop.name)
        if (!matches(stop.name, q) || seenStops.has(key)) continue
        seenStops.add(key)
        stops.push({ kind: 'stop', id: `stop-${post._id}-${stop._id}`, post, name: stop.name })
      }
    }
  }

  const tagCounts = new Map<string, number>()
  for (const post of scoped) {
    for (const tag of post.tags) {
      if (matches(tag, q)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const tags = [...tagCounts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMITS.tags)
    .map(([tag, count]): Suggestion => ({ kind: 'tag', id: `tag-${tag}`, tag, count }))

  const groups: SuggestionGroup[] = [
    {
      label: 'Hành trình',
      items: trips.map((post): Suggestion => ({ kind: 'trip', id: `trip-${post._id}`, post })),
    },
    { label: 'Điểm dừng', items: stops.slice(0, LIMITS.stops) },
    { label: 'Thẻ', items: tags },
    {
      label: null,
      items: [{ kind: 'all', id: 'all', query: query.trim() }],
    },
  ]
  return groups.filter((group) => group.items.length > 0)
}
