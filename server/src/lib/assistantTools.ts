/**
 * What the AI assistant (routes/assistant.ts) may look up, as tools the model
 * calls. Every tool is read-only and runs here, on the server, as the person
 * asking: the model supplies only search words and ids, never who it is, and
 * gets back only the fields an answer needs (no emails, photos or map data).
 *
 *   search_journeys   published journeys, filtered and ranked
 *   get_journey       one journey in full: days, stops, costs, legs
 *   my_journeys       the asker's own journeys, drafts included
 *   site_guide        how to use the website (lib/siteGuide.ts)
 *
 * Visibility follows routes/posts.ts: published and not deleted for everyone,
 * drafts for their author only; someone else's draft is "not found".
 *
 * A tool never throws at the model: bad arguments and missing records come
 * back as `{ error }`, which it is told to pass on rather than paper over.
 */

import { isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { env } from '../env.js'
import { TripPost } from '../models/TripPost.js'
import { User } from '../models/User.js'

import { GUIDE_INDEX, GUIDE_TOPICS, siteGuide } from './siteGuide.js'

const REGIONS = ['north', 'central', 'south', 'islands', 'overseas'] as const
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
const BUDGETS = ['low', 'medium', 'high'] as const

/** The names the website shows for these (web/src/lib/format.ts, lib/travel.ts). */
const REGION_LABEL: Record<string, string> = { north: 'Miền Bắc', central: 'Miền Trung', south: 'Miền Nam', islands: 'Hải đảo', overseas: 'Nước ngoài' }
const SEASON_LABEL: Record<string, string> = { spring: 'Mùa xuân', summer: 'Mùa hè', autumn: 'Mùa thu', winter: 'Mùa đông' }
const BUDGET_LABEL: Record<string, string> = { low: 'Tiết kiệm', medium: 'Vừa phải', high: 'Cao cấp' }
const MODE_LABEL: Record<string, string> = {
  driving: 'Ô tô, xe máy',
  walking: 'Đi bộ',
  transit: 'Xe buýt, xe khách',
  flight: 'Máy bay',
  ferry: 'Tàu, phà, ca nô',
}

/** The tools, as the chat completions API takes them. */
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_journeys',
      description:
        'Tìm các hành trình đã đăng công khai trên ChillnGo. Dùng khi người dùng hỏi ChillnGo có hành trình nào, cần gợi ý hoặc so sánh hành trình theo điểm đến, số ngày, chi phí, mùa, khu vực hay sở thích. Trả về danh sách tóm tắt; gọi get_journey để lấy lịch trình chi tiết.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Một cụm từ khoá, khớp nguyên cụm: điểm đến, tên hành trình, địa điểm hoặc thẻ (ví dụ "Huế", "Mũi Né", "ẩm thực"). Nhiều cụm thì ngăn bằng dấu phẩy và tất cả phải khớp (ví dụ "biển, hải sản"). Chỉ đưa tên điểm đến, đừng thêm chữ như "hành trình" hay "đi". Bỏ trống để lấy tất cả.',
          },
          region: { type: 'string', enum: REGIONS, description: 'north: Miền Bắc, central: Miền Trung, south: Miền Nam, islands: Hải đảo, overseas: Nước ngoài' },
          season: { type: 'string', enum: SEASONS },
          budget: { type: 'string', enum: BUDGETS, description: 'low: Tiết kiệm, medium: Vừa phải, high: Cao cấp' },
          maxCost: { type: 'number', description: 'Tổng chi phí ước tính tối đa, tính bằng đồng (VND)' },
          minDays: { type: 'integer' },
          maxDays: { type: 'integer' },
          sort: { type: 'string', enum: ['relevant', 'popular', 'newest', 'cheapest'] },
          limit: { type: 'integer', description: 'Số kết quả, tối đa 8 (mặc định 5)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_journey',
      description:
        'Lấy đầy đủ một hành trình theo id: từng ngày, từng điểm dừng, ghi chú, chi phí ước tính, phương tiện và quãng đường giữa các điểm. Dùng khi cần trả lời chi tiết, tính chi phí, hay so sánh. Chỉ dùng id do search_journeys hoặc my_journeys trả về, hoặc id trong thẻ <<j:…>> ở các câu trả lời trước.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_journeys',
      description: 'Liệt kê các hành trình của chính người đang hỏi (đã đăng và bản nháp). Dùng khi họ hỏi về "hành trình của tôi", "bản nháp của tôi".',
      parameters: { type: 'object', properties: { status: { type: 'string', enum: ['all', 'draft', 'published'] } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site_guide',
      description:
        'Tra hướng dẫn sử dụng website ChillnGo theo chủ đề. Dùng cho mọi câu hỏi "làm sao…", "ở đâu…", "có tính năng… không". Chủ đề: ' +
        GUIDE_TOPICS.map((topic) => `${topic} (${GUIDE_INDEX[topic]})`).join('; ') +
        '.',
      parameters: { type: 'object', properties: { topic: { type: 'string', enum: GUIDE_TOPICS } }, required: ['topic'] },
    },
  },
] as const

