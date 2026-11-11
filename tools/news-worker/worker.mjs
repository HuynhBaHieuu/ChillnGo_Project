#!/usr/bin/env node
/**
 * ChillnGo news worker: fetches the Newsfeed's social sources (X/Twitter,
 * Reddit, Facebook, Instagram, YouTube search, Xiaohongshu, Bilibili) with
 * Agent Reach on this machine and sends what it finds to the API.
 *
 *   1. GET  /api/news/worker/sources   the social sources due now
 *   2. agent-reach <platform> search <query>   (or agent-reach read <url>)
 *   3. POST /api/news/worker/ingest    the items, or the error
 *
 * The API filters, de-duplicates, lets the AI summarise and decides whether an
 * item is published or waits for an admin, exactly as for server-side sources.
 *
 * Settings (environment variables, or a worker.env file next to this script):
 *   CHILLNGO_API          API address, e.g. https://chillgo-project.vercel.app
 *   CHILLNGO_WORKER_KEY   the key from Admin → Tin tức → Máy cào
 *   AGENT_REACH           the agent-reach command (default: agent-reach)
 *   NEWS_LIMIT            items per source (default: 15)
 *
 * Run once: node worker.mjs   (schedule it with Windows Task Scheduler or cron)
 */

import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envFile = join(here, 'worker.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const API = (process.env.CHILLNGO_API || 'https://chillgo-project.vercel.app').replace(/\/$/, '')
const KEY = process.env.CHILLNGO_WORKER_KEY || ''
const AGENT_REACH = process.env.AGENT_REACH || 'agent-reach'
const LIMIT = Number(process.env.NEWS_LIMIT) || 15

if (!KEY) {
  console.error('CHILLNGO_WORKER_KEY is missing: create one in Admin → Tin tức → Máy cào.')
  process.exit(1)
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Worker-Key': KEY, ...(init.headers || {}) },
    signal: AbortSignal.timeout(60_000),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${body.message || ''}`)
  return body
}

/** Runs agent-reach and parses its one JSON object. */
function reach(args) {
  return new Promise((resolve, reject) => {
    execFile(AGENT_REACH, args, { timeout: 180_000, maxBuffer: 20 * 1024 * 1024, windowsHide: true, shell: process.platform === 'win32' }, (error, stdout) => {
      let data
      try {
        data = JSON.parse(stdout)
      } catch {
        reject(new Error(error ? error.message : 'agent-reach printed no JSON'))
        return
      }
      if (!data.ok) {
        const e = data.error || {}
        reject(new Error([e.message, e.hint].filter(Boolean).join(' — ') || 'agent-reach failed'))
        return
      }
      resolve(data)
    })
  })
}

const first = (...values) => values.find((v) => typeof v === 'string' && v.trim() !== '')?.trim() ?? ''

/** YYYYMMDD (yt-dlp), seconds, or any date string → ISO. */
function isoDate(value) {
  if (value == null || value === '') return undefined
  if (typeof value === 'number') return new Date(value > 1e12 ? value : value * 1000).toISOString()
  const s = String(value)
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** One Agent Reach item → what the API takes. Field names differ by platform, so several are tried. */
function toItem(raw, platform) {
  const text = first(raw.text, raw.description, raw.content, raw.snippet, raw.summary, raw.desc, raw.body)
  const url = first(raw.url, raw.link, raw.permalink, raw.webpage_url)
  const title = first(raw.title, raw.name, text.split(/\n/)[0]).slice(0, 300)
  if (!url || !title) return null
  return {
    url,
    title,
    excerpt: text.slice(0, 2000),
    imageUrl: first(raw.thumbnail, raw.image, raw.cover, raw.image_url, raw.thumbnail_url).replace(/^http:/, 'https:'),
    author: first(raw.author, raw.channel, raw.uploader, raw.user, raw.username, raw.screen_name, raw.subreddit),
    publishedAt: isoDate(raw.published ?? raw.published_at ?? raw.created_at ?? raw.date ?? raw.upload_date ?? raw.time ?? raw.timestamp),
    kind: platform === 'youtube' || platform === 'bilibili' ? 'video' : 'post',
  }
}

async function runSource(source) {
  const args = source.query
    ? [source.platform, 'search', source.query, '--limit', String(LIMIT)]
    : ['read', source.url]
  try {
    const data = await reach(args)
    const raws = Array.isArray(data.items) ? data.items : data.result ? [data.result] : []
    const items = raws.map((r) => toItem(r, source.platform)).filter(Boolean)
    const result = await api('/api/news/worker/ingest', { method: 'POST', body: JSON.stringify({ sourceId: source._id, items }) })
    console.log(`✓ ${source.name}: ${items.length} fetched, ${result.created} new, ${result.duplicates} already known, ${result.filtered} filtered`)
  } catch (error) {
    console.error(`✗ ${source.name}: ${error.message}`)
    await api('/api/news/worker/ingest', {
      method: 'POST',
      body: JSON.stringify({ sourceId: source._id, error: String(error.message).slice(0, 500) }),
    }).catch(() => undefined)
  }
}

const { items: sources } = await api('/api/news/worker/sources')
if (sources.length === 0) console.log('No social source is due.')
for (const source of sources) await runSource(source)
