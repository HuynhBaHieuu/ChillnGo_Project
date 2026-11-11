/**
 * The news pipeline: fetch a source, keep only new travel items, let the AI
 * summarise and tag them, and decide whether they go on the Newsfeed.
 *
 *   fetchSource     a server-side source (rss, google_news, youtube_channel) → raw items
 *   ingest          raw items of one source → stored items + a run record
 *   enrichQueued    AI summary, regions and destinations for queued items
 *   runDueSources   what the scheduler and "Cào ngay" call
 *
 * Social sources are fetched by the news worker (tools/news-worker) and enter
 * through `ingest` as well, so they get the same filters and AI step.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

import { chat, providers } from '../../ai/llm.js'
import { HttpError } from '../errors.js'
import { Destination } from '../../models/Destination.js'
import { NEWS_REGIONS, NewsItem, NewsRun, NewsSource, NewsWorker } from '../../models/News.js'
import type { NewsSourceDocument, NewsStatus } from '../../models/News.js'
import {
  canonicalUrl,
  channelIdInPage,
  googleNewsUrl,
  parseFeed,
  passesKeywords,
  plainText,
  titleKey,
  truncate,
  usefulExcerpt,
  youtubeChannelId,
  youtubeFeedUrl,
} from './feeds.js'
import type { RawNewsItem } from './feeds.js'

const USER_AGENT = 'ChillnGoNewsBot/1.0 (+https://chillgo-project-web.vercel.app)'
const FETCH_TIMEOUT_MS = 12_000
const MAX_BYTES = 3 * 1024 * 1024
/** Newest items kept from one fetch. */
export const MAX_ITEMS_PER_FETCH = 30
/** Sources fetched in one scheduled run, so a run fits in one function call. */
export const MAX_SOURCES_PER_RUN = 12
/** Items sent to the AI in one run (in batches), so the AI quota is not spent at once. */
export const AI_ITEMS_PER_RUN = 24
const AI_BATCH = 8
const AI_MAX_ATTEMPTS = 3

async function fetchText(url: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
  } catch (error) {
    throw new Error(`Không tải được nguồn: ${(error as Error).message}`)
  }
  if (!response.ok) throw new Error(`Nguồn trả về lỗi HTTP ${response.status}`)
  const text = await response.text()
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text
}

/** The feed a youtube_channel source reads: its own link when it names the channel, else found in the channel page. */
export async function youtubeFeedFor(url: string): Promise<string> {
  if (url.includes('/feeds/videos.xml')) return url
  const id = youtubeChannelId(url) ?? channelIdInPage(await fetchText(url))
  if (!id) throw new Error('Không tìm thấy kênh YouTube trong đường dẫn này.')
  return youtubeFeedUrl(id)
}

/** Raw items of a server-side source, newest first. */
export async function fetchSource(source: { type: string; url: string; query: string }): Promise<RawNewsItem[]> {
  let feedUrl: string
  if (source.type === 'rss') feedUrl = source.url
  else if (source.type === 'google_news') feedUrl = googleNewsUrl(source.query)
  else if (source.type === 'youtube_channel') feedUrl = await youtubeFeedFor(source.url)
  else throw new HttpError(400, 'Nguồn mạng xã hội được cào bằng máy cào, không chạy trên máy chủ.', 'WORKER_SOURCE')
  let xml: string
  try {
    xml = await fetchText(feedUrl)
  } catch (error) {
    if (source.type === 'youtube_channel') {
      throw new Error(
        `YouTube không trả về RSS cho kênh này (${(error as Error).message}). Hãy thử lại sau, hoặc thêm kênh dưới dạng nguồn mạng xã hội "YouTube" để máy cào lấy bằng Agent Reach.`,
      )
    }
    throw error
  }
  const items = parseFeed(xml)
  if (items.length === 0) throw new Error('Không đọc được tin nào: đường dẫn không phải RSS/Atom hoặc nguồn đang trống.')
  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, MAX_ITEMS_PER_FETCH)
}

