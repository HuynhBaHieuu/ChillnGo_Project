/**
 * The OpenAPI 3.1 description of the API, served at GET /api/openapi.json
 * (and at /openapi.json on the web app's domain, which proxies it).
 *
 * Every route lives in OPERATIONS below. openapi.test.ts reads the route
 * files and fails when a route is added, renamed or removed without updating
 * this table, so the description cannot quietly drift from the server.
 */

import { API_DOCS_PATH } from './errors.js'

/**
 * Where the production API answers: its own deployment, and the web app's
 * domain, which proxies /api/* to it (web/vercel.json).
 */
export const OPENAPI_SERVERS = ['https://chillgo-project.vercel.app', 'https://chillgo-project-web.vercel.app']

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/**
 * Who may call an operation:
 * - public: anyone
 * - optional: anyone; a valid token adds what that account may also see
 * - user: a signed-in account
 * - staff: an admin with the matching permission
 * - superadmin: the super admin only
 * - webhook: LiveKit (signed Authorization header) or PayOS (signed body)
 * - dvr-link: anyone holding the signed `access` link from GET /api/livestreams/{id}/dvr
 */
type Access = 'public' | 'optional' | 'user' | 'staff' | 'superadmin' | 'webhook' | 'dvr-link'

interface QueryParam {
  name: string
  description: string
  schema: Record<string, unknown>
  required?: boolean
}

interface Operation {
  method: Method
  /** Express syntax, as mounted: /api/posts/:id */
  path: string
  summary: string
  access: Access
  /** A named schema under components.schemas, or `true` for a JSON object not described here. */
  body?: string | true
  query?: QueryParam[]
  /** The request body's media type when it is not JSON. */
  consumes?: string
  /** The success response's media type when it is not JSON. */
  produces?: string
  /** A named schema under components.schemas for the success body. Without one, a JSON object. */
  response?: string
  /** The success status, when it is not 200. */
  status?: 201
}

const AUTHORS_QUERY: QueryParam = {
  name: 'authors',
  description: 'Comma-separated account ids (up to 200) to narrow the list to.',
  schema: { type: 'string', maxLength: 4000 },
}
const BEFORE_QUERY: QueryParam = {
  name: 'before',
  description: "Only items that started before this time. For the next page, pass the previous page's nextBefore.",
  schema: { type: 'string', format: 'date-time' },
}

