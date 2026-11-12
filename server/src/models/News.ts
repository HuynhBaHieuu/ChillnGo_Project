import { Schema, model } from 'mongoose'

import { moderationField } from './moderation.js'

/**
 * Where news for the Newsfeed comes from (lib/news). The server fetches the
 * first three types itself; `social` sources are fetched by the news worker
 * (tools/news-worker), which runs Agent Reach on a machine with the logins.
 */
export const NEWS_SOURCE_TYPES = ['rss', 'google_news', 'youtube_channel', 'social'] as const
export type NewsSourceType = (typeof NEWS_SOURCE_TYPES)[number]

/** Platforms the news worker can search with Agent Reach. */
export const SOCIAL_PLATFORMS = ['twitter', 'reddit', 'youtube', 'facebook', 'instagram', 'xiaohongshu', 'bilibili'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export const NEWS_REGIONS = ['north', 'central', 'south', 'islands', 'overseas'] as const

const newsSourceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: NEWS_SOURCE_TYPES, required: true },
    /** rss: the feed; youtube_channel: the channel page or feed; social: optional page to read. */
    url: { type: String, default: '' },
    /** google_news and social: what to search for. */
    query: { type: String, default: '' },
    platform: { type: String, enum: [...SOCIAL_PLATFORMS, null], default: null },
    /** An item must contain one of these (when any are set)… */
    includeKeywords: { type: [String], default: [] },
    /** …and none of these. */
    excludeKeywords: { type: [String], default: [] },
    /** Given to every item when the AI finds no region. */
    defaultRegion: { type: String, enum: [...NEWS_REGIONS, null], default: null },
    enabled: { type: Boolean, default: true },
    /** Items go straight to the Newsfeed; otherwise they wait for an admin. */
    autoPublish: { type: Boolean, default: false },
    /** How often the scheduler fetches it. */
    intervalMinutes: { type: Number, default: 60 },
    lastRunAt: { type: Date, default: null },
    lastStatus: { type: String, enum: ['ok', 'error', null], default: null },
    lastError: { type: String, default: '' },
    lastNewCount: { type: Number, default: 0 },
    createdBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
)

export const NewsSource = model('NewsSource', newsSourceSchema)
export type NewsSourceDocument = InstanceType<typeof NewsSource>

/**
 * queued     waiting for the AI to summarise and tag it
 * pending    waiting for an admin (its source does not publish by itself)
 * published  on the Newsfeed
 * rejected   not travel news (AI or admin), never shown
 * hidden     taken down by an admin after being published
 */
export const NEWS_STATUSES = ['queued', 'pending', 'published', 'rejected', 'hidden'] as const
export type NewsStatus = (typeof NEWS_STATUSES)[number]

export const NEWS_KINDS = ['article', 'video', 'post'] as const

/**
 * One piece of news, shown as a post of its own: a headline, a summary and a
 * few paragraphs the AI wrote in Vietnamese from the original, the original's
 * pictures (as links) and the link back. The original's text is never stored.
 */
const newsItemSchema = new Schema(
  {
    sourceId: { type: String, required: true },
    sourceName: { type: String, required: true },
    sourceType: { type: String, enum: NEWS_SOURCE_TYPES, required: true },
    platform: { type: String, default: null },
    /** Canonical link (tracking parameters removed); one item per link. */
    url: { type: String, required: true, unique: true },
    /** The source's own title; also what duplicates are recognised by. */
    title: { type: String, required: true },
    /** The title readers see: Vietnamese, from the AI, editable by admins. '' until written. */
    headline: { type: String, default: '' },
    /** The source's own description, plain text, at most 500 characters. */
    excerpt: { type: String, default: '' },
    /** 2–3 sentences in Vietnamese from the AI, editable by admins. */
    summary: { type: String, default: '' },
    /** The post itself: paragraphs the AI wrote from the original, editable by admins. */
    content: { type: [String], default: [] },
    /** The cover picture. */
    imageUrl: { type: String, default: '' },
    /** Every picture of the post, the cover first (links to the original's pictures). */
    images: { type: [String], default: [] },
    /** When the AI last wrote the post; null for items from before posts were written. */
    writtenAt: { type: Date, default: null },
    kind: { type: String, enum: NEWS_KINDS, default: 'article' },
    author: { type: String, default: '' },
    publishedAt: { type: Date, required: true },
    status: { type: String, enum: NEWS_STATUSES, default: 'queued' },
    statusReason: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
    regions: { type: [String], default: [] },
    destinations: { type: [String], default: [] },
    aiStatus: { type: String, enum: ['pending', 'done', 'skipped', 'failed'], default: 'pending' },
    aiAttempts: { type: Number, default: 0 },
    /** Failed tries at writing the post of an item that is already reviewed (see pipeline.enrichQueued). */
    writeAttempts: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    moderation: moderationField,
  },
  { timestamps: true, versionKey: false },
)

newsItemSchema.index({ status: 1, pinned: -1, publishedAt: -1 })
newsItemSchema.index({ status: 1, regions: 1, publishedAt: -1 })
newsItemSchema.index({ aiStatus: 1, createdAt: 1 })
newsItemSchema.index({ sourceId: 1, createdAt: -1 })

export const NewsItem = model('NewsItem', newsItemSchema)
export type NewsItemDocument = InstanceType<typeof NewsItem>

/** One fetch of one source: how many items came, were new, were filtered out. */
const newsRunSchema = new Schema(
  {
    sourceId: { type: String, required: true },
    sourceName: { type: String, required: true },
    trigger: { type: String, enum: ['schedule', 'manual', 'worker'], required: true },
    fetched: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    filtered: { type: Number, default: 0 },
    error: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

newsRunSchema.index({ createdAt: -1 })
// Run history cleans itself up after 30 days.
newsRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

export const NewsRun = model('NewsRun', newsRunSchema)

/** A user saved this news item (Your activity → Saved). */
const newsSaveSchema = new Schema(
  {
    userId: { type: String, required: true },
    itemId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

newsSaveSchema.index({ userId: 1, itemId: 1 }, { unique: true })
newsSaveSchema.index({ userId: 1, createdAt: -1 })

export const NewsSave = model('NewsSave', newsSaveSchema)

/**
 * The news worker's key (one at a time). Only its SHA-256 hash is stored; the
 * key itself is shown to the admin once when it is created.
 */
const newsWorkerSchema = new Schema(
  {
    _id: { type: String, default: 'worker' },
    keyHash: { type: String, default: null },
    keyHint: { type: String, default: '' },
    createdBy: { type: String, default: null },
    createdAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { versionKey: false },
)

export const NewsWorker = model('NewsWorker', newsWorkerSchema)