/** Where a new item starts: waiting for the AI when there is one, else published or waiting for an admin. */
export function initialStatus(autoPublish: boolean, aiAvailable: boolean): NewsStatus {
  if (aiAvailable) return 'queued'
  return autoPublish ? 'published' : 'pending'
}

/** After the AI looked at it. */
export function statusAfterAi(autoPublish: boolean, relevant: boolean): NewsStatus {
  if (!relevant) return 'rejected'
  return autoPublish ? 'published' : 'pending'
}

let aiAvailableCache: { at: number; value: boolean } | null = null
async function aiAvailable(): Promise<boolean> {
  if (aiAvailableCache && Date.now() - aiAvailableCache.at < 60_000) return aiAvailableCache.value
  const value = (await providers()).length > 0
  aiAvailableCache = { at: Date.now(), value }
  return value
}

export interface IngestResult {
  fetched: number
  created: number
  duplicates: number
  filtered: number
}

/** Stores the new items of one source and records the run. Never throws for a duplicate. */
export async function ingest(
  source: NewsSourceDocument,
  raw: RawNewsItem[],
  trigger: 'schedule' | 'manual' | 'worker',
  startedAt = Date.now(),
): Promise<IngestResult> {
  const counts: IngestResult = { fetched: raw.length, created: 0, duplicates: 0, filtered: 0 }
  const useAi = await aiAvailable()
  // Titles this source already has from the last two weeks, and from this batch.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const known = new Set(
    (await NewsItem.find({ sourceId: String(source._id), createdAt: { $gte: since } }, { title: 1 }).lean()).map((i) => titleKey(i.title)),
  )
  for (const item of raw) {
    const url = canonicalUrl(item.url)
    if (!url || !item.title.trim()) {
      counts.filtered += 1
      continue
    }
    const key = titleKey(item.title)
    if (key && known.has(key)) {
      counts.duplicates += 1
      continue
    }
    known.add(key)
    if (!passesKeywords(`${item.title} ${item.excerpt}`, source.includeKeywords, source.excludeKeywords)) {
      counts.filtered += 1
      continue
    }
    try {
      await NewsItem.create({
        sourceId: String(source._id),
        sourceName: source.name,
        sourceType: source.type,
        platform: source.platform ?? null,
        url,
        title: truncate(plainText(item.title), 300),
        excerpt: truncate(usefulExcerpt(item.title, item.excerpt), 500),
        imageUrl: item.imageUrl && /^https:\/\//.test(item.imageUrl) ? item.imageUrl : '',
        kind: item.kind,
        author: truncate(item.author, 120),
        publishedAt: item.publishedAt,
        status: initialStatus(source.autoPublish, useAi),
        aiStatus: useAi ? 'pending' : 'skipped',
        regions: source.defaultRegion ? [source.defaultRegion] : [],
      })
      counts.created += 1
    } catch (error) {
      if ((error as { code?: number }).code === 11000) counts.duplicates += 1
      else throw error
    }
  }
  source.set({ lastRunAt: new Date(), lastStatus: 'ok', lastError: '', lastNewCount: counts.created })
  await source.save()
  await NewsRun.create({
    sourceId: String(source._id),
    sourceName: source.name,
    trigger,
    ...counts,
    durationMs: Date.now() - startedAt,
  })
  return counts
}

async function recordFailure(source: NewsSourceDocument, trigger: 'schedule' | 'manual' | 'worker', error: string, startedAt: number) {
  source.set({ lastRunAt: new Date(), lastStatus: 'error', lastError: truncate(error, 300), lastNewCount: 0 })
  await source.save()
  await NewsRun.create({ sourceId: String(source._id), sourceName: source.name, trigger, error: truncate(error, 300), durationMs: Date.now() - startedAt })
}

/** Fetches one server-side source and stores what is new. Failures are recorded on the source, not thrown. */
export async function runSource(source: NewsSourceDocument, trigger: 'schedule' | 'manual') {
  const startedAt = Date.now()
  try {
    const raw = await fetchSource(source)
    return { ok: true as const, ...(await ingest(source, raw, trigger, startedAt)) }
  } catch (error) {
    if (error instanceof HttpError) throw error
    const message = (error as Error).message
    await recordFailure(source, trigger, message, startedAt)
    return { ok: false as const, error: message }
  }
}

