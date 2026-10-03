/**
 * /api/livestreams — live video sessions.
 *
 *   GET    /api/livestreams?authors=a,b          streams live right now that you may watch
 *   GET    /api/livestreams/config               what this server offers (recording on/off)
 *   GET    /api/livestreams/history?host=id      a host's past streams, with their statistics
 *   GET    /api/livestreams/replays?authors=a,b  recorded past streams you may watch again
 *   POST   /api/livestreams                      go live → { livestream, connection }
 *   GET    /api/livestreams/:id                  one stream (live or ended, with stats and replay)
 *   POST   /api/livestreams/:id/connection       access token to watch (or, for the host, to broadcast)
 *   POST   /api/livestreams/:id/preview          hidden, uncounted token for the muted Newsfeed preview
 *   GET    /api/livestreams/:id/dvr              a rewind link for a recorded live stream
 *   GET    /api/livestreams/:id/dvr.m3u8?access= the rewind (HLS) playlist, segments signed
 *   POST   /api/livestreams/:id/end              host only
 *   GET    /api/livestreams/:id/comments         comments, oldest first
 *   POST   /api/livestreams/:id/comments         { text } → stored, then sent to everyone in the room
 *   DELETE /api/livestreams/:id/comments/:cid    the host, or the comment's author
 *   POST   /api/livestreams/:id/reactions        { kind, count } → counted, then shown to everyone
 *   POST   /api/livestreams/:id/block            { userId } host only: removes a viewer for good
 *   POST   /api/livestreams/:id/thumbnail-signature  host only, replay ready: a signed cover upload
 *   PUT    /api/livestreams/:id/thumbnail        host only: use the cover just uploaded
 *   DELETE /api/livestreams/:id/thumbnail        host only: back to no cover
 *   POST   /api/livestreams/webhook              LiveKit events (signed)
 *
 * The host is always the signed-in user; nothing in a request body can name a
 * different one. LiveKit specifics live in lib/livekit.ts.
 */