const searchArgs = z.object({
  query: z.string().trim().max(100).optional(),
  region: z.enum(REGIONS).optional(),
  season: z.enum(SEASONS).optional(),
  budget: z.enum(BUDGETS).optional(),
  maxCost: z.number().positive().max(1e13).optional(),
  minDays: z.number().int().min(1).max(60).optional(),
  maxDays: z.number().int().min(1).max(60).optional(),
  sort: z.enum(['relevant', 'popular', 'newest', 'cheapest']).default('relevant'),
  limit: z.number().int().min(1).max(8).default(5),
})
const getArgs = z.object({ id: z.string().trim().max(40) })
const mineArgs = z.object({ status: z.enum(['all', 'draft', 'published']).default('all') })
const guideArgs = z.object({ topic: z.enum(GUIDE_TOPICS) })

/** The stored shape of the fields the tools read (models/TripPost.ts; `days` is validated by routes/posts.ts). */
interface Stop {
  name?: string
  address?: string
  note?: string
  estCost?: number
  travelMode?: string
  legRoute?: { duration?: number; distance?: number }
}
interface Day {
  dayNumber?: number
  date?: string
  title?: string
  locations?: Stop[]
}
interface Journey {
  _id: unknown
  authorId: string
  title: string
  summary: string
  region: string
  season: string
  startDate: string
  endDate: string
  days: Day[]
  tags: string[]
  budgetLevel: string
  totalEstCost: number
  likeCount: number
  bookmarkCount: number
  cloneCount: number
  status: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const FIELDS = 'authorId title summary region season startDate endDate days tags budgetLevel totalEstCost likeCount bookmarkCount cloneCount status deletedAt createdAt updatedAt'
/** ponytail: search reads the newest published journeys and filters them here; move to a text index when there are more than this. */
const SCAN_LIMIT = 500

/** Words a search phrase may start with that say "a trip to", not where. */
const LEAD_IN = /^((hành trình|lịch trình|chuyến đi|du lịch|tour|đi|ở|tại|về)\s+)+/i

/** Without diacritics: "Đà Lạt" → "da lat". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')

/** Lower case, its words separated and padded by single spaces, so a phrase can be looked for as whole words. */
const spaced = (text: string) => ` ${text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ')} `

/**
 * Whether `phrase` appears in `text` as whole words, in order. A place name in
 * Vietnamese is several syllables that are each common words ("nhật" + "bản",
 * "đà" + "lạt"), so they must match together, and with their tone marks when
 * the phrase has any: only a phrase typed without marks ("da lat") is matched
 * without them.
 */
function mentions(text: string, phrase: string) {
  const wanted = spaced(phrase)
  if (wanted.trim() === '') return true
  return wanted === fold(wanted) ? fold(spaced(text)).includes(wanted) : spaced(text).includes(wanted)
}

const clip = (text: string | undefined, max: number) => {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const stopsOf = (journey: Journey) => journey.days.flatMap((day) => day.locations ?? [])

/** A journey's author may see it; anyone may see a published one that is not deleted. */
export function visibleTo(journey: Pick<Journey, 'authorId' | 'status' | 'deletedAt'>, userId: string) {
  return !journey.deletedAt && (journey.status === 'published' || journey.authorId === userId)
}

async function authorNames(journeys: Journey[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: [...new Set(journeys.map((j) => j.authorId))] } })
    .select('displayName')
    .lean()
  return new Map(users.map((u) => [String(u._id), u.displayName]))
}

