/** Input rules and the JSON the API sends for news sources and items. */

import { z } from 'zod'

import { moderationView } from '../../models/moderation.js'
import { NEWS_REGIONS, NEWS_SOURCE_TYPES, SOCIAL_PLATFORMS } from '../../models/News.js'
import type { NewsItemDocument, NewsSourceDocument } from '../../models/News.js'

const keywordList = z
  .array(z.string().trim().min(1).max(60))
  .max(30, 'Tối đa 30 từ khoá')
  .default([])

export const sourceInputSchema = z
  .object({
    name: z.string('Vui lòng nhập tên nguồn').trim().min(2, 'Tên nguồn tối thiểu 2 ký tự').max(80, 'Tên nguồn tối đa 80 ký tự'),
    type: z.enum(NEWS_SOURCE_TYPES, 'Loại nguồn không hợp lệ'),
    url: z.string().trim().max(500).default(''),
    query: z.string().trim().max(200).default(''),
    platform: z.enum(SOCIAL_PLATFORMS).nullable().default(null),
    includeKeywords: keywordList,
    excludeKeywords: keywordList,
    defaultRegion: z.enum(NEWS_REGIONS).nullable().default(null),
    enabled: z.boolean().default(true),
    autoPublish: z.boolean().default(false),
    intervalMinutes: z.number().int().min(30, 'Tối thiểu 30 phút').max(7 * 24 * 60, 'Tối đa 7 ngày').default(60),
  })
  .superRefine((s, ctx) => {
    const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u)
    if ((s.type === 'rss' || s.type === 'youtube_channel') && !isUrl(s.url)) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'Hãy nhập đường dẫn hợp lệ (https://…).' })
    }
    if (s.type === 'google_news' && s.query.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['query'], message: 'Hãy nhập từ khoá tìm kiếm.' })
    }
    if (s.type === 'social') {
      if (!s.platform) ctx.addIssue({ code: 'custom', path: ['platform'], message: 'Hãy chọn nền tảng.' })
      if (s.query.length < 2 && !isUrl(s.url)) {
        ctx.addIssue({ code: 'custom', path: ['query'], message: 'Hãy nhập từ khoá hoặc đường dẫn trang cần đọc.' })
      }
    }
  })

export type SourceInput = z.infer<typeof sourceInputSchema>

export const previewSchema = z.object({
  type: z.enum(['rss', 'google_news', 'youtube_channel'], 'Chỉ thử được nguồn RSS, Google News và YouTube.'),
  url: z.string().trim().max(500).default(''),
  query: z.string().trim().max(200).default(''),
})

export const itemPatchSchema = z.object({
  summary: z.string().trim().max(600, 'Tóm tắt tối đa 600 ký tự').optional(),
  regions: z.array(z.enum(NEWS_REGIONS)).max(5).optional(),
  destinations: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  pinned: z.boolean().optional(),
})

export const reviewActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'hide', 'unhide'], 'Thao tác không hợp lệ'),
  reason: z.string().trim().max(300).default(''),
})

export const bulkReviewSchema = reviewActionSchema.extend({
  ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(100),
})

/** Statuses each action applies to, and where it leads. */
export const REVIEW_TRANSITIONS = {
  approve: { from: ['pending', 'rejected', 'queued'], to: 'published' },
  reject: { from: ['pending', 'queued', 'published'], to: 'rejected' },
  hide: { from: ['published'], to: 'hidden' },
  unhide: { from: ['hidden'], to: 'published' },
} as const

/** What the worker sends: items as Agent Reach printed them, mapped by the worker. */
export const workerIngestSchema = z.object({
  sourceId: z.string().regex(/^[a-f0-9]{24}$/),
  error: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        url: z.string().max(1000),
        title: z.string().max(500),
        excerpt: z.string().max(5000).default(''),
        imageUrl: z.string().max(1000).default(''),
        author: z.string().max(200).default(''),
        publishedAt: z.string().max(60).optional(),
        kind: z.enum(['article', 'video', 'post']).default('post'),
      }),
    )
    .max(100)
    .default([]),
})

export function sourceView(source: NewsSourceDocument) {
  return {
    _id: String(source._id),
    name: source.name,
    type: source.type,
    url: source.url,
    query: source.query,
    platform: source.platform ?? null,
    includeKeywords: source.includeKeywords,
    excludeKeywords: source.excludeKeywords,
    defaultRegion: source.defaultRegion ?? null,
    enabled: source.enabled,
    autoPublish: source.autoPublish,
    intervalMinutes: source.intervalMinutes,
    lastRunAt: source.lastRunAt?.toISOString() ?? null,
    lastStatus: source.lastStatus ?? null,
    lastError: source.lastError,
    lastNewCount: source.lastNewCount,
    createdAt: source.createdAt.toISOString(),
  }
}

/** Public view; `admin` adds the review fields. */
export function itemView(item: NewsItemDocument, opts: { admin?: boolean; saved?: boolean } = {}) {
  return {
    _id: String(item._id),
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    sourceType: item.sourceType,
    platform: item.platform ?? null,
    url: item.url,
    title: item.title,
    summary: item.summary || item.excerpt,
    imageUrl: item.imageUrl,
    kind: item.kind,
    author: item.author,
    publishedAt: item.publishedAt.toISOString(),
    pinned: item.pinned,
    regions: item.regions,
    destinations: item.destinations,
    ...(opts.saved !== undefined && { savedByMe: opts.saved }),
    ...(opts.admin && {
      status: item.status,
      statusReason: item.statusReason,
      excerpt: item.excerpt,
      aiSummary: item.summary,
      aiStatus: item.aiStatus,
      clickCount: item.clickCount,
      createdAt: item.createdAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      moderation: moderationView(item.moderation),
    }),
  }
}