import { waitUntil } from '@vercel/functions'
import express, { Router } from 'express'
import type { Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { confirmLiveThumbnail, removeLiveThumbnail, signLiveThumbnailUpload } from '../lib/cloudinary.js'
import { HttpError } from '../lib/errors.js'
import {
  broadcast,
  closeRoom,
  connectionFor,
  createRoom,
  isLiveKitConfigured,
  isRecordingConfigured,
  readWebhook,
  recordingState,
  recordingStateOf,
  removeUser,
  roomPresence,
  startRecording,
  stopRecording,
} from '../lib/livekit.js'
import type { RecordingState } from '../lib/livekit.js'
import { deletePrefix, dvrPlaylist, hlsPrefix, recordingKey, replayLink } from '../lib/recordings.js'
import { signDvrAccess, verifyDvrAccess } from '../lib/token.js'
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { followerIdsOf, followingIdsOf, follows } from '../models/Follow.js'
import { AUDIENCES, Livestream, LivestreamComment, LivestreamViewer, REACTIONS } from '../models/Livestream.js'
import type { LivestreamDocument } from '../models/Livestream.js'
import { notify } from '../models/Notification.js'
import { User } from '../models/User.js'

export const livestreamsRouter = Router()

/** A host who disconnected gets this long to come back (a page refresh, a network blip). */
const HOST_GRACE_MS = 45_000

const NOT_FOUND = () => new HttpError(404, 'Không tìm thấy livestream.', 'NOT_FOUND')
const ENDED = () => new HttpError(410, 'Livestream này đã kết thúc.', 'LIVE_ENDED')
const BLOCKED = () => new HttpError(403, 'Người phát đã chặn bạn khỏi livestream này.', 'LIVE_BLOCKED')

/* ---------------------------------------------------------------- helpers */

type Author = { _id: string; username: string; displayName: string; avatarUrl: string }

async function authorsById(ids: string[]): Promise<Map<string, Author>> {
  const users = await User.find({ _id: { $in: [...new Set(ids)] } }).select('username displayName avatarUrl').lean()
  return new Map(users.map((u) => [u._id, { _id: u._id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }]))
}

function unknownAuthor(id: string): Author {
  return { _id: id, username: 'deleted', displayName: 'Tài khoản đã xoá', avatarUrl: '' }
}

function toView(stream: LivestreamDocument, host: Author) {
  const end = stream.endedAt ?? new Date()
  return {
    _id: String(stream._id),
    title: stream.title,
    description: stream.description,
    audience: stream.audience,
    status: stream.status,
    startedAt: stream.startedAt.toISOString(),
    endedAt: stream.endedAt?.toISOString() ?? null,
    durationSec: Math.max(0, Math.round((end.getTime() - stream.startedAt.getTime()) / 1000)),
    viewerCount: stream.viewerCount,
    peakViewers: stream.peakViewers,
    uniqueViewers: stream.uniqueViewers,
    commentCount: stream.commentCount,
    reactions: {
      heart: stream.reactions?.heart ?? 0,
      fire: stream.reactions?.fire ?? 0,
      clap: stream.reactions?.clap ?? 0,
      wow: stream.reactions?.wow ?? 0,
      haha: stream.reactions?.haha ?? 0,
    },
    /** Viewers can rewind: the stream is live and being recorded (HLS segments on the way). */
    dvr: stream.status === 'live' && stream.recording?.status === 'recording' && Boolean(stream.recording.egressId),
    recording: {
      status: stream.recording?.status ?? 'none',
      // Filled in by withReplayLink, as a signed link for a viewer who may watch.
      url: null as string | null,
      durationSec: stream.recording?.durationSec ?? 0,
    },
    thumbnailUrl: stream.thumbnailUrl ?? '',
    host,
  }
}

/**
 * toView plus the signed replay link, for streams this viewer may see (the
 * caller has checked the audience). Lists need it too: a card without a
 * chosen cover shows the replay's first frame.
 */
async function withReplayLink(stream: LivestreamDocument, host: Author) {
  const view = toView(stream, host)
  if (stream.recording?.status === 'ready' && stream.recording.key) {
    view.recording.url = await replayLink(stream.recording.key)
  }
  return view
}

async function endStream(stream: LivestreamDocument, reason: 'host' | 'host_left'): Promise<void> {
  if (stream.status === 'ended') return
  // One last look at the room, so the peak includes whoever is still watching.
  const presence = await roomPresence(stream.roomName, stream.hostId).catch(() => null)
  if (presence) stream.peakViewers = Math.max(stream.peakViewers, presence.viewers)
  const recordingId = stream.recording?.status === 'recording' ? stream.recording.egressId : null
  stream.set({
    status: 'ended',
    endedAt: new Date(),
    endedReason: reason,
    viewerCount: 0,
    uniqueViewers: await LivestreamViewer.countDocuments({ livestreamId: String(stream._id) }),
  })
  if (recordingId) stream.set('recording.status', 'processing')
  await stream.save()
  if (recordingId) await stopRecording(recordingId)
  await closeRoom(stream.roomName)
}

function applyRecordingState(stream: LivestreamDocument, state: RecordingState): void {
  if (state.state === 'ready' && stream.recording?.status !== 'ready') {
    stream.set({ 'recording.status': 'ready', 'recording.durationSec': state.durationSec })
    // The replay MP4 is in: the rewind segments are no longer needed.
    waitUntil(deletePrefix(hlsPrefix(String(stream._id))).catch((error: unknown) => console.error('deletePrefix failed:', error)))
  }
  if (state.state === 'failed') stream.set('recording.status', 'failed')
}

/**
 * Brings a record in line with what LiveKit actually sees. For a live stream:
 * refreshes the viewer count, and ends it if the room is gone or the host has
 * been away longer than the grace period (so a closed tab never leaves a fake
 * LIVE badge behind). For an ended one: checks on a recording still being
 * processed, in case no webhook reported it.
 */
async function reconcile(stream: LivestreamDocument): Promise<void> {
  if (!isLiveKitConfigured()) return

  if (stream.status === 'ended') {
    const egressId = stream.recording?.egressId
    // A recording that never got going (its start was cut short): give up on it.
    const endedFor = Date.now() - (stream.endedAt ?? stream.startedAt).getTime()
    if (stream.recording?.status === 'recording' && !egressId && endedFor > 120_000) {
      stream.set('recording.status', 'failed')
      await stream.save()
      return
    }
    if (stream.recording?.status !== 'processing' || !egressId) return
    const state = await recordingState(egressId).catch(() => null)
    if (state) applyRecordingState(stream, state)
    if (stream.isModified()) await stream.save()
    return
  }

  const presence = await roomPresence(stream.roomName, stream.hostId).catch(() => null)
  if (!presence) return // LiveKit unreachable: leave the record alone this time

  const hostAwayFor = Date.now() - (stream.hostSeenAt ?? stream.startedAt).getTime()
  if (!presence.exists || (!presence.hostPresent && hostAwayFor > HOST_GRACE_MS)) {
    await endStream(stream, 'host_left')
    return
  }

  if (presence.hostPresent) stream.hostSeenAt = new Date()
  stream.viewerCount = presence.viewers
  stream.peakViewers = Math.max(stream.peakViewers, presence.viewers)
  if (stream.isModified()) await stream.save()
}

async function canSee(stream: LivestreamDocument, viewerId: string | undefined): Promise<boolean> {
  if (stream.hostId === viewerId) return true
  if (stream.audience === 'public') return true
  if (stream.audience === 'followers') return follows(viewerId, stream.hostId)
  return false
}

/** Loads a stream by id, checking the id and that this viewer may see it. */
async function loadVisible(req: Request, res: Response): Promise<LivestreamDocument> {
  const id = String(req.params.id)
  if (!isValidObjectId(id)) throw NOT_FOUND()
  const stream = await Livestream.findById(id)
  if (!stream || !(await canSee(stream, res.locals.userId as string | undefined))) throw NOT_FOUND()
  return stream
}

function isBlocked(stream: LivestreamDocument, userId: string | undefined): boolean {
  return Boolean(userId && stream.blockedUserIds.includes(userId))
}

/** Mongo filter: the streams `viewerId` may see (see canSee). */
async function visibleTo(viewerId: string | undefined) {
  if (!viewerId) return { audience: 'public' }
  const following = await followingIdsOf(viewerId)
  return {
    $or: [{ audience: 'public' }, { hostId: viewerId }, { audience: 'followers', hostId: { $in: following } }],
  }
}

function perUser(windowMs: number, limit: number, message: string, code?: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.userId),
    message: { message, ...(code && { code }) },
  })
}