function summaryOf(journey: Journey, authors: Map<string, string>) {
  const stops = stopsOf(journey)
  return {
    id: String(journey._id),
    title: journey.title || '(chưa đặt tên)',
    summary: clip(journey.summary, 180),
    region: REGION_LABEL[journey.region] ?? journey.region,
    season: SEASON_LABEL[journey.season] ?? journey.season,
    startDate: journey.startDate,
    endDate: journey.endDate,
    days: journey.days.length,
    stops: stops.length,
    places: [...new Set(stops.map((s) => clip(s.name, 60)).filter(Boolean))].slice(0, 8),
    totalEstCostVnd: journey.totalEstCost,
    budget: BUDGET_LABEL[journey.budgetLevel] ?? journey.budgetLevel,
    tags: journey.tags,
    author: authors.get(journey.authorId) ?? 'Tài khoản đã xoá',
    likes: journey.likeCount,
    saves: journey.bookmarkCount,
    clones: journey.cloneCount,
  }
}

async function searchJourneys(raw: unknown) {
  const args = searchArgs.parse(raw)
  const filter: Record<string, unknown> = { status: 'published', deletedAt: null }
  if (args.region) filter.region = args.region
  if (args.season) filter.season = args.season
  if (args.budget) filter.budgetLevel = args.budget
  const journeys = (await TripPost.find(filter).select(FIELDS).sort({ createdAt: -1 }).limit(SCAN_LIMIT).lean()) as unknown as Journey[]

  // "hành trình đi Huế" is asking for "Huế": the lead-in words are not part of the place.
  const phrases = (args.query ?? '')
    .split(',')
    .map((phrase) => phrase.trim().replace(LEAD_IN, '').trim())
    .filter(Boolean)
  const matches: { journey: Journey; score: number }[] = []
  for (const journey of journeys) {
    if (args.maxCost !== undefined && journey.totalEstCost > args.maxCost) continue
    if (args.minDays !== undefined && journey.days.length < args.minDays) continue
    if (args.maxDays !== undefined && journey.days.length > args.maxDays) continue
    // Every phrase must appear somewhere; a hit in the title or a tag counts for more.
    const tags = journey.tags.join(' | ')
    const rest = [journey.summary, ...journey.days.map((d) => d.title ?? ''), ...stopsOf(journey).flatMap((s) => [s.name ?? '', s.address ?? ''])].join(' | ')
    let score = 0
    let all = true
    for (const phrase of phrases) {
      if (mentions(journey.title, phrase)) score += 3
      else if (mentions(tags, phrase)) score += 2
      else if (mentions(rest, phrase)) score += 1
      else all = false
    }
    if (all) matches.push({ journey, score })
  }

  const popularity = (j: Journey) => j.likeCount + j.bookmarkCount + j.cloneCount
  /** A cost of 0 means the author entered none: last when sorting by price. */
  const price = (j: Journey) => (j.totalEstCost > 0 ? j.totalEstCost : Infinity)
  matches.sort((a, b) => {
    if (args.sort === 'cheapest') return price(a.journey) - price(b.journey)
    if (args.sort === 'newest') return b.journey.createdAt.getTime() - a.journey.createdAt.getTime()
    if (args.sort === 'relevant' && b.score !== a.score) return b.score - a.score
    return popularity(b.journey) - popularity(a.journey) || b.journey.createdAt.getTime() - a.journey.createdAt.getTime()
  })

  const shown = matches.slice(0, args.limit).map((m) => m.journey)
  const authors = await authorNames(shown)
  return {
    totalMatches: matches.length,
    publishedJourneysOnChillnGo: await TripPost.countDocuments({ status: 'published', deletedAt: null }),
    results: shown.map((journey) => summaryOf(journey, authors)),
    note: matches.length === 0 ? 'Không có hành trình nào trên ChillnGo khớp yêu cầu này. Đừng bịa ra hành trình.' : undefined,
  }
}

