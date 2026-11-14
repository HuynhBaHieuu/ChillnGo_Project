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
  /** A friend invited you along on their journey, or accepted your invite. From the API. */
  | 'invite'
  | 'invite_accepted'
  /** Your content was hidden or removed, or your account locked, after reports. From the API. */
  | 'moderation'
  /** Something you reported has been looked at. From the API. */
  | 'report_resolved'
  /** A payment went through, or Premium is about to run out. From the API. */
  | 'billing'
  /** An admin approved, rejected or hid your business page. From the API. */
  | 'business'

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
  permissions?: ('users' | 'content' | 'reports' | 'categories' | 'stats' | 'businesses' | 'revenue' | 'news')[]
  /** Premium right now: shows the crown badge. Sent by the API; absent on mock users. */
  isPremium?: boolean
  /** Only on your own account: when Premium ends. */
  premiumUntil?: ISODate | null
  createdAt: ISODate
}

/* -------------------------------------------------------------- TripPost */

/**
 * How a traveller reached a stop from the one before it, and the only thing
 * that decides how the map draws that leg: the first three follow real roads,
 * `flight` and `ferry` are dashed arcs. See lib/travel.ts.
 */
export type TravelMode = 'driving' | 'walking' | 'transit' | 'flight' | 'ferry'

/**
 * A road leg's route as drawn when the journey was saved, so viewers need no
 * Directions call. `key` names the leg it was drawn for (`legKey`); a leg that
 * no longer matches it is drawn afresh.
 */
export interface LegRoute {
  key: string
  /** Mapbox polyline6. */
  polyline: string
  /** Seconds, as Mapbox Directions estimated. */
  duration: number
  /** Metres along the road. */
  distance: number
}

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
  /** How this stop was reached from the previous one in its day. Absent on older stops: driving (`modeOf`). */
  travelMode?: TravelMode
  /** Place categories from search (e.g. "airport"), which `suggestMode` reads. */
  placeTypes?: string[]
  /** The road route into this stop, cached when the journey was saved. */
  legRoute?: LegRoute
  /** The place this stop is, when it was picked from ChillnGo's place data (AI clone, seed journeys). */
  placeId?: string
  /** Arrival time ("HH:mm") and stay, planned by AI clone. */
  startTime?: string
  durationMin?: number
  /** No cost data: `estCost` is 0 for want of one, not because the stop is free. */
  costUnknown?: boolean
  /** The nearest open place of the same kind, saved from an AI draft. */
  planB?: { name: string; address: string; placeId?: string; lat: number | null; lng: number | null; distanceKm: number; reason: string }
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