/* ------------------------------------------------------------------ routes */

/** GET /api/livestreams/config — lets the web app offer only what the server can do. */
livestreamsRouter.get('/config', (_req, res) => {
  res.json({ live: isLiveKitConfigured(), recording: isRecordingConfigured() })
})

const listSchema = z.object({
  authors: z
    .string()
    .max(4000)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200) : undefined)),
})

/** GET /api/livestreams — live now. Anonymous callers see public streams only. */
livestreamsRouter.get('/', optionalAuth, async (req, res) => {
  if (!isLiveKitConfigured()) {
    res.json({ items: [] })
    return
  }
  const { authors } = listSchema.parse(req.query)
  const viewerId = res.locals.userId as string | undefined

  const filter: Record<string, unknown> = { status: 'live', ...(await visibleTo(viewerId)) }
  if (authors) filter.hostId = { $in: authors }

  const streams = await Livestream.find(filter).sort({ startedAt: -1 }).limit(20)
  await Promise.all(streams.map(reconcile))
  const live = streams.filter((s) => s.status === 'live')
  const hosts = await authorsById(live.map((s) => s.hostId))
  res.json({ items: live.map((s) => toView(s, hosts.get(s.hostId) ?? unknownAuthor(s.hostId))) })
})

const historySchema = z.object({
  host: z.string().refine(isValidObjectId, 'Người dùng không hợp lệ'),
  before: z.iso.datetime().optional().catch(undefined),
})