async function getJourney(raw: unknown, userId: string) {
  const { id } = getArgs.parse(raw)
  const journey = isValidObjectId(id) ? ((await TripPost.findById(id).select(FIELDS).lean()) as unknown as Journey | null) : null
  if (!journey || !visibleTo(journey, userId)) {
    return { error: 'not_found', message: 'Không có hành trình nào với id này, hoặc người dùng không được xem nó.' }
  }
  const authors = await authorNames([journey])
  const days = journey.days.map((day, i) => {
    const stops = (day.locations ?? []).map((stop, j) => ({
      name: clip(stop.name, 80),
      address: clip(stop.address, 120) || undefined,
      note: clip(stop.note, 260) || undefined,
      estCostVnd: stop.estCost ?? 0,
      // How it was reached from the stop before it, where the author said and a road route was drawn.
      ...(j > 0 && {
        reachedBy: MODE_LABEL[stop.travelMode ?? 'driving'],
        legKm: stop.legRoute?.distance ? Math.round(stop.legRoute.distance / 100) / 10 : undefined,
        legMinutes: stop.legRoute?.duration ? Math.round(stop.legRoute.duration / 60) : undefined,
      }),
    }))
    return {
      day: day.dayNumber ?? i + 1,
      date: day.date,
      title: clip(day.title, 100) || undefined,
      dayCostVnd: stops.reduce((sum, stop) => sum + stop.estCostVnd, 0),
      stops,
    }
  })
  return {
    ...summaryOf(journey, authors),
    summary: clip(journey.summary, 700),
    status: journey.status === 'published' ? 'Đã đăng' : 'Bản nháp (chỉ tác giả thấy)',
    days,
    sumOfStopCostsVnd: days.reduce((sum, day) => sum + day.dayCostVnd, 0),
    dataNotes: 'Chi phí là ước tính của tác giả. Hành trình không lưu giờ khởi hành hay giờ đến; legMinutes là thời gian di chuyển đường bộ ước tính, chỉ có khi tác giả đã ghim cả hai điểm.',
  }
}

async function myJourneys(raw: unknown, userId: string) {
  const { status } = mineArgs.parse(raw)
  const filter: Record<string, unknown> = { authorId: userId, deletedAt: null }
  if (status !== 'all') filter.status = status
  const journeys = (await TripPost.find(filter).select(FIELDS).sort({ updatedAt: -1 }).limit(30).lean()) as unknown as Journey[]
  const authors = await authorNames(journeys)
  return {
    total: journeys.length,
    results: journeys.map((journey) => ({
      ...summaryOf(journey, authors),
      status: journey.status === 'published' ? 'Đã đăng' : 'Bản nháp',
      lastEdited: journey.updatedAt.toISOString().slice(0, 10),
    })),
    note: journeys.length === 0 ? 'Người dùng chưa có hành trình nào (kể cả bản nháp).' : undefined,
  }
}

/**
 * Runs one tool call for `userId` and returns its result as JSON text for the
 * model. Unknown tools, malformed or invalid arguments and failures all come
 * back as `{ error }`.
 */
export async function runTool(name: string, rawArgs: string, userId: string): Promise<string> {
  const result = await run(name, rawArgs, userId)
  if (env.assistantDebug) console.log(`assistant tool ${name} ${rawArgs.replace(/\s+/g, ' ').slice(0, 200)} → ${result.length} bytes${result.includes('"error"') ? ' ' + result.slice(0, 80) : ''}`)
  return result
}

async function run(name: string, rawArgs: string, userId: string): Promise<string> {
  try {
    const args: unknown = rawArgs.trim() ? JSON.parse(rawArgs) : {}
    switch (name) {
      case 'search_journeys':
        return JSON.stringify(await searchJourneys(args))
      case 'get_journey':
        return JSON.stringify(await getJourney(args, userId))
      case 'my_journeys':
        return JSON.stringify(await myJourneys(args, userId))
      case 'site_guide': {
        const { topic } = guideArgs.parse(args)
        return JSON.stringify({ topic, guide: siteGuide(topic) })
      }
      default:
        return JSON.stringify({ error: 'unknown_tool', message: `Không có công cụ "${name}".` })
    }
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return JSON.stringify({ error: 'bad_arguments', message: 'Tham số không hợp lệ.' })
    }
    console.error(`Assistant tool ${name} failed:`, (error as Error).message)
    return JSON.stringify({ error: 'unavailable', message: 'Không tra được dữ liệu lúc này. Hãy nói với người dùng là chưa lấy được dữ liệu, đừng đoán.' })
  }
}
