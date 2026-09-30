/**
 * Domain types — a 1:1 mirror of the agreed MongoDB collections.
 *
 * These are the single source of truth for the shape of data flowing through
 * the app. The mock fixtures in `src/mocks/*.json` are shaped to satisfy them,
 * and when `server/` exists its responses must satisfy them too. Nothing in
 * `components/` or `features/` should ever declare its own copy of these.
 */

export type ObjectId = string

/** ISO-8601 timestamp, e.g. "2025-03-14T09:00:00.000Z". */
export type ISODate = string

/** Calendar day with no time component, e.g. "2025-03-14". */
export type DateOnly = string

export type BudgetLevel = 'low' | 'medium' | 'high'

export type PostStatus = 'draft' | 'pending' | 'published' | 'rejected'

export type ItineraryStatus = 'planning' | 'confirmed' | 'completed'

export type Region = 'north' | 'central' | 'south' | 'islands' | 'overseas'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'clone'
  | 'bookmark'
  | 'system'
  /** Someone you follow went live. From the API (server/src/models/Notification.ts). */
  | 'live'

/* ------------------------------------------------------------------ User */

export interface User {
  _id: ObjectId
  username: string
  displayName: string
  email: string
  avatarUrl: string
  coverUrl: string
  bio: string
  location: string
  followerCount: number
  followingCount: number
  postCount: number
  role: 'user' | 'admin' | 'superadmin'
  /**
   * Admin modules this account may use. Sent by the API; absent on mock users.
   * See web/src/lib/roles.ts.
   */
  permissions?: ('users' | 'content' | 'reports' | 'categories' | 'stats')[]
  createdAt: ISODate
}

/* -------------------------------------------------------------- TripPost */

/** One stop within a day. `lng`/`lat` feed the map layer. */
export interface TripLocation {
  _id: ObjectId
  name: string
  /** Street address, as entered, pasted from Google Maps or picked. Absent on older stops. */
  address?: string
  note: string
  estCost: number
  photoUrl: string | null
  lng: number
  lat: number
}

export interface TripDay {
  _id: ObjectId
  dayNumber: number
  date: DateOnly
  title: string
  locations: TripLocation[]
  photos: string[]
}

/**
 * Minimal GeoJSON shapes. Kept hand-rolled (rather than pulling in
 * @types/geojson) so the contract with the API stays explicit and narrow.
 */
export interface RouteFeature {
  type: 'Feature'
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  properties: Record<string, unknown>
}

export interface RouteGeoJson {
  type: 'FeatureCollection'
  features: RouteFeature[]
}

export interface TripPost {
  _id: ObjectId
  authorId: ObjectId
  title: string
  summary: string
  coverUrl: string
  /** The author's own photos, up to 10; the first is `coverUrl`. Absent on older journeys. */
  coverImages?: string[]
  region: Region
  season: Season
  startDate: DateOnly
  endDate: DateOnly
  days: TripDay[]
  tags: string[]
  budgetLevel: BudgetLevel
  totalEstCost: number
  routeGeoJson: RouteGeoJson
  likeCount: number
  commentCount: number
  bookmarkCount: number
  cloneCount: number
  status: PostStatus
  createdAt: ISODate
  updatedAt: ISODate
}

/* --------------------------------------------------------------- Comment */

export interface Comment {
  _id: ObjectId
  postId: ObjectId
  authorId: ObjectId
  /** `null` for a root comment; otherwise the `_id` of the parent comment. */
  parentId: ObjectId | null
  content: string
  likeCount: number
  createdAt: ISODate
}

/* ---------------------------------------------------------------- Follow */

export interface Follow {
  _id: ObjectId
  followerId: ObjectId
  followingId: ObjectId
  createdAt: ISODate
}

/* -------------------------------------------------------------- Bookmark */

export interface Bookmark {
  _id: ObjectId
  userId: ObjectId
  postId: ObjectId
  createdAt: ISODate
}

/* ------------------------------------------------------- ClonedItinerary */

export interface ClonedItinerary {
  _id: ObjectId
  ownerId: ObjectId
  /** Every post this itinerary has pulled days from, in merge order. */
  sourcePostIds: ObjectId[]
  title: string
  note: string
  coverUrl: string
  startDate: DateOnly
  days: TripDay[]
  totalEstCost: number
  status: ItineraryStatus
  createdAt: ISODate
  updatedAt: ISODate
}

/* ---------------------------------------------------------- Notification */

export interface Notification {
  _id: ObjectId
  userId: ObjectId
  type: NotificationType
  actorId: ObjectId | null
  postId: ObjectId | null
  /** Set on 'live' notifications. */
  livestreamId?: ObjectId | null
  message: string
  read: boolean
  createdAt: ISODate
}

/* ------------------------------------------------ View models & payloads */

/**
 * A post with its author (and the viewer's like/bookmark state) already
 * resolved. The real API will populate these server-side; the mock service
 * joins the fixtures. Components only ever consume this shape — never a raw
 * `TripPost` plus a separate user lookup.
 */
export interface TripPostWithAuthor extends TripPost {
  author: User
  likedByMe: boolean
  bookmarkedByMe: boolean
}

/** A comment with its author resolved and its direct replies nested. */
export interface CommentThread extends Comment {
  author: User
  replies: CommentThread[]
}

export interface NotificationWithActor extends Notification {
  actor: User | null
}

export interface AuthSession {
  token: string
  user: User
}

export interface Credentials {
  email: string
  password: string
}

export interface RegisterPayload extends Credentials {
  username: string
  displayName: string
}

/**
 * What `POST /api/auth/register` returns. There is no session yet: the account
 * is signed in when the emailed confirmation link is opened.
 */
export interface RegisterResult {
  email: string
  /** False when the account was created but the email could not be sent. */
  emailSent: boolean
}

/** Exactly what `POST /api/posts` will accept. */
export interface TripPostPayload {
  authorId: ObjectId
  title: string
  summary: string
  coverUrl: string
  coverImages: string[]
  region: Region
  season: Season
  startDate: DateOnly
  endDate: DateOnly
  days: TripDay[]
  tags: string[]
  budgetLevel: BudgetLevel
  totalEstCost: number
  routeGeoJson: RouteGeoJson
  status: PostStatus
}

export interface DiscoverFilters {
  region: Region | 'all'
  season: Season | 'all'
  tags: string[]
  budgetLevels: BudgetLevel[]
  /** Inclusive VND range applied to `totalEstCost`. */
  minCost: number
  maxCost: number
  query: string
}

export type ProfileTab = 'posts' | 'saved' | 'cloned' | 'live'

/* ------------------------------------------------------------ Home page */

/** Aggregate numbers shown on the home page stats row. */
export interface LandingStats {
  tripCount: number
  cloneCount: number
  bookmarkCount: number
  stopCount: number
}

/** One stop of a published trip, flattened for the home page coordinate list. */
export interface DestinationRow {
  id: ObjectId
  name: string
  lat: number
  lng: number
  postId: ObjectId
  /** The trip's short title, e.g. "Hà Giang Loop 4N3Đ". */
  tripTitle: string
}

/** A trip photo for the home page gallery, labelled with the trip it came from. */
export interface MomentPhoto {
  url: string
  postId: ObjectId
  /** The trip's short title, e.g. "Hà Giang Loop 4N3Đ". */
  tripTitle: string
}