/** GET /api/livestreams/history?host=<userId>&before=<ISO> — ended streams, newest first, 12 at a time. */
livestreamsRouter.get('/history', optionalAuth, async (req, res) => {
  const { host, before } = historySchema.parse(req.query)
  const viewerId = res.locals.userId as string | undefined

  const filter: Record<string, unknown> = { hostId: host, status: 'ended', ...(await visibleTo(viewerId)) }
  if (before) filter.startedAt = { $lt: new Date(before) }
  const streams = await Livestream.find(filter).sort({ startedAt: -1 }).limit(12)
  await Promise.all(streams.map(reconcile))

  const author = (await authorsById([host])).get(host) ?? unknownAuthor(host)
  res.json({
    items: await Promise.all(streams.map((s) => withReplayLink(s, author))),
    nextBefore: streams.length === 12 ? streams[11].startedAt.toISOString() : null,
  })
})

const replaysSchema = listSchema.extend({ before: z.iso.datetime().optional().catch(undefined) })

/**
 * GET /api/livestreams/replays?authors=a,b&before=<ISO> — ended streams that
 * were recorded (ready, or still being processed), newest first, 12 at a time.
 * Everyone's that you may see; `authors` narrows to those accounts (the Newsfeed).
 */
livestreamsRouter.get('/replays', optionalAuth, async (req, res) => {
  const { authors, before } = replaysSchema.parse(req.query)
  const viewerId = res.locals.userId as string | undefined

  const filter: Record<string, unknown> = {
    status: 'ended',
    'recording.status': { $in: ['ready', 'processing'] },
    ...(await visibleTo(viewerId)),
  }
  if (authors) filter.hostId = { $in: authors }
  if (before) filter.startedAt = { $lt: new Date(before) }
  const streams = await Livestream.find(filter).sort({ startedAt: -1 }).limit(12)
  await Promise.all(streams.map(reconcile)) // a replay still processing may be ready now

  const hosts = await authorsById(streams.map((s) => s.hostId))
  res.json({
    items: await Promise.all(streams.map((s) => withReplayLink(s, hosts.get(s.hostId) ?? unknownAuthor(s.hostId)))),
    nextBefore: streams.length === 12 ? streams[11].startedAt.toISOString() : null,
  })
})

const createSchema = z.object({
  title: z.string('Vui lòng nhập tiêu đề').trim().min(1, 'Vui lòng nhập tiêu đề').max(100, 'Tiêu đề tối đa 100 ký tự'),
  description: z.string().trim().max(500, 'Mô tả tối đa 500 ký tự').default(''),
  audience: z.enum(AUDIENCES, 'Chế độ người xem không hợp lệ').default('public'),
  record: z.boolean().default(false),
})

const startLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn bắt đầu livestream quá nhiều lần. Vui lòng đợi vài phút.' },
})

/** POST /api/livestreams — the signed-in user goes live. */
livestreamsRouter.post('/', requireAuth, loadCurrentUser, startLimiter, async (req, res) => {
  const { record, ...input } = createSchema.parse(req.body)
  const host = currentUser(res)
  if (!isLiveKitConfigured()) throw new HttpError(503, 'Livestream chưa được cấu hình trên máy chủ.', 'LIVE_NOT_CONFIGURED')

  // Already live? Check the old stream is really still running first.
  const existing = await Livestream.findOne({ hostId: host._id, status: 'live' })
  if (existing) {
    await reconcile(existing)
    if (existing.status === 'live') {
      throw new HttpError(409, 'Bạn đang có một livestream khác. Hãy kết thúc nó trước.', 'ALREADY_LIVE')
    }
  }

  const stream = new Livestream({ hostId: host._id, ...input })
  stream.roomName = `live_${String(stream._id)}`
  try {
    await stream.save()
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new HttpError(409, 'Bạn đang có một livestream khác. Hãy kết thúc nó trước.', 'ALREADY_LIVE')
    }
    throw error
  }

  try {
    await createRoom(stream.roomName)
  } catch (error) {
    await stream.deleteOne()
    throw error
  }

  const recording = record && isRecordingConfigured()
  if (recording) {
    stream.set('recording.status', 'recording')
    await stream.save()
  }

  const connection = await connectionFor(stream.roomName, host, 'host')
  res.status(201).json({ livestream: toView(stream, host), connection })

  // After answering, so the host is not kept waiting (waitUntil keeps a
  // Vercel function alive for it): start the recording, tell the followers.
  waitUntil(
    Promise.all([
      recording ? beginRecording(String(stream._id)) : null,
      stream.audience !== 'private'
        ? followerIdsOf(host._id).then((ids) =>
            notify(ids, {
              type: 'live',
              actorId: host._id,
              livestreamId: String(stream._id),
              message: `đang phát trực tiếp: “${stream.title}”`,
            }),
          )
        : null,
    ]),
  )
})