const OPERATIONS: Operation[] = [
  // Service
  { method: 'get', path: '/api/health', summary: 'Liveness check. Needs no database.', access: 'public', response: 'Health' },
  { method: 'get', path: '/api', summary: 'API index: what this API is, where its docs are, and the public endpoints.', access: 'public', response: 'ApiIndex' },
  { method: 'get', path: API_DOCS_PATH, summary: 'This OpenAPI description.', access: 'public', response: 'OpenApiDocument' },
  {
    method: 'get',
    path: '/api/settings/public',
    summary: 'Site settings every visitor needs: the announcement banner and whether sign-up is open.',
    access: 'public',
    response: 'PublicSettings',
  },

  // Auth
  { method: 'post', path: '/api/auth/register', summary: 'Create an unverified account and email a confirmation link.', access: 'public', body: 'RegisterRequest', response: 'RegisterResponse', status: 201 },
  { method: 'post', path: '/api/auth/login', summary: 'Sign in with email and password. Returns { token, user }.', access: 'public', body: 'LoginRequest', response: 'Session' },
  { method: 'post', path: '/api/auth/google', summary: 'Sign in (or sign up) with a Google ID token credential.', access: 'public', body: 'GoogleLoginRequest', response: 'Session' },
  { method: 'post', path: '/api/auth/verify-email', summary: 'Confirm an email address with the token from the confirmation link.', access: 'public', body: 'VerifyEmailRequest', response: 'Session' },
  { method: 'post', path: '/api/auth/resend-verification', summary: 'Send the confirmation email again.', access: 'public', body: 'ResendVerificationRequest', response: 'Message' },
  { method: 'post', path: '/api/auth/forgot-password', summary: 'Email a password reset link. Always answers 200, whether or not the account exists.', access: 'public', body: 'ResendVerificationRequest', response: 'Message' },
  { method: 'post', path: '/api/auth/reset-password', summary: 'Set a new password with the token from the reset link.', access: 'public', body: 'ResetPasswordRequest', response: 'Message' },
  { method: 'get', path: '/api/auth/me', summary: 'The signed-in account.', access: 'user', response: 'AccountResponse' },

  // Users and profiles
  { method: 'get', path: '/api/users/me/following', summary: 'Accounts the signed-in user follows.', access: 'user' },
  { method: 'get', path: '/api/users/me/friends', summary: 'Mutual follows of the signed-in user.', access: 'user' },
  { method: 'get', path: '/api/users/:id', summary: 'A public profile.', access: 'optional', response: 'ProfileResponse' },
  { method: 'post', path: '/api/users/:id/follow', summary: 'Follow or unfollow an account.', access: 'user' },
  { method: 'post', path: '/api/users/me/upload-signature', summary: 'Signed Cloudinary parameters for uploading a profile image.', access: 'user', body: true },
  { method: 'patch', path: '/api/users/me', summary: 'Update the signed-in profile.', access: 'user', body: true },

  // Journeys (trip posts)
  {
    method: 'get',
    path: '/api/posts',
    summary: 'Published journeys, newest first.',
    access: 'public',
    query: [{ name: 'author', description: 'Only journeys by this account id.', schema: { type: 'string', maxLength: 40 } }],
    response: 'JourneyList',
  },
  {
    method: 'get',
    path: '/api/posts/mine',
    summary: "The signed-in user's journeys.",
    access: 'user',
    query: [{ name: 'status', description: 'Which journeys to list.', schema: { type: 'string', enum: ['draft', 'published', 'all'], default: 'all' } }],
  },
  { method: 'get', path: '/api/posts/deleted', summary: 'Journeys in "Recently Deleted".', access: 'user' },
  { method: 'get', path: '/api/posts/liked-ids', summary: 'Ids of journeys the signed-in user liked.', access: 'user' },
  { method: 'get', path: '/api/posts/:id', summary: 'One journey, day by day and stop by stop.', access: 'optional', response: 'JourneyResponse' },
  { method: 'post', path: '/api/posts/:id/like', summary: 'Like or unlike a journey.', access: 'user' },
  { method: 'get', path: '/api/posts/:id/comments', summary: "A journey's comments.", access: 'optional', response: 'JourneyCommentList' },
  { method: 'post', path: '/api/posts/:id/comments', summary: 'Comment on a journey.', access: 'user', body: true, status: 201 },
  { method: 'delete', path: '/api/posts/:id/comments/:commentId', summary: 'Delete a comment.', access: 'user' },
  { method: 'post', path: '/api/posts/:id/comments/:commentId/hide', summary: "Hide a comment on the author's own journey.", access: 'user', body: true },
  { method: 'post', path: '/api/posts/cover-signature', summary: 'Signed Cloudinary parameters for uploading journey images.', access: 'user' },
  { method: 'post', path: '/api/posts', summary: 'Create a journey (draft).', access: 'user', body: true, status: 201 },
  { method: 'patch', path: '/api/posts/:id', summary: 'Update a journey.', access: 'user', body: true },
  { method: 'post', path: '/api/posts/:id/publish', summary: 'Publish a draft journey.', access: 'user' },
  { method: 'post', path: '/api/posts/:id/duplicate', summary: 'Copy a journey into a new draft.', access: 'user', status: 201 },
  { method: 'delete', path: '/api/posts/:id', summary: 'Move a journey to "Recently Deleted".', access: 'user' },
  { method: 'post', path: '/api/posts/:id/restore', summary: 'Restore a journey from "Recently Deleted".', access: 'user' },
  { method: 'delete', path: '/api/posts/:id/permanent', summary: 'Delete a journey for good.', access: 'user' },
  { method: 'post', path: '/api/posts/:id/companions', summary: 'Invite travel companions to a journey.', access: 'user', body: true },
  { method: 'post', path: '/api/posts/:id/companions/respond', summary: 'Accept or decline a companion invite.', access: 'user', body: true },
  { method: 'delete', path: '/api/posts/:id/companions/:userId', summary: 'Remove a companion, withdraw an invite, or leave.', access: 'user' },

  // AI clone
  { method: 'get', path: '/api/posts/:id/ai-clone', summary: 'The AI clone draft of a journey for the signed-in user, if any.', access: 'user' },
  { method: 'post', path: '/api/posts/:id/ai-clone', summary: 'Start an AI-assisted copy of a journey.', access: 'user', body: true, status: 201 },
  { method: 'post', path: '/api/posts/ai-merge', summary: 'Merge several journeys into one AI draft.', access: 'user', body: true, status: 201 },
  { method: 'get', path: '/api/ai-drafts/:draftId', summary: 'An AI draft.', access: 'user' },
  { method: 'post', path: '/api/ai-drafts/:draftId/chat', summary: 'Ask the AI to change a draft.', access: 'user', body: true },
  { method: 'patch', path: '/api/ai-drafts/:draftId/changes/:changeId', summary: 'Accept or reject one proposed change.', access: 'user', body: true },
  { method: 'post', path: '/api/ai-drafts/:draftId/accept-all', summary: 'Accept every pending change.', access: 'user' },
  { method: 'post', path: '/api/ai-drafts/:draftId/optimize-route', summary: "Reorder each day's stops for a shorter route.", access: 'user', body: true },
  { method: 'get', path: '/api/ai-drafts/:draftId/plan-b', summary: 'Alternative stops for bad weather or closures.', access: 'user' },
  { method: 'post', path: '/api/ai-drafts/:draftId/checklist', summary: 'A packing and preparation checklist for the draft.', access: 'user' },
  { method: 'post', path: '/api/ai-drafts/:draftId/commit', summary: 'Save the draft as an itinerary.', access: 'user', body: true, status: 201 },

  // Itineraries
  { method: 'get', path: '/api/itineraries', summary: "The signed-in user's itineraries.", access: 'user' },
  { method: 'get', path: '/api/itineraries/:id', summary: 'One itinerary.', access: 'user' },
  { method: 'post', path: '/api/itineraries', summary: 'Clone a journey into a new itinerary.', access: 'user', body: true, status: 201 },
  { method: 'patch', path: '/api/itineraries/:id', summary: 'Edit an itinerary: name, note, start date, status, days and stops.', access: 'user', body: true },
  { method: 'patch', path: '/api/itineraries/:id/days', summary: "Reorder or edit an itinerary's days.", access: 'user', body: true },
  { method: 'post', path: '/api/itineraries/:id/merge', summary: 'Add days from another journey.', access: 'user', body: true },
  { method: 'delete', path: '/api/itineraries/:id/days/:dayId', summary: 'Remove a day from an itinerary.', access: 'user' },

  // Check-ins
  {
    method: 'get',
    path: '/api/checkins',
    summary: 'Check-ins, newest first.',
    access: 'public',
    query: [
      { name: 'authors', description: 'Comma-separated account ids (up to 200) to narrow the list to.', schema: { type: 'string', maxLength: 4000 } },
      { name: 'before', description: 'Only check-ins created before this time (for paging).', schema: { type: 'string', format: 'date-time' } },
    ],
    response: 'CheckInList',
  },
  { method: 'post', path: '/api/checkins/upload-signature', summary: 'Signed Cloudinary parameters for a check-in photo.', access: 'user' },
  { method: 'post', path: '/api/checkins', summary: 'Post a check-in.', access: 'user', body: true, status: 201 },
  { method: 'get', path: '/api/checkins/deleted', summary: 'Check-ins in "Recently Deleted".', access: 'user' },
  { method: 'delete', path: '/api/checkins/:id', summary: 'Move a check-in to "Recently Deleted".', access: 'user' },
  { method: 'post', path: '/api/checkins/:id/restore', summary: 'Restore a check-in.', access: 'user' },
  { method: 'delete', path: '/api/checkins/:id/permanent', summary: 'Delete a check-in for good.', access: 'user' },

  // Livestreams
  { method: 'get', path: '/api/livestreams/config', summary: 'Whether live video and recording are configured.', access: 'public', response: 'LivestreamConfig' },
  {
    method: 'get',
    path: '/api/livestreams',
    summary: 'Streams live now, newest first (up to 20).',
    access: 'optional',
    query: [AUTHORS_QUERY],
    response: 'LivestreamList',
  },
  {
    method: 'get',
    path: '/api/livestreams/history',
    summary: "One host's ended streams, newest first, 12 at a time.",
    access: 'optional',
    query: [
      { name: 'host', description: 'The host account id.', schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' }, required: true },
      BEFORE_QUERY,
    ],
    response: 'LivestreamPage',
  },
  {
    method: 'get',
    path: '/api/livestreams/replays',
    summary: 'Recorded streams that can be replayed, newest first, 12 at a time.',
    access: 'optional',
    query: [AUTHORS_QUERY, BEFORE_QUERY],
    response: 'LivestreamPage',
  },
  { method: 'post', path: '/api/livestreams', summary: 'Start a livestream.', access: 'user', body: true, status: 201 },
  { method: 'get', path: '/api/livestreams/:id', summary: 'One livestream.', access: 'optional', response: 'LivestreamResponse' },
  { method: 'post', path: '/api/livestreams/:id/connection', summary: 'A LiveKit token to join the room.', access: 'user' },
  { method: 'post', path: '/api/livestreams/:id/preview', summary: 'A short muted preview connection.', access: 'optional' },
  { method: 'get', path: '/api/livestreams/:id/dvr', summary: 'The rewind playlist address, with a signed access link.', access: 'user' },
  {
    method: 'get',
    path: '/api/livestreams/:id/dvr.m3u8',
    summary: 'The rewind HLS playlist.',
    access: 'dvr-link',
    produces: 'application/vnd.apple.mpegurl',
    query: [{ name: 'access', description: 'The signed access value from GET /api/livestreams/{id}/dvr.', schema: { type: 'string' }, required: true }],
  },
  { method: 'post', path: '/api/livestreams/:id/end', summary: 'End a livestream (host only).', access: 'user' },
  {
    method: 'get',
    path: '/api/livestreams/:id/comments',
    summary: "A livestream's latest comments, oldest first.",
    access: 'optional',
    query: [{ name: 'limit', description: 'How many comments.', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }],
    response: 'LivestreamCommentList',
  },
  { method: 'post', path: '/api/livestreams/:id/comments', summary: 'Comment on a livestream.', access: 'user', body: true, status: 201 },
  { method: 'delete', path: '/api/livestreams/:id/comments/:commentId', summary: 'Delete a livestream comment.', access: 'user' },
  { method: 'post', path: '/api/livestreams/:id/reactions', summary: 'Send a reaction.', access: 'user', body: true },
  { method: 'post', path: '/api/livestreams/:id/block', summary: 'Remove a viewer from the stream (host only).', access: 'user', body: true },
  { method: 'post', path: '/api/livestreams/:id/thumbnail-signature', summary: 'Signed Cloudinary parameters for a stream thumbnail.', access: 'user' },
  { method: 'put', path: '/api/livestreams/:id/thumbnail', summary: "Use the thumbnail image just uploaded.", access: 'user' },
  { method: 'delete', path: '/api/livestreams/:id/thumbnail', summary: "Remove the stream's thumbnail.", access: 'user' },
  { method: 'post', path: '/api/livestreams/webhook', summary: 'LiveKit room and recording events. Not for clients.', access: 'webhook', body: true, consumes: 'application/webhook+json' },

  // Notifications, activity, geo, assistant
  { method: 'get', path: '/api/notifications', summary: "The signed-in user's notifications.", access: 'user' },
  { method: 'post', path: '/api/notifications/read', summary: 'Mark every notification as read.', access: 'user' },
  { method: 'get', path: '/api/activity/search-history', summary: 'Recent searches.', access: 'user' },
  { method: 'post', path: '/api/activity/search-history', summary: 'Record a search.', access: 'user', body: 'SearchHistoryRequest', status: 201 },
  { method: 'delete', path: '/api/activity/search-history/:id', summary: 'Forget one search.', access: 'user' },
  { method: 'delete', path: '/api/activity/search-history', summary: 'Forget every search.', access: 'user' },
  { method: 'get', path: '/api/activity/account-history', summary: 'Sign-ins and account changes.', access: 'user' },
  { method: 'get', path: '/api/activity/live-comments', summary: "The user's livestream comments.", access: 'user' },
  { method: 'get', path: '/api/activity/journey-comments', summary: "The user's journey comments.", access: 'user' },
  {
    method: 'get',
    path: '/api/geo/resolve-maps-link',
    summary: 'Expand a shortened Google Maps link.',
    access: 'user',
    query: [{ name: 'url', description: 'The shared Google Maps link.', schema: { type: 'string', format: 'uri' }, required: true }],
  },
  { method: 'post', path: '/api/assistant/chat', summary: 'Ask the site assistant a question.', access: 'user', body: true },

  // Reports
  { method: 'post', path: '/api/reports', summary: 'Report a journey, comment, check-in, account, business page or business ad: { targetType, targetId, reason, note? }.', access: 'user', body: true, status: 201 },

  // Billing (PayOS)
  { method: 'get', path: '/api/billing/plans', summary: 'Prices, what Free and Premium give, and your current Premium.', access: 'optional', response: 'PlansResponse' },
  { method: 'post', path: '/api/billing/checkout', summary: 'Start buying a plan: { product, businessId? } → an order with its PayOS checkout link.', access: 'user', body: true, status: 201 },
  { method: 'get', path: '/api/billing/orders', summary: 'Your orders, newest first.', access: 'user' },
  { method: 'get', path: '/api/billing/orders/:orderCode', summary: 'One of your orders; a pending one is checked with PayOS first.', access: 'user' },
  { method: 'post', path: '/api/billing/payos-webhook', summary: 'PayOS payment events.', access: 'webhook', body: true },

  // Businesses
  { method: 'get', path: '/api/businesses/sponsored', summary: 'Sponsored businesses and their latest ads for Discover.', access: 'public', response: 'SponsoredResponse' },
  { method: 'get', path: '/api/businesses/me', summary: 'Your business page (any status) and its ads.', access: 'user' },
  { method: 'post', path: '/api/businesses', summary: 'Register a business page; it waits for an admin.', access: 'user', body: true, status: 201 },
  { method: 'patch', path: '/api/businesses/me', summary: 'Edit your business page.', access: 'user', body: true },
  { method: 'post', path: '/api/businesses/me/posts', summary: 'Write an ad on your business page.', access: 'user', body: true, status: 201 },
  { method: 'patch', path: '/api/businesses/me/posts/:postId', summary: 'Edit one of your ads.', access: 'user', body: true },
  { method: 'delete', path: '/api/businesses/me/posts/:postId', summary: 'Delete one of your ads.', access: 'user' },
  { method: 'get', path: '/api/businesses/:slug', summary: 'A business page and its ads.', access: 'optional', response: 'BusinessPageResponse' },

  // Admin
  { method: 'get', path: '/api/admin/stats', summary: 'Dashboard counts.', access: 'staff' },
  { method: 'get', path: '/api/admin/users', summary: 'Search and page through accounts.', access: 'staff' },
  { method: 'post', path: '/api/admin/users/:id/lock', summary: 'Lock an account.', access: 'staff', body: true },
  { method: 'post', path: '/api/admin/users/:id/unlock', summary: 'Unlock an account.', access: 'staff' },
  { method: 'post', path: '/api/admin/users/:id/reset-password', summary: 'Email the account a password reset.', access: 'staff' },
  { method: 'post', path: '/api/admin/admins', summary: 'Create an admin account.', access: 'superadmin', body: true, status: 201 },
  { method: 'patch', path: '/api/admin/users/:id/role', summary: "Change an account's role.", access: 'superadmin', body: true },
  { method: 'patch', path: '/api/admin/admins/:id/permissions', summary: "Change an admin's permissions.", access: 'superadmin', body: true },
  { method: 'get', path: '/api/admin/reports', summary: 'Reports grouped by the content they are about.', access: 'staff' },
  { method: 'get', path: '/api/admin/reports/target/:targetType/:targetId', summary: 'Every report about one piece of content.', access: 'staff' },
  { method: 'post', path: '/api/admin/reports/target/:targetType/:targetId/resolve', summary: 'Decide every pending report about one piece of content: dismiss, hide, remove or lock.', access: 'staff', body: true },
  { method: 'post', path: '/api/admin/moderation/:targetType/:targetId/unhide', summary: 'Show content hidden by moderation again.', access: 'staff' },
  { method: 'get', path: '/api/admin/businesses', summary: 'Business pages to review.', access: 'staff' },
  { method: 'post', path: '/api/admin/businesses/:id/review', summary: 'Approve, reject, hide or restore a business page: { action, reason }.', access: 'staff', body: true },
  { method: 'get', path: '/api/admin/orders', summary: 'Orders and the revenue summary.', access: 'staff' },
  { method: 'get', path: '/api/admin/audit-logs', summary: 'The admin audit log.', access: 'superadmin' },
  { method: 'get', path: '/api/admin/settings', summary: 'Site settings.', access: 'superadmin' },
  { method: 'put', path: '/api/admin/settings', summary: 'Change site settings.', access: 'superadmin', body: true },
]

/** The developer portal and CLI, on the web app's domain. */
export const DEVELOPER_PORTAL_URL = 'https://chillgo-project-web.vercel.app/developers'

/** The body of GET /api: a starting point for an agent or developer that found the API. */
export function apiIndex() {
  return {
    name: 'ChillnGo API',
    description:
      'Public JSON REST API of ChillnGo, a Vietnamese travel social network of real multi-day trip journeys.',
    version: '0.1.0',
    docs: {
      openapi: API_DOCS_PATH,
      portal: DEVELOPER_PORTAL_URL,
      cli: `${DEVELOPER_PORTAL_URL}/cli`,
    },
    authentication:
      'Public GET endpoints need no credentials. Others need "Authorization: Bearer <token>" from POST /api/auth/login.',
    publicEndpoints: OPERATIONS.filter((op) => op.access === 'public' || op.access === 'optional')
      .filter((op) => op.method === 'get')
      .map((op) => ({ method: 'GET', path: toOpenApiPath(op.path), summary: op.summary })),
  }
}

/** method + Express path of every operation, for the drift test. */
export function documentedRoutes(): string[] {
  return OPERATIONS.map((op) => `${op.method.toUpperCase()} ${op.path}`)
}

/** /api/posts/:id → /api/posts/{id} */
function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z]+)/g, '{$1}')
}