/** A friend the author invited along on a journey: 'pending' until they accept. */
export interface TripCompanion {
  userId: ObjectId
  status: 'pending' | 'accepted'
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
  /**
   * Who came along: those who accepted, plus the pending invites the viewer may
   * see (all of them for the author, their own for an invitee). From the API;
   * absent on sample journeys, which cannot have companions.
   */
  companions?: TripCompanion[]
  status: PostStatus
  /** Only for the author: their journey was hidden by moderation. From the API. */
  moderation?: ModerationInfo | null
  createdAt: ISODate
  updatedAt: ISODate
  /** When it was published (from the API; sample journeys go by `createdAt`). */
  publishedAt?: ISODate | null
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
  /** Hidden by the journey's author: only the writer and the author still see it. From the API. */
  hidden?: boolean
  /** Hidden by moderation after reports: only its writer still sees it (and is told so). From the API. */
  moderated?: boolean
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

/* ---------------------------------------------------- Reports, moderation */

/** Set only for the author, on their own journey or check-in hidden by moderation. */
export interface ModerationInfo {
  hidden: true
  /** "remove": also taken down for good (it cannot be restored). */
  action: 'hide' | 'remove'
  reason: string
}

export type ReportTargetType = 'post' | 'comment' | 'checkin' | 'user' | 'business' | 'businessPost' | 'news'
export type ReportReason = 'spam' | 'inappropriate' | 'scam' | 'misinformation' | 'harassment' | 'other'
export type ReportStatus = 'pending' | 'resolved' | 'dismissed'
export type ReportAction = 'none' | 'hide' | 'remove' | 'lock'
export type ResolveAction = 'dismiss' | 'hide' | 'remove' | 'lock'

export interface ReportInput {
  targetType: ReportTargetType
  targetId: ObjectId
  reason: ReportReason
  note?: string
}

export interface ReportPerson {
  _id: ObjectId
  username: string
  displayName: string
  avatarUrl: string
  status: 'active' | 'locked'
  role: 'user' | 'admin' | 'superadmin'
}

export interface ReportSnapshot {
  title: string
  text: string
  imageUrl: string
  /** The journey a comment is on. */
  postId: ObjectId | null
}

/** The reported content as it is now; it may be gone. */
export interface ReportTargetState {
  exists: boolean
  visible: boolean
  hidden: boolean
  action: string | null
  /** A moderator's id, or "system" for the automatic hide. */
  hiddenBy: string | null
}

/** One row of the moderation queue: every report about one piece of content. */
export interface ReportGroup {
  targetType: ReportTargetType
  targetId: ObjectId
  count: number
  reasons: Record<ReportReason, number>
  lastReportedAt: ISODate
  resolvedAt: ISODate | null
  action: ReportAction
  resolvedBy: ReportPerson | null
  snapshot: ReportSnapshot
  owner: ReportPerson | null
  target: ReportTargetState
}

export interface ReportEntry {
  _id: ObjectId
  reporter: ReportPerson | null
  reason: ReportReason
  note: string
  status: ReportStatus
  action: ReportAction
  createdAt: ISODate
  resolvedAt: ISODate | null
  resolvedBy: ReportPerson | null
  resolutionNote: string
}

export interface ReportTargetDetail extends ReportTargetState {
  targetType: ReportTargetType
  targetId: ObjectId
  snapshot: ReportSnapshot
  owner: ReportPerson | null
  pendingCount: number
  reasons: Record<ReportReason, number>
  allowedActions: ResolveAction[]
}

/* ------------------------------------------------------- ClonedItinerary */

/** A journey an itinerary was cloned from, and who wrote it, for the attribution. */
export interface ItinerarySource {
  postId: ObjectId
  title: string
  author: Pick<User, '_id' | 'username' | 'displayName'> | null
}

export interface ClonedItinerary {
  _id: ObjectId
  ownerId: ObjectId
  /** Every post this itinerary has pulled days from, in merge order. The first is the one it was cloned from. */
  sourcePostIds: ObjectId[]
  /** Copied as-is, adapted by AI, or merged by AI. Absent on older ones: copied. */
  cloneType?: 'manual' | 'ai' | 'merge'
  /** The journeys in `sourcePostIds` with their authors, filled in by `getItineraryById`. */
  sources?: ItinerarySource[]
  /** The preparation checklist made for its AI draft. */
  checklist?: AiChecklist | null
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
  companions?: (TripCompanion & { user: User })[]
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

/* ------------------------------------------------------------- AI clone */

export type AiPace = 'relaxed' | 'moderate' | 'packed'

/** The AI clone form (server/src/ai/schemas.ts). */
export interface AiCloneForm {
  startDate: DateOnly
  days: number
  groupSize: number
  withChildren: boolean
  withElderly: boolean
  /** Whole trip, whole group, VND. Null: no budget. */
  budget: number | null
  departure: string
  /** Place categories, from `AiCloneOptions.interests`. */
  interests: string[]
  pace: AiPace
}

export interface AiCloneOptions {
  /** Null when ChillnGo has no place data for where this journey goes. */
  destination: string | null
  interests: { value: string; label: string }[]
  /** The destination's season data, as entered; empty lists say nothing. */
  season: { rainyMonths: number[]; peakMonths: number[]; festivals: { name: string; month: number }[] } | null
  /** Other journeys at the same destination an AI merge can take in. */
  mergeable: { postId: ObjectId; title: string; days: number; author: string | null }[]
  sourceDays: number
  callsLeft: number
  dailyLimit: number
}

/** What the destination's season data says about the trip's months. */
export interface AiSeason {
  months: number[]
  rainy: boolean
  peak: boolean
  festivals: { name: string; month: number }[]
}

export interface AiChecklist {
  groups: { group: string; items: { id: string; text: string }[] }[]
  /** False when it is in template order (no AI request left, or the AI failed). */
  sortedByAi: boolean
}

export type AiChangeType = 'keep' | 'replace' | 'add' | 'remove'
export type AiChangeStatus = 'pending' | 'accepted' | 'reverted'

/** A place as ChillnGo's data knows it. Null: no data. */
export interface AiPlace {
  name: string
  address: string
  lat: number | null
  lng: number | null
  category: string | null
  avgCost: number | null
  priceLevel: number | null
  openingHours: { open: string; close: string } | null
  isOutdoor: boolean | null
  requiresBooking: boolean | null
  rating: number | null
  photoUrl: string | null
  valueScore: number
  inSource: boolean
  /** For the whole group, VND. Null: no data. */
  cost: number | null
  /** perPerson: average per person × group; author: as the original journey's author wrote it. */
  costBasis: 'perPerson' | 'author' | null
}

export interface AiDraftStop {
  changeId: string
  type: AiChangeType
  status: AiChangeStatus
  startTime: string
  endTime: string
  durationMin: number
  reason: string
  place: AiPlace
  /** For a replace: the stop it replaces. */
  original: AiPlace | null
  /** The nearest place of the same kind that is free and open then; null when none. */
  planB: { place: AiPlace; distanceKm: number; reason: string } | null
}

export interface AiDraft {
  _id: ObjectId
  sources: ItinerarySource[]
  destination: string | null
  formInput: AiCloneForm
  days: {
    dayIndex: number
    date: DateOnly
    cost: { total: number; missing: number }
    stops: AiDraftStop[]
  }[]
  /** Stops the AI took out, and additions you turned down. */
  notInPlan: { changeId: string; type: AiChangeType; status: AiChangeStatus; reason: string; place: AiPlace }[]
  cost: { total: number; missing: number; budget: number | null; overBudget: boolean }
  warnings: string[]
  season: AiSeason | null
  checklist: AiChecklist | null
  pendingCount: number
  chat: { role: 'user' | 'assistant'; content: string; at: ISODate }[]
  /** Set once saved to "Đã sao chép". */
  committedItineraryId: ObjectId | null
  expiresAt: ISODate
  callsLeft: number
  dailyLimit: number
}

/* ------------------------------------------------------- Billing (PayOS) */

export type ProductId = 'premium_month' | 'premium_year' | 'business_boost_month'

export interface Product {
  id: ProductId
  kind: 'premium' | 'boost'
  name: string
  days: number
  /** VND. */
  amount: number
}

export interface PlanBenefits {
  aiDailyLimit: number
  liveQuality: string
  replayDays: number
}

/** GET /api/billing/plans */
export interface Plans {
  paymentsEnabled: boolean
  products: Product[]
  benefits: { free: PlanBenefits; premium: PlanBenefits }
  current: { isPremium: boolean; premiumUntil: ISODate | null } | null
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired'

export interface Order {
  _id: ObjectId
  orderCode: number
  product: ProductId
  productName: string
  businessId: ObjectId | null
  amount: number
  days: number
  status: OrderStatus
  /** The PayOS page, while the order can still be paid. */
  checkoutUrl: string
  createdAt: ISODate
  paidAt: ISODate | null
  grantedUntil: ISODate | null
}

/* ------------------------------------------------------------ Businesses */

export type BusinessType = 'homestay' | 'hotel' | 'restaurant' | 'cafe' | 'tour'
export type BusinessStatus = 'pending' | 'approved' | 'rejected' | 'hidden'

export interface Business {
  _id: ObjectId
  ownerId: ObjectId
  slug: string
  name: string
  type: BusinessType
  description: string
  address: string
  city: string
  lat: number | null
  lng: number | null
  phone: string
  website: string
  photos: string[]
  priceFrom: number | null
  priceTo: number | null
  openingHours: string
  /** In "Gợi ý nổi bật" now. */
  sponsored: boolean
  createdAt: ISODate
  /** Owner (and admin) only. */
  status?: BusinessStatus
  statusReason?: string
  promotedUntil?: ISODate | null
  moderation?: ModerationInfo | null
}

export interface BusinessAd {
  _id: ObjectId
  businessId: ObjectId
  title: string
  content: string
  photos: string[]
  offer: string
  createdAt: ISODate
  updatedAt: ISODate
  moderation?: ModerationInfo | null
}

export type BusinessInput = Pick<
  Business,
  'name' | 'type' | 'description' | 'address' | 'city' | 'lat' | 'lng' | 'phone' | 'website' | 'photos' | 'priceFrom' | 'priceTo' | 'openingHours'
>

export type BusinessAdInput = Pick<BusinessAd, 'title' | 'content' | 'photos' | 'offer'>

/* ------------------------------------------------------------------ News */

export type NewsSourceType = 'rss' | 'google_news' | 'youtube_channel' | 'social'
export type SocialPlatform = 'twitter' | 'reddit' | 'youtube' | 'facebook' | 'instagram' | 'xiaohongshu' | 'bilibili'
export type NewsStatus = 'queued' | 'pending' | 'published' | 'rejected' | 'hidden'

/**
 * A travel news post: written by the AI from an outside source's article
 * (server/src/lib/news), shown with the original's pictures.
 */
export interface NewsItem {
  _id: ObjectId
  sourceId: ObjectId
  sourceName: string
  sourceType: NewsSourceType
  platform: SocialPlatform | null
  /** The original article, linked at the end of the post. */
  url: string
  /** The AI's Vietnamese headline, or the source's own title. */
  title: string
  /** AI summary in Vietnamese, or the source's own excerpt. */
  summary: string
  /** The cover picture. */
  imageUrl: string
  /** Every picture of the post, the cover first. */
  images: string[]
  /** The post's paragraphs. Only on the post's own page and in admin views. */
  content?: string[]
  /** The source's own title. Only on the post's own page and in admin views. */
  originalTitle?: string
  /** Where the post's destinations are, for the map. Only on the post's own page. */
  places?: { name: string; lat: number; lng: number }[]
  kind: 'article' | 'video' | 'post'
  author: string
  publishedAt: ISODate
  pinned: boolean
  regions: Region[]
  destinations: string[]
  savedByMe?: boolean
  /** Admin views only. */
  status?: NewsStatus
  statusReason?: string
  /** The headline as stored ('' when the AI has not written one). */
  headline?: string
  /** When the AI last wrote the post; null when it never did. */
  writtenAt?: ISODate | null
  excerpt?: string
  aiSummary?: string
  aiStatus?: 'pending' | 'done' | 'skipped' | 'failed'
  clickCount?: number
  createdAt?: ISODate
}

export interface NewsSource {
  _id: ObjectId
  name: string
  type: NewsSourceType
  url: string
  query: string
  platform: SocialPlatform | null
  includeKeywords: string[]
  excludeKeywords: string[]
  defaultRegion: Region | null
  enabled: boolean
  autoPublish: boolean
  intervalMinutes: number
  lastRunAt: ISODate | null
  lastStatus: 'ok' | 'error' | null
  lastError: string
  lastNewCount: number
  createdAt: ISODate
  counts?: Partial<Record<NewsStatus, number>>
}

export type NewsSourceInput = Omit<NewsSource, '_id' | 'lastRunAt' | 'lastStatus' | 'lastError' | 'lastNewCount' | 'createdAt' | 'counts'>

export interface NewsRun {
  _id: ObjectId
  sourceId: ObjectId
  sourceName: string
  trigger: 'schedule' | 'manual' | 'worker'
  fetched: number
  created: number
  duplicates: number
  filtered: number
  error: string
  durationMs: number
  createdAt: ISODate
}