/**
 * Asks LiveKit to record the stream. A recording that fails to start never
 * stops the stream; it is marked "failed". If the host already ended the
 * stream meanwhile, the new recording is stopped straight away.
 */
async function beginRecording(streamId: string): Promise<void> {
  const key = recordingKey(streamId)
  let egressId: string | null = null
  try {
    egressId = await startRecording(`live_${streamId}`, key, hlsPrefix(streamId))
  } catch (error) {
    console.error('LiveKit startRecording failed:', error)
  }
  const stream = await Livestream.findById(streamId)
  if (!stream) return
  if (!egressId) {
    stream.set('recording.status', 'failed')
  } else {
    stream.set({ 'recording.egressId': egressId, 'recording.key': key })
    if (stream.status === 'ended') {
      stream.set('recording.status', 'processing')
      await stopRecording(egressId)
    }
  }
  await stream.save()
}

/** GET /api/livestreams/:id */
livestreamsRouter.get('/:id', optionalAuth, async (req, res) => {
  const stream = await loadVisible(req, res)
  await reconcile(stream)
  const host = (await authorsById([stream.hostId])).get(stream.hostId) ?? unknownAuthor(stream.hostId)
  // loadVisible already checked the audience: this viewer may watch the replay.
  const view = await withReplayLink(stream, host)
  res.json({ livestream: view, blocked: isBlocked(stream, res.locals.userId as string | undefined) })
})

/** POST /api/livestreams/:id/connection — host gets broadcast rights, everyone else watch-only. */
livestreamsRouter.post('/:id/connection', requireAuth, loadCurrentUser, async (req, res) => {
  const stream = await loadVisible(req, res)
  await reconcile(stream)
  if (stream.status !== 'live') throw ENDED()

  const user = currentUser(res)
  if (isBlocked(stream, user._id)) throw BLOCKED()
  const role = user._id === stream.hostId ? 'host' : 'viewer'
  if (role === 'host') {
    stream.hostSeenAt = new Date()
    await stream.save()
  } else {
    // First visit by this person: one more unique viewer.
    const seen = await LivestreamViewer.updateOne(
      { livestreamId: String(stream._id), userId: user._id },
      { $setOnInsert: { livestreamId: String(stream._id), userId: user._id } },
      { upsert: true },
    )
    if (seen.upsertedCount) await Livestream.updateOne({ _id: stream._id }, { $inc: { uniqueViewers: 1 } })
  }
  res.json({ connection: await connectionFor(stream.roomName, user, role) })
})

/** Previews are cheap to ask for and anonymous callers may ask: keep them in check per address. */
const previewLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu xem trước. Vui lòng đợi một chút.' },
})

/** POST /api/livestreams/:id/preview — a hidden, watch-only token: not in the room list, not counted. */
livestreamsRouter.post('/:id/preview', optionalAuth, previewLimiter, async (req, res) => {
  const stream = await loadVisible(req, res)
  if (stream.status !== 'live') throw ENDED()
  const userId = res.locals.userId as string | undefined
  if (isBlocked(stream, userId)) throw BLOCKED()
  const person = userId ? await User.findById(userId).select('username displayName avatarUrl') : null
  res.json({ connection: await connectionFor(stream.roomName, person, 'preview') })
})

/**
 * GET /api/livestreams/:id/dvr — where to rewind from: the playlist address,
 * carrying a 6-hour access token for this viewer (video players cannot send
 * the Authorization header). Only for a live stream that is being recorded.
 */