function pathParams(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1])
}

const ACCESS_TEXT: Record<Access, string> = {
  public: 'No sign-in needed.',
  optional: 'No sign-in needed; with a token, also shows what that account may see.',
  user: 'Needs a signed-in account.',
  staff: 'Needs an admin account with the matching permission.',
  superadmin: 'Needs the super admin account.',
  webhook: 'Called by LiveKit (signed Authorization header) or PayOS (HMAC signature in the body). Not for clients.',
  'dvr-link': 'Authenticated by the signed `access` query value.',
}

const TAGS: Record<string, string> = {
  health: 'Service',
  'openapi.json': 'Service',
  settings: 'Service',
  auth: 'Auth',
  users: 'Users',
  posts: 'Journeys',
  'ai-drafts': 'AI clone',
  itineraries: 'Itineraries',
  checkins: 'Check-ins',
  livestreams: 'Livestreams',
  notifications: 'Notifications',
  activity: 'Activity',
  geo: 'Geo',
  assistant: 'Assistant',
  admin: 'Admin',
}

function tagOf(op: Operation): string {
  if (op.path === '/api') return 'Service'
  if (op.path.includes('/ai-clone') || op.path.endsWith('/ai-merge')) return 'AI clone'
  return TAGS[op.path.split('/')[2]] ?? 'Other'
}

