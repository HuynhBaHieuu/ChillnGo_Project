/**
 * Every call to LiveKit, the realtime video provider behind livestreams.
 *
 * Nothing outside this file imports livekit-server-sdk, so swapping providers
 * means rewriting this module only. The API secret never leaves the server:
 * browsers get short-lived access tokens with exactly the rights they need.
 *
 *   host     publishes camera + microphone, cannot send data messages
 *   viewer   subscribes only: cannot publish media or data
 *   preview  like a viewer, but hidden: the muted preview on a Newsfeed card,
 *            which nobody sees in the room and which is not counted
 *
 * Comments and reactions are posted through our API (checked, rate-limited,
 * stored) and the server fans them out with sendData, so no browser can
 * speak for anyone else.
 *
 * Identities: the host is their user id. A viewer is "<userId>~<random>", so
 * the same account can watch from two tabs without one kicking the other
 * out; counts group by the part before "~".
 */

import { randomBytes } from 'node:crypto'

import {
  AccessToken,
  DataPacket_Kind,
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  RoomServiceClient,
  S3Upload,
  SegmentedFileOutput,
  SegmentedFileProtocol,
  TrackSource,
  WebhookReceiver,
} from 'livekit-server-sdk'
import type { EgressInfo, WebhookEvent } from 'livekit-server-sdk'

import { env } from '../env.js'
import { HttpError } from './errors.js'

/** Topic of every data message the server sends into a livestream room. */
export const DATA_TOPIC = 'chillngo'

/** Access tokens only need to outlive the connect handshake; LiveKit refreshes them for connected clients. */
const TOKEN_TTL = '10m'

let rooms: RoomServiceClient | null = null
let egress: EgressClient | null = null

function config() {
  if (!env.livekit) {
    throw new HttpError(503, 'Livestream chưa được cấu hình trên máy chủ.', 'LIVE_NOT_CONFIGURED')
  }
  return env.livekit
}

export function isLiveKitConfigured(): boolean {
  return Boolean(env.livekit)
}

/**
 * LiveKit Inference: LiveKit Cloud's model gateway (the one LiveKit Agents use),
 * which also answers plain OpenAI-style chat completions. The AI assistant asks
 * it, billed to this project's inference quota, so it needs no key of its own.
 */
export const INFERENCE_CHAT_URL = 'https://agent-gateway.livekit.cloud/v1/chat/completions'

/** A short-lived token for INFERENCE_CHAT_URL, or null when the project is not on LiveKit Cloud. */
export async function inferenceToken(): Promise<string | null> {
  const livekit = env.livekit
  if (!livekit || !new URL(livekit.url).hostname.endsWith('.livekit.cloud')) return null
  const token = new AccessToken(livekit.apiKey, livekit.apiSecret, { identity: 'chillngo-assistant', ttl: TOKEN_TTL })
  token.addInferenceGrant({ perform: true })
  return token.toJwt()
}

function roomService(): RoomServiceClient {
  const { httpUrl, apiKey, apiSecret } = config()
  rooms ??= new RoomServiceClient(httpUrl, apiKey, apiSecret)
  return rooms
}

function egressService(): EgressClient {
  const { httpUrl, apiKey, apiSecret } = config()
  egress ??= new EgressClient(httpUrl, apiKey, apiSecret)
  return egress
}

/**
 * Creates the room up front, so the host's token cannot be used to create an
 * arbitrary one. LiveKit closes it on its own two minutes after it empties.
 */
export async function createRoom(name: string): Promise<void> {
  try {
    await roomService().createRoom({ name, emptyTimeout: 120, departureTimeout: 20 })
  } catch (error) {
    console.error('LiveKit createRoom failed:', error)
    throw new HttpError(502, 'Không tạo được phòng livestream. Vui lòng thử lại sau.', 'LIVE_PROVIDER_ERROR')
  }
}

interface Person {
  _id: string
  displayName: string
  username: string
  avatarUrl: string
}

export type LiveRole = 'host' | 'viewer' | 'preview'

/** The user id inside a room identity, or null for previews and LiveKit's own recorder. */
export function userIdOf(identity: string): string | null {
  if (identity.startsWith('preview~') || identity.startsWith('EG_')) return null
  return identity.split('~')[0] || null
}

function identityFor(person: Person | null, role: LiveRole): string {
  const suffix = randomBytes(6).toString('hex')
  if (role === 'preview') return `preview~${person?._id ?? 'anon'}~${suffix}`
  if (role === 'viewer') return `${(person as Person)._id}~${suffix}`
  return (person as Person)._id
}

/** The connection details a browser needs: server address and an access token. */
export async function connectionFor(room: string, person: Person | null, role: LiveRole) {
  const { url, apiKey, apiSecret } = config()
  const token = new AccessToken(apiKey, apiSecret, {
    identity: identityFor(person, role),
    name: person?.displayName ?? '',
    metadata: JSON.stringify({ userId: person?._id ?? null, username: person?.username ?? null, avatarUrl: person?.avatarUrl ?? null, role }),
    ttl: TOKEN_TTL,
  })
  token.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: role === 'host',
    canPublishSources: role === 'host' ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    canPublishData: false,
    // Invisible to everyone else in the room, and left out of every count.
    hidden: role === 'preview',
  })
  return { url, token: await token.toJwt(), role }
}

/**
 * Who is in the room right now. `exists` is false once LiveKit has closed it.
 * `viewers` counts people, not tabs, and never previews or the recorder.
 */