livestreamsRouter.get('/:id/dvr', requireAuth, loadCurrentUser, async (req, res) => {
  const stream = await loadVisible(req, res)
  if (stream.status !== 'live') throw ENDED()
  const user = currentUser(res)
  if (isBlocked(stream, user._id)) throw BLOCKED()
  if (!(stream.recording?.status === 'recording' && stream.recording.egressId)) {
    throw new HttpError(404, 'Buổi phát này không được ghi lại nên không tua được.', 'DVR_UNAVAILABLE')
  }
  const access = signDvrAccess(user._id, String(stream._id))
  res.json({ playlist: `/api/livestreams/${String(stream._id)}/dvr.m3u8?access=${encodeURIComponent(access)}` })
})

/** Players reload the playlist every few seconds; plenty of room, but not unlimited. */
const playlistLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu. Vui lòng đợi một chút.' },
})

/** GET /api/livestreams/:id/dvr.m3u8?access=… — the rewind playlist, every segment a signed link. */
livestreamsRouter.get('/:id/dvr.m3u8', playlistLimiter, async (req, res) => {
  const id = String(req.params.id)
  const claims = verifyDvrAccess(String(req.query.access ?? ''))
  if (!claims || claims.streamId !== id || !isValidObjectId(id)) throw new HttpError(401, 'Liên kết tua đã hết hạn.', 'DVR_ACCESS')

  // The access rules are checked again on every reload: an unfollow or a block takes effect at once.
  const stream = await Livestream.findById(id)
  if (!stream || !(await canSee(stream, claims.userId))) throw NOT_FOUND()
  if (isBlocked(stream, claims.userId)) throw BLOCKED()
  if (stream.status !== 'live') throw ENDED()

  const playlist = await dvrPlaylist(hlsPrefix(id))
  if (!playlist) throw new HttpError(404, 'Đoạn ghi đầu tiên đang được tải lên, thử lại sau vài giây.', 'DVR_NOT_READY')
  res.set({ 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' }).send(playlist)
})

/** POST /api/livestreams/:id/end — only the host. */
livestreamsRouter.post('/:id/end', requireAuth, loadCurrentUser, async (req, res) => {
  const stream = await loadVisible(req, res)
  if (stream.hostId !== currentUser(res)._id) {
    throw new HttpError(403, 'Chỉ người phát mới kết thúc được livestream.', 'FORBIDDEN')
  }
  await endStream(stream, 'host')
  const host = (await authorsById([stream.hostId])).get(stream.hostId) ?? unknownAuthor(stream.hostId)
  res.json({ ok: true, livestream: toView(stream, host) })
})

const commentsQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).catch(50) })

/** GET /api/livestreams/:id/comments?limit=50 — the latest ones, oldest first. */
livestreamsRouter.get('/:id/comments', optionalAuth, async (req, res) => {
  const stream = await loadVisible(req, res)
  const { limit } = commentsQuery.parse(req.query)
  const latest = await LivestreamComment.find({ livestreamId: String(stream._id) }).sort({ createdAt: -1 }).limit(limit).lean()
  const authors = await authorsById(latest.map((c) => c.authorId))
  res.json({
    items: latest.reverse().map((c) => ({
      _id: String(c._id),
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      author: authors.get(c.authorId) ?? unknownAuthor(c.authorId),
    })),
  })
})

/** One comment every ~2.5 s per user on average, with room for a short burst. */
const commentLimiter = perUser(20_000, 8, 'Bạn bình luận hơi nhanh. Đợi vài giây rồi thử lại nhé.', 'COMMENT_RATE_LIMIT')

const commentSchema = z.object({
  text: z
    .string('Bình luận không hợp lệ')
    .trim()
    .min(1, 'Bình luận không được để trống')
    .max(300, 'Bình luận tối đa 300 ký tự'),
})