function operationId(op: Operation): string {
  const words = op.path
    .replace(/^\/api\//, '')
    .split(/[/.-]/)
    .filter(Boolean)
    .map((part) => (part.startsWith(':') ? `By${part[1].toUpperCase()}${part.slice(2)}` : part))
  return op.method + words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
}

const PATH_PARAM_TEXT: Record<string, string> = {
  id: 'The id of the resource the path names (journey, account, itinerary, check-in or livestream).',
  commentId: 'The comment id.',
  userId: 'The account id.',
  draftId: 'The AI draft id.',
  changeId: 'The id of one proposed change in the draft.',
  dayId: 'The id of one day of the itinerary.',
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
})

function buildOperation(op: Operation) {
  const signedIn = op.access === 'user' || op.access === 'staff' || op.access === 'superadmin'
  const security =
    signedIn ? [{ bearerAuth: [] }] : op.access === 'optional' ? [{}, { bearerAuth: [] }] : []

  const parameters = [
    ...pathParams(op.path).map((name) => ({
      name,
      in: 'path',
      required: true,
      description: PATH_PARAM_TEXT[name] ?? `The ${name}.`,
      schema: { type: 'string', minLength: 1, maxLength: 64 },
    })),
    ...(op.query ?? []).map((q) => ({
      name: q.name,
      in: 'query',
      required: q.required ?? false,
      description: q.description,
      schema: q.schema,
    })),
  ]

  const successSchema = op.produces
    ? { type: 'string', description: `A ${op.produces} document.` }
    : op.response
      ? { $ref: `#/components/schemas/${op.response}` }
      : { type: 'object', additionalProperties: true, description: 'JSON object; see the summary for what it holds.' }
  const responses: Record<string, unknown> = {
    [String(op.status ?? 200)]: {
      description: op.status === 201 ? 'Created.' : 'Success.',
      content: { [op.produces ?? 'application/json']: { schema: successSchema } },
    },
  }
  if (op.body || op.query || pathParams(op.path).length > 0) {
    responses['400'] = errorResponse('The request failed validation (VALIDATION_FAILED, INVALID_JSON).')
  }
  if (signedIn || op.access === 'webhook' || op.access === 'dvr-link') {
    responses['401'] = errorResponse('Missing, invalid or expired credentials.')
  }
  if (op.access === 'staff' || op.access === 'superadmin') {
    responses['403'] = errorResponse('The account lacks the permission.')
  }
  if (pathParams(op.path).length > 0) responses['404'] = errorResponse('No such resource, or not one this caller may see.')
  responses.default = errorResponse('Any error. Every error body has the Error shape.')

  return {
    operationId: operationId(op),
    summary: op.summary,
    description: `${op.summary} ${ACCESS_TEXT[op.access]}`,
    tags: [tagOf(op)],
    security,
    ...(parameters.length > 0 && { parameters }),
    ...(op.body && {
      requestBody: {
        required: true,
        content: {
          [op.consumes ?? 'application/json']: {
            schema:
              op.body === true
                ? { type: 'object', additionalProperties: true, description: 'JSON object; the server validates its fields.' }
                : { $ref: `#/components/schemas/${op.body}` },
          },
        },
      },
    }),
    responses,
  }
}

