/**
 * Playing back livestream recordings from the (private) storage bucket.
 *
 * LiveKit uploads each recording itself (lib/livekit.ts): an MP4 for the
 * replay, and HLS segments while live for rewinding. The bucket is never
 * public: a viewer the stream's audience allows gets signed links that work
 * for a few hours, so a followers-only or private stream cannot be opened by
 * guessing an address.
 */

import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { env } from '../env.js'

/** Long enough to watch a long stream (seeking included) without a link expiring. */
const LINK_TTL_SECONDS = 6 * 60 * 60

let client: S3Client | null = null

function s3(): S3Client | null {
  const storage = env.recording
  if (!storage) return null
  client ??= new S3Client({
    region: storage.region,
    endpoint: storage.endpoint || undefined,
    forcePathStyle: Boolean(storage.endpoint),
    credentials: { accessKeyId: storage.accessKey, secretAccessKey: storage.secret },
    // Plain S3 links: the newer checksum parameters trip up some S3-compatible providers (B2, R2).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return client
}

/** Where a stream's replay (MP4) is stored in the bucket. */
export function recordingKey(streamId: string): string {
  return `livestreams/${streamId}.mp4`
}

/** The folder of a stream's rewind (HLS) segments and playlist. */
export function hlsPrefix(streamId: string): string {
  return `livestreams/${streamId}-hls`
}

async function sign(key: string): Promise<string> {
  const storage = env.recording
  const s3Client = s3()
  if (!storage || !s3Client) throw new Error('Recording storage is not configured')
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: storage.bucket, Key: key }), {
    expiresIn: LINK_TTL_SECONDS,
  })
}

/** A signed, temporary link to play a recording; null if storage is not configured. */
export async function replayLink(key: string): Promise<string | null> {
  return env.recording ? sign(key) : null
}

/** A segment reference in a playlist → its key in the bucket. */
function segmentKey(uri: string, playlistDir: string): string {
  if (/^https?:\/\//.test(uri)) {
    // Absolute (path-style) URL: /<bucket>/<key>
    const path = decodeURIComponent(new URL(uri).pathname).replace(/^\//, '')
    const bucket = `${env.recording?.bucket}/`
    return path.startsWith(bucket) ? path.slice(bucket.length) : path
  }
  return uri.startsWith('/') ? uri.slice(1) : playlistDir + uri
}

/** Playlists fetched from the bucket in the last moments, so many viewers cost one read. */
const playlistCache = new Map<string, { at: number; text: string }>()
const PLAYLIST_CACHE_MS = 2000

/**
 * The rewind playlist of a live stream, with every segment turned into a
 * signed link. Null while LiveKit has not uploaded the first segment yet.
 * Marked as an EVENT playlist, so players allow seeking back to the start.
 */
export async function dvrPlaylist(prefix: string): Promise<string | null> {
  const storage = env.recording
  const s3Client = s3()
  if (!storage || !s3Client) return null

  const cached = playlistCache.get(prefix)
  if (cached && Date.now() - cached.at < PLAYLIST_CACHE_MS) return cached.text

  const key = `${prefix}/playlist.m3u8`
  let raw: string
  try {
    const object = await s3Client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }))
    raw = (await object.Body?.transformToString()) ?? ''
  } catch (error) {
    const name = (error as { name?: string }).name
    if (name === 'NoSuchKey' || name === 'NotFound') return null
    throw error
  }
  if (!raw.startsWith('#EXTM3U')) return null

  const dir = key.slice(0, key.lastIndexOf('/') + 1)
  const lines = await Promise.all(
    raw.split(/\r?\n/).map(async (line) => {
      if (!line || line.startsWith('#')) return line
      return sign(segmentKey(line.trim(), dir))
    }),
  )
  if (!raw.includes('#EXT-X-PLAYLIST-TYPE') && !raw.includes('#EXT-X-ENDLIST')) {
    lines.splice(1, 0, '#EXT-X-PLAYLIST-TYPE:EVENT')
  }
  const text = lines.join('\n')
  playlistCache.set(prefix, { at: Date.now(), text })
  if (playlistCache.size > 100) playlistCache.delete(playlistCache.keys().next().value as string)
  return text
}

/** Deletes everything under a prefix (the rewind segments once the replay MP4 is ready). */
export async function deletePrefix(prefix: string): Promise<void> {
  const storage = env.recording
  const s3Client = s3()
  if (!storage || !s3Client) return
  let token: string | undefined
  do {
    const page = await s3Client.send(
      new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: `${prefix}/`, ContinuationToken: token }),
    )
    const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k))
    for (let i = 0; i < keys.length; i += 10) {
      await Promise.all(
        keys.slice(i, i + 10).map((Key) => s3Client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key }))),
      )
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
}