/** POST /api/livestreams/:id/comments */
livestreamsRouter.post('/:id/comments', requireAuth, loadCurrentUser, commentLimiter, async (req, res) => {
  const { text } = commentSchema.parse(req.body)
  const stream = await loadVisible(req, res)
  if (stream.status !== 'live') throw ENDED()
  const user = currentUser(res)
  if (isBlocked(stream, user._id)) throw BLOCKED()

  const saved = await LivestreamComment.create({ livestreamId: String(stream._id), authorId: user._id, text })
  await Livestream.updateOne({ _id: stream._id }, { $inc: { commentCount: 1 } })
  const comment = {
    _id: String(saved._id),
    text: saved.text,
    createdAt: saved.createdAt.toISOString(),
    author: { _id: user._id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
  }
  await broadcast(stream.roomName, { type: 'comment', comment })
  res.status(201).json({ comment })
})

/** DELETE /api/livestreams/:id/comments/:commentId — the host (moderating) or the author. */
livestreamsRouter.delete('/:id/comments/:commentId', requireAuth, loadCurrentUser, async (req, res) => {
  const stream = await loadVisible(req, res)
  const commentId = String(req.params.commentId)
  if (!isValidObjectId(commentId)) throw new HttpError(404, 'Không tìm thấy bình luận.', 'NOT_FOUND')
  const comment = await LivestreamComment.findOne({ _id: commentId, livestreamId: String(stream._id) })
  if (!comment) throw new HttpError(404, 'Không tìm thấy bình luận.', 'NOT_FOUND')

  const me = currentUser(res)._id
  if (me !== stream.hostId && me !== comment.authorId) {
    throw new HttpError(403, 'Bạn không thể xoá bình luận này.', 'FORBIDDEN')
  }
  await comment.deleteOne()
  await Livestream.updateOne({ _id: stream._id, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } })
  if (stream.status === 'live') await broadcast(stream.roomName, { type: 'comment_removed', commentIds: [commentId] })
  res.json({ ok: true })
})

/** A tap is one reaction; the web app bundles quick taps, up to 10 in one request. */
const reactionLimiter = perUser(10_000, 20, 'Bạn thả cảm xúc hơi nhanh. Đợi một chút nhé.', 'REACTION_RATE_LIMIT')

const reactionSchema = z.object({
  kind: z.enum(REACTIONS, 'Cảm xúc không hợp lệ'),
  count: z.number().int().min(1).max(10).default(1),
})

/** POST /api/livestreams/:id/reactions { kind, count } */
livestreamsRouter.post('/:id/reactions', requireAuth, loadCurrentUser, reactionLimiter, async (req, res) => {
  const { kind, count } = reactionSchema.parse(req.body)
  const stream = await loadVisible(req, res)
  if (stream.status !== 'live') throw ENDED()
  const user = currentUser(res)
  if (isBlocked(stream, user._id)) throw BLOCKED()

  const updated = await Livestream.findByIdAndUpdate(stream._id, { $inc: { [`reactions.${kind}`]: count } }, { new: true })
  await broadcast(stream.roomName, { type: 'reaction', kind, count, userId: user._id })
  res.json({ total: updated?.reactions?.[kind] ?? count })
})

const blockSchema = z.object({ userId: z.string().refine(isValidObjectId, 'Người dùng không hợp lệ') })

/**
 * POST /api/livestreams/:id/block { userId } — the host removes a viewer: they
 * are disconnected, cannot rejoin, comment or react, and their comments go.
 */
livestreamsRouter.post('/:id/block', requireAuth, loadCurrentUser, async (req, res) => {
  const { userId } = blockSchema.parse(req.body)
  const stream = await loadVisible(req, res)
  if (stream.hostId !== currentUser(res)._id) throw new HttpError(403, 'Chỉ người phát mới chặn được người xem.', 'FORBIDDEN')
  if (userId === stream.hostId) throw new HttpError(400, 'Bạn không thể tự chặn chính mình.', 'SELF_BLOCK')

  await Livestream.updateOne({ _id: stream._id }, { $addToSet: { blockedUserIds: userId } })
  const theirs = await LivestreamComment.find({ livestreamId: String(stream._id), authorId: userId }).select('_id').lean()
  if (theirs.length) {
    await LivestreamComment.deleteMany({ _id: { $in: theirs.map((c) => c._id) } })
    await Livestream.updateOne({ _id: stream._id }, { $inc: { commentCount: -theirs.length } })
  }
  if (stream.status === 'live') {
    await broadcast(stream.roomName, { type: 'comment_removed', commentIds: theirs.map((c) => String(c._id)) })
    await removeUser(stream.roomName, userId)
  }
  res.json({ ok: true, removedComments: theirs.length })
})