const str = (description?: string) => ({ type: 'string', ...(description && { description }) })
const int = (description?: string) => ({ type: 'integer', ...(description && { description }) })
const time = (description?: string) => ({ type: 'string', format: 'date-time', ...(description && { description }) })
const orNull = (schema: Record<string, unknown>) => ({ ...schema, type: [schema.type, 'null'] })
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const list = (item: string, extra: Record<string, unknown> = {}) => ({
  type: 'object',
  required: ['items', ...Object.keys(extra)],
  properties: { items: { type: 'array', items: ref(item) }, ...extra },
})
const authorsList = { type: 'array', items: ref('PublicUser'), description: 'Public profiles of the accounts the items mention.' }
const nextBefore = orNull(time('Pass as `before` for the next page; null on the last page.'))

/** Success bodies. Fields are listed as the server sends them; clients should ignore fields they do not know. */
const RESPONSE_SCHEMAS: Record<string, Record<string, unknown>> = {
  Health: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean', const: true } } },
  Message: { type: 'object', required: ['message'], properties: { message: str('What happened, in Vietnamese, for people.') } },
  OpenApiDocument: { type: 'object', required: ['openapi', 'info', 'paths'], description: 'An OpenAPI 3.1 document.' },
  ApiIndex: {
    type: 'object',
    required: ['name', 'version', 'docs', 'publicEndpoints'],
    properties: {
      name: str(),
      description: str(),
      version: str(),
      docs: {
        type: 'object',
        properties: { openapi: str('Path of this OpenAPI description.'), portal: str('Developer portal URL.'), cli: str('CLI docs URL.') },
      },
      authentication: str(),
      publicEndpoints: {
        type: 'array',
        items: {
          type: 'object',
          required: ['method', 'path', 'summary'],
          properties: { method: { type: 'string', enum: ['GET'] }, path: str(), summary: str() },
        },
      },
    },
  },
  PublicSettings: {
    type: 'object',
    required: ['settings'],
    properties: {
      settings: {
        type: 'object',
        required: ['registrationOpen', 'announcement'],
        properties: {
          registrationOpen: { type: 'boolean', description: 'Whether new accounts can sign up.' },
          announcement: str('Site-wide banner text; empty for none.'),
        },
      },
    },
  },
  PublicUser: {
    type: 'object',
    description: 'A public profile. `email` is always empty for accounts other than your own.',
    required: ['_id', 'username', 'displayName'],
    properties: {
      _id: str('Account id.'),
      username: str(),
      displayName: str(),
      email: str(),
      avatarUrl: str(),
      coverUrl: str(),
      bio: str(),
      location: str(),
      followerCount: int(),
      followingCount: int(),
      postCount: int('Published journeys.'),
      role: { type: 'string', enum: ['user', 'admin', 'superadmin'] },
      createdAt: time(),
    },
  },
  Account: {
    allOf: [
      ref('PublicUser'),
      {
        type: 'object',
        properties: { permissions: { type: 'array', items: str(), description: 'Admin permissions; empty for members.' } },
      },
    ],
  },
  Session: {
    type: 'object',
    required: ['token', 'user'],
    properties: { token: str('JWT; send as `Authorization: Bearer <token>`.'), user: ref('Account') },
  },
  AccountResponse: { type: 'object', required: ['user'], properties: { user: ref('Account') } },
  RegisterResponse: {
    type: 'object',
    required: ['email', 'emailSent'],
    properties: { email: str(), emailSent: { type: 'boolean', description: 'Whether the confirmation email went out.' } },
  },
  ProfileResponse: {
    type: 'object',
    required: ['user', 'followedByMe'],
    properties: { user: ref('PublicUser'), followedByMe: { type: 'boolean' } },
  },
  Stop: {
    type: 'object',
    description: 'One stop of a day.',
    required: ['name'],
    properties: {
      _id: str(),
      name: str(),
      address: str(),
      lat: { type: 'number' },
      lng: { type: 'number' },
      placeId: orNull(str()),
      note: str(),
      estCost: int('Estimated cost in VND.'),
      photoUrl: orNull(str()),
    },
  },
  Day: {
    type: 'object',
    required: ['dayNumber', 'locations'],
    properties: {
      _id: str(),
      dayNumber: int(),
      date: str('YYYY-MM-DD.'),
      title: str(),
      photos: { type: 'array', items: str() },
      locations: { type: 'array', items: ref('Stop') },
    },
  },
  Journey: {
    type: 'object',
    description: 'A trip post: a multi-day itinerary as it was actually travelled.',
    required: ['_id', 'authorId', 'title', 'days', 'status'],
    properties: {
      _id: str(),
      authorId: str(),
      title: str(),
      summary: str(),
      coverUrl: str(),
      coverImages: { type: 'array', items: str() },
      region: { type: 'string', description: 'north, central, south, islands or overseas.' },
      season: str(),
      startDate: str('YYYY-MM-DD.'),
      endDate: str('YYYY-MM-DD.'),
      days: { type: 'array', items: ref('Day') },
      tags: { type: 'array', items: str() },
      budgetLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
      totalEstCost: int('Estimated total in VND.'),
      routeGeoJson: { type: 'object', description: 'GeoJSON FeatureCollection of the route.' },
      likeCount: int(),
      commentCount: int(),
      bookmarkCount: int(),
      cloneCount: int(),
      companions: { type: 'array', items: { type: 'object' } },
      status: { type: 'string', enum: ['draft', 'published'] },
      createdAt: time(),
      updatedAt: time(),
      deletedAt: orNull(time()),
      purgeAt: orNull(time()),
    },
  },
  JourneyList: list('Journey', { authors: authorsList }),
  JourneyResponse: {
    type: 'object',
    required: ['post', 'authors'],
    properties: { post: ref('Journey'), authors: authorsList, likedByMe: { type: 'boolean' } },
  },
  JourneyComment: {
    type: 'object',
    required: ['_id', 'postId', 'authorId', 'content', 'createdAt'],
    properties: {
      _id: str(),
      postId: str(),
      authorId: str(),
      parentId: orNull(str('The comment this replies to.')),
      content: str(),
      likeCount: int(),
      hidden: { type: 'boolean' },
      createdAt: time(),
    },
  },
  JourneyCommentList: list('JourneyComment', { authors: authorsList }),
  Author: {
    type: 'object',
    required: ['_id', 'username', 'displayName'],
    properties: { _id: str(), username: str(), displayName: str(), avatarUrl: str(), isPremium: { type: 'boolean', description: 'Shows the Premium badge.' } },
  },
  CheckIn: {
    type: 'object',
    required: ['_id', 'caption', 'createdAt', 'author'],
    properties: {
      _id: str(),
      caption: str(),
      feeling: orNull(str()),
      photos: {
        type: 'array',
        items: { type: 'object', required: ['url'], properties: { url: str(), width: int(), height: int() } },
      },
      location: {
        type: ['object', 'null'],
        properties: { name: str(), address: str(), lat: { type: 'number' }, lng: { type: 'number' } },
      },
      createdAt: time(),
      deletedAt: orNull(time()),
      purgeAt: orNull(time()),
      author: ref('Author'),
    },
  },
  CheckInList: list('CheckIn'),
  LivestreamConfig: {
    type: 'object',
    required: ['live', 'recording', 'quality'],
    properties: {
      live: { type: 'boolean' },
      recording: { type: 'boolean' },
      quality: str('Video the caller may publish: 720p, or 1080p for Premium.'),
    },
  },
  Livestream: {
    type: 'object',
    required: ['_id', 'title', 'status', 'startedAt', 'host'],
    properties: {
      _id: str(),
      title: str(),
      description: str(),
      audience: { type: 'string', enum: ['public', 'followers', 'private'], description: 'Who may watch.' },
      status: { type: 'string', enum: ['live', 'ended'] },
      startedAt: time(),
      endedAt: orNull(time()),
      durationSec: int(),
      viewerCount: int(),
      peakViewers: int(),
      uniqueViewers: int(),
      commentCount: int(),
      reactions: {
        type: 'object',
        properties: { heart: int(), fire: int(), clap: int(), wow: int(), haha: int() },
      },
      dvr: { type: 'boolean', description: 'Viewers can rewind the live stream.' },
      recording: {
        type: 'object',
        properties: {
          status: str('none, recording, processing, ready or failed.'),
          url: orNull(str('Signed replay link, when ready.')),
          durationSec: int(),
          expiresAt: orNull(time('When the replay is deleted: 30 days after it is ready, 365 for a Premium host.')),
          expired: { type: 'boolean', description: 'The replay was kept its full time and deleted.' },
        },
      },
      thumbnailUrl: str(),
      host: ref('Author'),
    },
  },
  LivestreamList: list('Livestream'),
  LivestreamPage: list('Livestream', { nextBefore }),
  LivestreamResponse: {
    type: 'object',
    required: ['livestream'],
    properties: { livestream: ref('Livestream'), blocked: { type: 'boolean', description: 'The host removed you from this stream.' } },
  },
  LivestreamComment: {
    type: 'object',
    required: ['_id', 'text', 'createdAt', 'author'],
    properties: { _id: str(), text: str(), createdAt: time(), author: ref('Author') },
  },
  LivestreamCommentList: list('LivestreamComment'),
  Product: {
    type: 'object',
    required: ['id', 'kind', 'name', 'days', 'amount'],
    properties: {
      id: { type: 'string', enum: ['premium_month', 'premium_year', 'business_boost_month'] },
      kind: { type: 'string', enum: ['premium', 'boost'] },
      name: str(),
      days: int(),
      amount: int('VND.'),
    },
  },
  PlanBenefits: {
    type: 'object',
    required: ['aiDailyLimit', 'liveQuality', 'replayDays'],
    properties: { aiDailyLimit: int('AI requests per day.'), liveQuality: str('720p or 1080p.'), replayDays: int('Days a replay is kept.') },
  },
  PlansResponse: {
    type: 'object',
    required: ['paymentsEnabled', 'products', 'benefits', 'current'],
    properties: {
      paymentsEnabled: { type: 'boolean', description: 'False when the server has no PayOS keys.' },
      products: { type: 'array', items: ref('Product') },
      benefits: {
        type: 'object',
        required: ['free', 'premium'],
        properties: { free: ref('PlanBenefits'), premium: ref('PlanBenefits') },
      },
      current: {
        type: ['object', 'null'],
        description: 'Your Premium, when signed in.',
        properties: { isPremium: { type: 'boolean' }, premiumUntil: orNull(time()) },
      },
    },
  },
  Business: {
    type: 'object',
    required: ['_id', 'slug', 'name', 'type', 'address', 'phone', 'photos', 'sponsored'],
    properties: {
      _id: str(),
      ownerId: str(),
      slug: str(),
      name: str(),
      type: { type: 'string', enum: ['homestay', 'hotel', 'restaurant', 'cafe', 'tour'] },
      description: str(),
      address: str(),
      city: str(),
      lat: orNull({ type: 'number' }),
      lng: orNull({ type: 'number' }),
      phone: str(),
      website: str(),
      photos: { type: 'array', items: str() },
      priceFrom: orNull(int('VND.')),
      priceTo: orNull(int('VND.')),
      openingHours: str(),
      sponsored: { type: 'boolean', description: 'Shown in "Gợi ý nổi bật" now.' },
      createdAt: time(),
    },
  },
  BusinessAd: {
    type: 'object',
    required: ['_id', 'businessId', 'title', 'content', 'photos', 'offer', 'createdAt'],
    properties: {
      _id: str(),
      businessId: str(),
      title: str(),
      content: str(),
      photos: { type: 'array', items: str() },
      offer: str(),
      createdAt: time(),
      updatedAt: time(),
    },
  },
  SponsoredResponse: {
    type: 'object',
    required: ['businesses', 'posts'],
    properties: {
      businesses: { type: 'array', items: ref('Business') },
      posts: {
        type: 'array',
        items: { allOf: [ref('BusinessAd'), { type: 'object', required: ['business'], properties: { business: ref('Business') } }] },
      },
    },
  },
  BusinessPageResponse: {
    type: 'object',
    required: ['business', 'posts'],
    properties: { business: ref('Business'), posts: { type: 'array', items: ref('BusinessAd') } },
  },
}

