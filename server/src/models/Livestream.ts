import { Schema, model } from 'mongoose'

/** The reactions viewers can send. The web app has the matching emoji list. */
export const REACTIONS = ['heart', 'fire', 'clap', 'wow', 'haha'] as const
export type Reaction = (typeof REACTIONS)[number]

export const AUDIENCES = ['public', 'followers', 'private'] as const

/**
 * A livestream session. Created already live (no scheduling yet) and ended by
 * the host, or by the server once the host has been gone for a while.
 * Provider credentials never live here; only the room name.
 */
const livestreamSchema = new Schema(
  {
    hostId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    /**
     * "public": anyone. "followers": the host's followers. "private": only the
     * host (a private test run). Applies to the replay too.
     */
    audience: { type: String, enum: AUDIENCES, default: 'public' },
    status: { type: String, enum: ['live', 'ended'], default: 'live', index: true },
    /** LiveKit room, "live_<id>". */
    roomName: { type: String, required: true, unique: true },
    startedAt: { type: Date, default: () => new Date() },
    endedAt: { type: Date, default: null },
    /** host: pressed End. host_left: disconnected and did not come back. */
    endedReason: { type: String, enum: ['host', 'host_left', null], default: null },
    /** Last time the server saw the host connected; drives the "host left" timeout. */
    hostSeenAt: { type: Date, default: () => new Date() },
    viewerCount: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    /** Different signed-in people who watched at some point. */
    uniqueViewers: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    reactions: {
      heart: { type: Number, default: 0 },
      fire: { type: Number, default: 0 },
      clap: { type: Number, default: 0 },
      wow: { type: Number, default: 0 },
      haha: { type: Number, default: 0 },
    },
    /** Viewers the host removed. They cannot rejoin or comment. */
    blockedUserIds: { type: [String], default: [] },
    /**
     * The recording, when the host asked for one. "recording" while live,
     * "processing" until the file is uploaded, then "ready" or "failed".
     * `key` is the file's path in the (private) bucket; viewers get signed links.
     */
    recording: {
      status: { type: String, enum: ['none', 'recording', 'processing', 'ready', 'failed'], default: 'none' },
      egressId: { type: String, default: null },
      key: { type: String, default: null },
      durationSec: { type: Number, default: 0 },
    },
    /** The replay's cover picture, chosen by the host once the replay is ready. Empty: none chosen. */
    thumbnailUrl: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false },
)

// One live stream per host at a time, enforced by the database itself.
livestreamSchema.index({ hostId: 1 }, { unique: true, partialFilterExpression: { status: 'live' }, name: 'one_live_per_host' })
livestreamSchema.index({ status: 1, startedAt: -1 })
livestreamSchema.index({ hostId: 1, status: 1, startedAt: -1 })

export const Livestream = model('Livestream', livestreamSchema)
export type LivestreamDocument = InstanceType<typeof Livestream>

const commentSchema = new Schema(
  {
    livestreamId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

export const LivestreamComment = model('LivestreamComment', commentSchema)

/** One row per signed-in person who opened a stream: the "unique viewers" statistic. */
const viewerSchema = new Schema(
  {
    livestreamId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: { createdAt: 'firstSeenAt', updatedAt: false }, versionKey: false },
)

viewerSchema.index({ livestreamId: 1, userId: 1 }, { unique: true })

export const LivestreamViewer = model('LivestreamViewer', viewerSchema)