/**
 * Loads a stream whose replay cover the signed-in user may change: theirs,
 * with the replay ready.
 */
async function loadForThumbnail(req: Request, res: Response): Promise<LivestreamDocument> {
  const stream = await loadVisible(req, res)
  if (stream.hostId !== currentUser(res)._id) throw new HttpError(403, 'Chỉ người phát mới đổi được ảnh bìa.', 'FORBIDDEN')
  if (stream.recording?.status !== 'ready') {
    throw new HttpError(409, 'Chỉ chọn được ảnh bìa khi đã có video xem lại.', 'REPLAY_NOT_READY')
  }
  return stream
}

const thumbnailLimiter = perUser(15 * 60 * 1000, 30, 'Bạn đổi ảnh bìa quá nhiều lần. Vui lòng đợi vài phút.')

/** POST /api/livestreams/:id/thumbnail-signature → { uploadUrl, fields }: the browser posts the image to Cloudinary. */
livestreamsRouter.post('/:id/thumbnail-signature', requireAuth, loadCurrentUser, thumbnailLimiter, async (req, res) => {
  const stream = await loadForThumbnail(req, res)
  res.json(signLiveThumbnailUpload(stream.hostId, String(stream._id)))
})

/** PUT /api/livestreams/:id/thumbnail — use the image just uploaded. → { thumbnailUrl } */
livestreamsRouter.put('/:id/thumbnail', requireAuth, loadCurrentUser, async (req, res) => {
  const stream = await loadForThumbnail(req, res)
  stream.thumbnailUrl = await confirmLiveThumbnail(stream.hostId, String(stream._id))
  await stream.save()
  res.json({ thumbnailUrl: stream.thumbnailUrl })
})

/** DELETE /api/livestreams/:id/thumbnail → { thumbnailUrl: '' } */
livestreamsRouter.delete('/:id/thumbnail', requireAuth, loadCurrentUser, async (req, res) => {
  const stream = await loadForThumbnail(req, res)
  await removeLiveThumbnail(stream.hostId, String(stream._id))
  stream.thumbnailUrl = ''
  await stream.save()
  res.json({ thumbnailUrl: stream.thumbnailUrl })
})

/**
 * POST /api/livestreams/webhook — LiveKit tells us when a room closes, the
 * host drops out, or a recording finishes. Optional: without it, reconcile()
 * catches the same cases on the next request. Needs the raw body to check
 * the signature.
 */
livestreamsRouter.post('/webhook', express.raw({ type: 'application/webhook+json' }), async (req, res) => {
  const event = await readWebhook(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '', req.get('authorization')).catch(() => null)
  if (!event) throw new HttpError(401, 'Invalid webhook', 'BAD_WEBHOOK')

  if (event.event === 'egress_ended' && event.egressInfo) {
    const recorded = await Livestream.findOne({ 'recording.egressId': event.egressInfo.egressId })
    if (recorded) {
      applyRecordingState(recorded, recordingStateOf(event.egressInfo))
      if (recorded.isModified()) await recorded.save()
    }
  }

  const roomName = event.room?.name
  const stream = roomName ? await Livestream.findOne({ roomName, status: 'live' }) : null
  if (stream) {
    if (event.event === 'room_finished') await endStream(stream, 'host_left')
    // Someone joined: refresh the live count and the peak right away.
    if (event.event === 'participant_joined') await reconcile(stream)
    if (event.event === 'participant_left' && event.participant?.identity === stream.hostId) {
      // Start the grace period now; reconcile() ends it if they do not return.
      stream.hostSeenAt = new Date()
      await stream.save()
    }
  }
  res.json({ ok: true })
})