/** A worker reports that a social source could not be fetched. */
export async function workerFailure(source: NewsSourceDocument, error: string) {
  await recordFailure(source, 'worker', error, Date.now())
}

/** Server-side sources whose interval has passed (or every enabled one when `force`). */
export async function dueSources(force = false) {
  const sources = await NewsSource.find({ enabled: true, type: { $ne: 'social' } }).sort({ lastRunAt: 1 })
  const now = Date.now()
  return sources
    .filter((s) => force || !s.lastRunAt || now - s.lastRunAt.getTime() >= (s.intervalMinutes - 2) * 60_000)
    .slice(0, MAX_SOURCES_PER_RUN)
}

/** Social sources the worker should fetch now. */
export async function dueWorkerSources() {
  const sources = await NewsSource.find({ enabled: true, type: 'social' }).sort({ lastRunAt: 1 })
  const now = Date.now()
  return sources.filter((s) => !s.lastRunAt || now - s.lastRunAt.getTime() >= (s.intervalMinutes - 2) * 60_000)
}

/** The scheduler's run: due sources, then the AI step. */
export async function runDueSources(trigger: 'schedule' | 'manual' = 'schedule') {
  const sources = await dueSources(trigger === 'manual')
  const results = []
  for (const source of sources) {
    results.push({ sourceId: String(source._id), name: source.name, ...(await runSource(source, trigger)) })
  }
  const enriched = await enrichQueued()
  return { sources: results, enriched }
}

/* ------------------------------------------------------------------- AI */

const aiAnswer = z.array(
  z.object({
    id: z.string(),
    relevant: z.boolean(),
    summary: z.string().max(600).default(''),
    region: z.enum(NEWS_REGIONS).nullable().catch(null).default(null),
    destinations: z.array(z.string()).max(5).catch([]).default([]),
  }),
)

/**
 * The first JSON array in a model's answer. A model that leaves the ids out
 * but answers every item, in order, is still understood: `ids` are the items
 * asked about, in the order they were sent.
 */
export function parseAiAnswer(text: string, ids: string[] = []) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  try {
    const raw: unknown = JSON.parse(text.slice(start, end + 1))
    if (Array.isArray(raw) && raw.length === ids.length) {
      raw.forEach((entry: unknown, i) => {
        if (entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id !== 'string') (entry as { id?: string }).id = ids[i]
      })
    }
    return aiAnswer.parse(raw)
  } catch {
    return null
  }
}

const SYSTEM = [
  'Bạn là biên tập viên tin du lịch của ChillnGo, mạng xã hội du lịch Việt Nam.',
  'Với mỗi tin, trả về một phần tử gồm: id (chép đúng id của tin đầu vào),',
  'relevant (true nếu tin liên quan du lịch, điểm đến, ẩm thực, lễ hội, lưu trú, phương tiện đi lại hoặc kinh nghiệm đi chơi; false nếu là quảng cáo, chính trị, tai nạn không liên quan du lịch, hoặc nội dung rác),',
  'summary (2–3 câu tiếng Việt tự nhiên, chỉ dựa trên tiêu đề và mô tả được cho, không bịa thêm chi tiết; để trống nếu relevant = false),',
  'region (một trong: north, central, south, islands, overseas; null nếu không rõ),',
  'destinations (tối đa 5 tên điểm đến, CHỈ chọn từ danh sách được cho, viết đúng như danh sách).',
  'Chỉ trả về JSON dạng {"results": [...]} với đúng một phần tử cho mỗi tin, theo thứ tự tin đầu vào, không giải thích.',
].join(' ')