/** The OpenAPI 3.1 document. `servers` lists where the API can be reached. */
export function buildOpenApi(servers: string[] = []) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const op of OPERATIONS) {
    const key = toOpenApiPath(op.path)
    paths[key] ??= {}
    paths[key][op.method] = buildOperation(op)
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'ChillnGo API',
      version: '0.1.0',
      summary: 'Travel social network: multi-day trip journeys, check-ins, livestreams and itinerary cloning.',
      description:
        'JSON over HTTPS. Sign in with POST /api/auth/login and send the returned token as ' +
        '`Authorization: Bearer <token>`. Every error response is JSON with `message` (Vietnamese, ' +
        'for people), `code` (stable identifier), `status`, `hint` (what to do) and `docs`. ' +
        'Rate-limited routes answer 429 with RateLimit headers (IETF draft 8).',
    },
    servers: servers.map((url) => ({ url })),
    tags: [...new Set(OPERATIONS.map(tagOf))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['message', 'code', 'status', 'hint', 'docs'],
          properties: {
            message: { type: 'string', description: 'Human-readable, in Vietnamese; shown in the UI as-is.' },
            code: { type: 'string', description: 'Stable identifier, e.g. NOT_FOUND, VALIDATION_FAILED, EMAIL_NOT_VERIFIED.' },
            status: { type: 'integer', description: 'The HTTP status.' },
            hint: { type: 'string', description: 'What the client can do about it.' },
            docs: { type: 'string', description: 'Path of this OpenAPI description.' },
            issues: {
              type: 'array',
              description: 'Field-level problems, for VALIDATION_FAILED.',
              items: {
                type: 'object',
                required: ['path', 'message'],
                properties: { path: { type: 'string' }, message: { type: 'string' } },
              },
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['displayName', 'username', 'email', 'password'],
          properties: {
            displayName: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
        GoogleLoginRequest: {
          type: 'object',
          required: ['credential'],
          properties: { credential: { type: 'string', maxLength: 4096, description: 'Google Identity Services ID token.' } },
        },
        VerifyEmailRequest: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string', maxLength: 200 } },
        },
        ResendVerificationRequest: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string', maxLength: 200 },
            password: { type: 'string', format: 'password' },
          },
        },
        SearchHistoryRequest: {
          type: 'object',
          required: ['type', 'query'],
          properties: {
            type: { type: 'string', enum: ['user', 'place', 'post', 'journey'] },
            query: { type: 'string', minLength: 1, maxLength: 120 },
          },
        },
        ...RESPONSE_SCHEMAS,
      },
    },
  }
}
