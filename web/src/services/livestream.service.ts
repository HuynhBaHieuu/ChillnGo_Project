/**
 * Livestreams (server/src/routes/livestreams.ts). The video itself flows
 * through LiveKit; see features/livestream/useLiveRoom.ts.
 */

import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import type { SignedUpload } from '@/lib/cloudinaryUpload'
import { prepareImageForUpload } from '@/lib/images'
import { travelAvatar } from '@/lib/photos'

import { apiUrl, http } from './http'

export interface LiveAuthor {
  _id: string
  username: string
  displayName: string
  avatarUrl: string
}

export type LiveAudience = 'public' | 'followers' | 'private'

/** Same list, same order as the server (models/Livestream.ts). */
export const REACTION_KINDS = ['heart', 'fire', 'clap', 'wow', 'haha'] as const
export type ReactionKind = (typeof REACTION_KINDS)[number]

export type RecordingStatus = 'none' | 'recording' | 'processing' | 'ready' | 'failed'

export interface Livestream {
  _id: string
  title: string
  description: string
  audience: LiveAudience
  status: 'live' | 'ended'
  startedAt: string
  endedAt: string | null
  /** So far, while live. */
  durationSec: number
  viewerCount: number
  peakViewers: number
  /** Different signed-in people who watched. */
  uniqueViewers: number
  commentCount: number
  reactions: Record<ReactionKind, number>
  recording: { status: RecordingStatus; url: string | null; durationSec: number }
  /** Live and being recorded: viewers can rewind (see getDvrPlaylist). */
  dvr: boolean
  /** The replay's cover, chosen by the host. Empty: none (cards fall back to the host's photo). */
  thumbnailUrl: string
  host: LiveAuthor
  /** Only from getLivestream: the host removed the signed-in user from this stream. */
  blockedMe?: boolean
}

export interface LiveComment {
  _id: string
  text: string
  createdAt: string
  author: LiveAuthor
}

/** Where and how a browser joins the video room. The token is short-lived. */
export interface LiveConnection {
  url: string
  token: string
  role: 'host' | 'viewer' | 'preview'
}

export interface LiveConfig {
  live: boolean
  recording: boolean
}

function withAvatar<T extends { avatarUrl: string; username: string }>(person: T): T {
  return person.avatarUrl ? person : { ...person, avatarUrl: travelAvatar(person.username) }
}

function shown(stream: Livestream): Livestream {
  return { ...stream, host: withAvatar(stream.host) }
}

export function showComment(comment: LiveComment): LiveComment {
  return { ...comment, author: withAvatar(comment.author) }
}

export function getConfig(): Promise<LiveConfig> {
  return http<LiveConfig>('/api/livestreams/config', { auth: false })
}

/** Streams live right now; `authors` narrows to those accounts (the Newsfeed). */
export async function listLive(authors?: string[]): Promise<Livestream[]> {
  const query = authors ? `?authors=${encodeURIComponent(authors.join(','))}` : ''
  const { items } = await http<{ items: Livestream[] }>(`/api/livestreams${query}`)
  return items.map(shown)
}

/** A host's past streams, newest first. Pass the previous page's `nextBefore` for more. */
export async function listHistory(
  hostId: string,
  before?: string,
): Promise<{ items: Livestream[]; nextBefore: string | null }> {
  const query = new URLSearchParams({ host: hostId, ...(before && { before }) })
  const page = await http<{ items: Livestream[]; nextBefore: string | null }>(`/api/livestreams/history?${query}`)
  return { ...page, items: page.items.map(shown) }
}

/**
 * Recorded past streams you may watch again (ready, or still processing),
 * newest first. `authors` narrows to those accounts (the Newsfeed).
 */
export async function listReplays(
  authors?: string[],
  before?: string,
): Promise<{ items: Livestream[]; nextBefore: string | null }> {
  const query = new URLSearchParams({ ...(authors && { authors: authors.join(',') }), ...(before && { before }) })
  const page = await http<{ items: Livestream[]; nextBefore: string | null }>(`/api/livestreams/replays?${query}`)
  return { ...page, items: page.items.map(shown) }
}