/** AI summary, regions and destinations for queued items; then their status. Returns how many were handled. */
export async function enrichQueued(limit = AI_ITEMS_PER_RUN): Promise<number> {
  const queued = await NewsItem.find({ status: 'queued', aiStatus: 'pending' }).sort({ createdAt: 1 }).limit(limit)
  if (queued.length === 0) return 0
  const sources = new Map(
    (await NewsSource.find({ _id: { $in: [...new Set(queued.map((q) => q.sourceId))] } }).lean()).map((s) => [String(s._id), s]),
  )
  const known = (await Destination.find().select('name').lean()).map((d) => d.name)
  const knownFolded = new Map(known.map((n) => [n.toLowerCase(), n]))
  let handled = 0

  for (let i = 0; i < queued.length; i += AI_BATCH) {
    const batch = queued.slice(i, i + AI_BATCH)
    const payload = batch.map((item) => ({ id: String(item._id), title: item.title, description: item.excerpt.slice(0, 400), source: item.sourceName }))
    let answer: ReturnType<typeof parseAiAnswer> = null
    try {
      const text = await chat(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Danh sách điểm đến: ${known.join(', ') || '(trống)'}\n\nTin:\n${JSON.stringify(payload)}` },
        ],
        'news-enrich',
      )
      answer = parseAiAnswer(text, batch.map((item) => String(item._id)))
      if (!answer) console.warn(`[news] AI answer not understood: ${text.replace(/\s+/g, ' ').slice(0, 300)}`)
    } catch (error) {
      console.warn(`[news] AI unavailable: ${(error as Error).message}`)
    }
    for (const item of batch) {
      const auto = Boolean(sources.get(item.sourceId)?.autoPublish)
      const result = answer?.find((a) => a.id === String(item._id))
      if (result) {
        const destinations = result.destinations.map((d) => knownFolded.get(d.toLowerCase())).filter((d): d is string => Boolean(d))
        item.set({
          aiStatus: 'done',
          summary: result.relevant ? truncate(result.summary.trim(), 600) : '',
          regions: result.region ? [result.region] : item.regions,
          destinations,
          status: statusAfterAi(auto, result.relevant),
          statusReason: result.relevant ? '' : 'AI: không liên quan du lịch',
        })
      } else {
        const attempts = item.aiAttempts + 1
        // After a few failed tries the item goes on without a summary.
        item.set(attempts >= AI_MAX_ATTEMPTS
          ? { aiAttempts: attempts, aiStatus: 'failed', status: auto ? 'published' : 'pending' }
          : { aiAttempts: attempts })
      }
      await item.save()
      handled += 1
    }
  }
  return handled
}

/* --------------------------------------------------------------- worker */

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

/** A new worker key; the previous one stops working. Returned once, stored hashed. */
export async function rotateWorkerKey(adminId: string): Promise<string> {
  const key = `cgw_${randomBytes(24).toString('base64url')}`
  await NewsWorker.findByIdAndUpdate(
    'worker',
    { $set: { keyHash: hashKey(key), keyHint: key.slice(-4), createdBy: adminId, createdAt: new Date(), lastSeenAt: null } },
    { upsert: true },
  )
  return key
}

export async function revokeWorkerKey(): Promise<void> {
  await NewsWorker.findByIdAndUpdate('worker', { $set: { keyHash: null, keyHint: '' } }, { upsert: true })
}

/** Checks the X-Worker-Key header; records when the worker was last seen. */
export async function verifyWorkerKey(key: string | undefined): Promise<void> {
  const worker = await NewsWorker.findById('worker').lean()
  const expected = worker?.keyHash ? Buffer.from(worker.keyHash, 'hex') : null
  const given = key ? Buffer.from(hashKey(key), 'hex') : null
  if (!expected || !given || !timingSafeEqual(expected, given)) {
    throw new HttpError(401, 'Mã máy cào không hợp lệ.', 'BAD_WORKER_KEY')
  }
  await NewsWorker.updateOne({ _id: 'worker' }, { $set: { lastSeenAt: new Date() } })
}

/** The cron secret: Vercel Cron and the GitHub Action send it as a bearer token. */
export function verifyCronSecret(header: string | undefined, secret: string | null): void {
  const given = header?.startsWith('Bearer ') ? header.slice(7) : ''
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    throw new HttpError(401, 'Unauthorized', 'BAD_CRON_SECRET')
  }
}
