/**
 * Travel news for the Newsfeed (server/src/routes/news.ts) and its admin
 * screens (server/src/routes/adminNews.ts).
 */

import type { Page } from './admin.service'
import { http } from './http'
import type { NewsItem, NewsRun, NewsSource, NewsSourceInput, NewsStatus, Region } from './types'

export interface NewsPage {
  items: NewsItem[]
  nextBefore: string | null
}

/** GET /api/news — published news, newest first; pinned first on the first page. */
export function getNews(params: { region?: Region; before?: string | null; limit?: number } = {}): Promise<NewsPage> {
  const search = new URLSearchParams()
  if (params.region) search.set('region', params.region)
  if (params.before) search.set('before', params.before)
  if (params.limit) search.set('limit', String(params.limit))
  const qs = search.toString()
  return http<NewsPage>(`/api/news${qs ? `?${qs}` : ''}`)
}

export async function getSavedNews(): Promise<(NewsItem & { savedAt: string })[]> {
  const { items } = await http<{ items: (NewsItem & { savedAt: string })[] }>('/api/news/saved')
  return items
}

export async function toggleSave(id: string): Promise<boolean> {
  const { saved } = await http<{ saved: boolean }>(`/api/news/${id}/save`, { method: 'POST' })
  return saved
}

/** Counts a click through to the original; never fails the click itself. */
export function recordClick(id: string): void {
  void http(`/api/news/${id}/click`, { method: 'POST', auth: false }).catch(() => undefined)
}

/* ------------------------------------------------------------------ admin */

export function getSources(): Promise<{ items: NewsSource[] }> {
  return http('/api/admin/news/sources')
}

export async function createSource(input: NewsSourceInput): Promise<NewsSource> {
  const { source } = await http<{ source: NewsSource }>('/api/admin/news/sources', { method: 'POST', body: input })
  return source
}

export async function updateSource(id: string, input: NewsSourceInput): Promise<NewsSource> {
  const { source } = await http<{ source: NewsSource }>(`/api/admin/news/sources/${id}`, { method: 'PUT', body: input })
  return source
}

export async function deleteSource(id: string): Promise<void> {
  await http(`/api/admin/news/sources/${id}`, { method: 'DELETE' })
}

export interface PreviewItem {
  url: string
  title: string
  excerpt: string
  imageUrl: string
  publishedAt: string
  kind: NewsItem['kind']
}

export function previewSource(input: Pick<NewsSourceInput, 'type' | 'url' | 'query'>): Promise<{ items: PreviewItem[]; total: number }> {
  return http('/api/admin/news/sources/preview', { method: 'POST', body: input })
}

export interface RunResult {
  ok: boolean
  created?: number
  fetched?: number
  duplicates?: number
  filtered?: number
  error?: string
}

export function runSource(id: string): Promise<{ result: RunResult; enriched: number }> {
  return http(`/api/admin/news/sources/${id}/run`, { method: 'POST' })
}

export function runAll(): Promise<{ sources: (RunResult & { name: string })[]; enriched: number }> {
  return http('/api/admin/news/run', { method: 'POST' })
}

export function getItems(params: { status?: NewsStatus; sourceId?: string; q?: string; page?: number }): Promise<Page<NewsItem>> {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.sourceId) search.set('sourceId', params.sourceId)
  if (params.q) search.set('q', params.q)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const qs = search.toString()
  return http(`/api/admin/news/items${qs ? `?${qs}` : ''}`)
}

export async function patchItem(id: string, patch: Partial<Pick<NewsItem, 'summary' | 'regions' | 'destinations' | 'pinned'>>): Promise<NewsItem> {
  const { item } = await http<{ item: NewsItem }>(`/api/admin/news/items/${id}`, { method: 'PATCH', body: patch })
  return item
}

export type NewsReviewAction = 'approve' | 'reject' | 'hide' | 'unhide'

export function reviewItems(ids: string[], action: NewsReviewAction, reason = ''): Promise<{ updated: number }> {
  return http('/api/admin/news/items/review', { method: 'POST', body: { ids, action, reason } })
}

export function getRuns(page = 1): Promise<Page<NewsRun>> {
  return http(`/api/admin/news/runs${page > 1 ? `?page=${page}` : ''}`)
}

export interface WorkerStatus {
  hasKey: boolean
  keyHint: string
  createdAt: string | null
  lastSeenAt: string | null
  socialSources: number
}

export function getWorker(): Promise<WorkerStatus> {
  return http('/api/admin/news/worker')
}

export async function createWorkerKey(): Promise<string> {
  const { key } = await http<{ key: string }>('/api/admin/news/worker/key', { method: 'POST' })
  return key
}

export async function revokeWorkerKey(): Promise<void> {
  await http('/api/admin/news/worker/key', { method: 'DELETE' })
}