export async function getLivestream(id: string): Promise<Livestream> {
  const { livestream, blocked } = await http<{ livestream: Livestream; blocked: boolean }>(`/api/livestreams/${id}`)
  return { ...shown(livestream), blockedMe: blocked }
}

export async function startLivestream(input: {
  title: string
  description: string
  audience: LiveAudience
  record: boolean
}): Promise<{ livestream: Livestream; connection: LiveConnection }> {
  const result = await http<{ livestream: Livestream; connection: LiveConnection }>('/api/livestreams', {
    method: 'POST',
    body: input,
  })
  return { ...result, livestream: shown(result.livestream) }
}

/** A fresh token: broadcast rights for the host, watch-only for everyone else. */
export async function getConnection(id: string): Promise<LiveConnection> {
  const { connection } = await http<{ connection: LiveConnection }>(`/api/livestreams/${id}/connection`, {
    method: 'POST',
  })
  return connection
}

/** A hidden, uncounted watch-only token for a muted preview. */
export async function getPreviewConnection(id: string): Promise<LiveConnection> {
  const { connection } = await http<{ connection: LiveConnection }>(`/api/livestreams/${id}/preview`, {
    method: 'POST',
  })
  return connection
}

/**
 * The rewind playlist of a recorded live stream: a full address with a
 * 6-hour access token for the signed-in viewer, ready for a video player.
 */
export async function getDvrPlaylist(id: string): Promise<string> {
  const { playlist } = await http<{ playlist: string }>(`/api/livestreams/${id}/dvr`)
  return apiUrl(playlist)
}

/** Ends the stream; answers with its final statistics. */
export async function endLivestream(id: string): Promise<Livestream> {
  const { livestream } = await http<{ livestream: Livestream }>(`/api/livestreams/${id}/end`, { method: 'POST' })
  return shown(livestream)
}

export async function listComments(id: string, limit = 50): Promise<LiveComment[]> {
  const { items } = await http<{ items: LiveComment[] }>(`/api/livestreams/${id}/comments?limit=${limit}`)
  return items.map(showComment)
}

export async function sendComment(id: string, text: string): Promise<LiveComment> {
  const { comment } = await http<{ comment: LiveComment }>(`/api/livestreams/${id}/comments`, {
    method: 'POST',
    body: { text },
  })
  return showComment(comment)
}

export function deleteComment(id: string, commentId: string): Promise<{ ok: true }> {
  return http(`/api/livestreams/${id}/comments/${commentId}`, { method: 'DELETE' })
}

/** `count` taps of the same reaction, bundled into one request (max 10). */
export function sendReaction(id: string, kind: ReactionKind, count: number): Promise<{ total: number }> {
  return http(`/api/livestreams/${id}/reactions`, { method: 'POST', body: { kind, count } })
}

/** Host only: removes a viewer from the stream for good, and their comments with them. */
export function blockViewer(id: string, userId: string): Promise<{ ok: true; removedComments: number }> {
  return http(`/api/livestreams/${id}/block`, { method: 'POST', body: { userId } })
}

/** Longest side of a replay cover sent to Cloudinary; delivered at 1280×720. */
const THUMBNAIL_MAX_SIDE = 1920

/**
 * Host only, once the replay is ready: uploads `image` (a captured frame or a
 * chosen photo) straight to Cloudinary and makes it the replay's cover.
 * Answers with the cover's new address. `onProgress` gets 0–100.
 */
export async function setThumbnail(id: string, image: File, onProgress?: (percent: number) => void): Promise<string> {
  const file = await prepareImageForUpload(image, THUMBNAIL_MAX_SIDE)
  const signature = await http<SignedUpload>(`/api/livestreams/${id}/thumbnail-signature`, { method: 'POST' })
  await uploadToCloudinary(signature, file, onProgress)
  const { thumbnailUrl } = await http<{ thumbnailUrl: string }>(`/api/livestreams/${id}/thumbnail`, { method: 'PUT' })
  return thumbnailUrl
}

/** Host only: removes the replay's cover. */
export async function removeThumbnail(id: string): Promise<void> {
  await http(`/api/livestreams/${id}/thumbnail`, { method: 'DELETE' })
}