export async function roomPresence(room: string, hostId: string) {
  try {
    const participants = await roomService().listParticipants(room)
    const watching = new Set<string>()
    for (const p of participants) {
      const userId = p.permission?.hidden ? null : userIdOf(p.identity)
      if (userId && userId !== hostId) watching.add(userId)
    }
    return {
      exists: true,
      hostPresent: participants.some((p) => p.identity === hostId),
      viewers: watching.size,
    }
  } catch (error) {
    // LiveKit answers "not found" for a room it has already closed.
    if (String((error as Error).message).toLowerCase().includes('not found') || (error as { status?: number }).status === 404) {
      return { exists: false, hostPresent: false, viewers: 0 }
    }
    throw error
  }
}

/** Disconnects every tab `userId` has open in the room. */
export async function removeUser(room: string, userId: string): Promise<void> {
  const participants = await roomService()
    .listParticipants(room)
    .catch(() => [])
  await Promise.all(
    participants
      .filter((p) => userIdOf(p.identity) === userId || p.identity.startsWith(`preview~${userId}~`))
      .map((p) => roomService().removeParticipant(room, p.identity).catch(() => undefined)),
  )
}

/** Sends a JSON message to everyone in the room. Failures are logged, not thrown. */
export async function broadcast(room: string, message: unknown): Promise<void> {
  if (!env.livekit) return
  const data = new TextEncoder().encode(JSON.stringify(message))
  await roomService()
    .sendData(room, data, DataPacket_Kind.RELIABLE, { topic: DATA_TOPIC })
    .catch((error: unknown) => console.error('LiveKit sendData failed:', error))
}

/** Tells everyone the stream is over, then closes the room (disconnecting them). */
export async function closeRoom(room: string): Promise<void> {
  if (!env.livekit) return
  await broadcast(room, { type: 'ended' })
  await roomService()
    .deleteRoom(room)
    .catch(() => undefined) // already gone
}

/* --------------------------------------------------------------- recording */

export function isRecordingConfigured(): boolean {
  return Boolean(env.livekit && env.recording)
}

/** Length of one rewind (HLS) segment: how far behind live the rewound picture can get. */
export const HLS_SEGMENT_SECONDS = 4

/**
 * Starts recording the room. One LiveKit recording, two outputs in the
 * storage bucket:
 *   - an MP4 at `filepath`, uploaded when the recording stops: the replay;
 *   - HLS segments under `hlsPrefix`, uploaded every few seconds while live:
 *     what viewers rewind through during the stream.
 * LiveKit renders the room (the host's camera, full frame) and uploads both
 * itself. Returns the egress id.
 */
export async function startRecording(room: string, filepath: string, hlsPrefix: string): Promise<string> {
  const storage = env.recording
  if (!storage) throw new HttpError(503, 'Chưa cấu hình nơi lưu bản ghi.', 'RECORDING_NOT_CONFIGURED')
  const upload = () =>
    new S3Upload({
      bucket: storage.bucket,
      accessKey: storage.accessKey,
      secret: storage.secret,
      region: storage.region,
      endpoint: storage.endpoint,
      forcePathStyle: Boolean(storage.endpoint),
    })
  const file = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    // No sidecar JSON (EG_….json) next to each file: nothing here reads it.
    disableManifest: true,
    output: { case: 's3', value: upload() },
  })
  const segments = new SegmentedFileOutput({
    protocol: SegmentedFileProtocol.HLS_PROTOCOL,
    disableManifest: true,
    filenamePrefix: `${hlsPrefix}/seg`,
    playlistName: `${hlsPrefix}/playlist.m3u8`,
    segmentDuration: HLS_SEGMENT_SECONDS,
    output: { case: 's3', value: upload() },
  })
  const info = await egressService().startRoomCompositeEgress(
    room,
    { file, segments },
    { layout: 'speaker', encodingOptions: EncodingOptionsPreset.H264_720P_30 },
  )
  return info.egressId
}

export async function stopRecording(egressId: string): Promise<void> {
  await egressService()
    .stopEgress(egressId)
    .catch(() => undefined) // already stopped (e.g. the room closed first)
}

export type RecordingState = { state: 'active' } | { state: 'ready'; durationSec: number } | { state: 'failed' }

export function recordingStateOf(info: EgressInfo): RecordingState {
  switch (info.status) {
    case EgressStatus.EGRESS_COMPLETE:
    case EgressStatus.EGRESS_LIMIT_REACHED: {
      const file = info.fileResults[0]
      if (!file) return { state: 'failed' }
      return { state: 'ready', durationSec: Math.round(Number(file.duration) / 1e9) }
    }
    case EgressStatus.EGRESS_FAILED:
    case EgressStatus.EGRESS_ABORTED:
      return { state: 'failed' }
    default:
      return { state: 'active' }
  }
}

/** Where a recording is at, asked of LiveKit directly (for when no webhook is set up). */
export async function recordingState(egressId: string): Promise<RecordingState | null> {
  const [info] = await egressService()
    .listEgress({ egressId })
    .catch(() => [])
  return info ? recordingStateOf(info) : null
}

/** Checks a LiveKit webhook's signature and returns the event. */
export async function readWebhook(body: string, authorization: string | undefined): Promise<WebhookEvent> {
  const { apiKey, apiSecret } = config()
  return new WebhookReceiver(apiKey, apiSecret).receive(body, authorization)
}
