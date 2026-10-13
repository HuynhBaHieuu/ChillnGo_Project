# ChillnGo — Server

Node.js + Express + MongoDB (Atlas) API for ChillnGo.

**Done:** authentication (register with email verification, login, Sign in with Google), and the
back office for accounts: roles, admin permissions, locking, audit log, system settings.
**Not started:** everything else. The web client still serves posts, follows,
comments and itineraries from mock JSON in `web/src/services/`.

## Running it locally

1. Create a free MongoDB Atlas cluster (see [Setting up Atlas](#setting-up-mongodb-atlas)).
2. Configure and start the API:

   ```bash
   cp .env.example .env    # then fill in MONGODB_URI and JWT_SECRET
   npm install
   npm run seed            # optional, see below
   npm run dev             # http://localhost:4000
   ```

3. Start the web client in another terminal (`cd ../web && npm run dev`). Vite
   forwards every `/api` request to port 4000, so no CORS setup is needed locally.

| Script | What it does |
| --- | --- |
| `npm run dev` | Runs `src/index.ts` with reload on save. |
| `npm run seed` | Creates or updates the six demo accounts from `web/src/mocks/users.json`. They are already email-verified and all get the password `chillngo` (override with `SEED_PASSWORD`). `admin@chillngo.vn` is the admin. |
| `npm run seed:superadmin` | Creates the Super Admin from `SUPERADMIN_*` in `.env`. Changes no other account; safe to re-run. See [Super Admin and admins](#super-admin-and-admins). |
| `npm run typecheck` | Type-checks without emitting. |
| `npm run build` / `npm start` | Compiles to `dist/` and runs it, for hosts other than Vercel. |

Seeding keeps each demo account's fixture id (`u_001`, ...). The mock posts in
the web app are authored by those ids, so logging in as `minh@chillngo.vn`
shows Minh's trips.

## Environment

| Variable | Required | Meaning |
| --- | --- | --- |
| `MONGODB_URI` | yes | Atlas connection string, including the database name (`.../chillngo?...`). |
| `JWT_SECRET` | yes | At least 32 random characters. Changing it logs everyone out. |
| `JWT_EXPIRES_IN` | no | Login lifetime, default `7d`. |
| `CORS_ORIGIN` | no | Comma-separated web origins allowed to call the API. Default `http://localhost:5173`. |
| `PORT` | no | Local port, default `4000`. Ignored on Vercel. |
| `APP_URL` | on Vercel | The web app's address. Verification links open `APP_URL/verify-email`. Default `http://localhost:5173`. |
| `SMTP_USER`, `SMTP_PASS` | on Vercel | Mail account that sends verification emails. Blank in local dev prints the link in the terminal instead. See [Sending email](#sending-email). |
| `SMTP_HOST`, `SMTP_PORT` | no | Default `smtp.gmail.com` and `465`. |
| `MAIL_FROM` | no | Sender shown in the inbox. Default `ChillnGo <SMTP_USER>`. |
| `CLOUDINARY_URL` | no | Cloudinary "API environment variable" (`cloudinary://KEY:SECRET@CLOUD`), for profile images. Unset: image changes answer `503`, text fields still save. |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | no | LiveKit project for livestreams. Unset: livestream routes answer `503` and the Newsfeed shows no live cards. See [Livestream](#livestream). |
| `RECORDING_S3_*` | no | Private S3-compatible bucket (B2, R2, S3) for livestream recordings. Unset: no recording option. See [Livestream](#livestream). |
| `GOOGLE_CLIENT_ID` | no | OAuth client ID for Sign in with Google. Unset makes `/api/auth/google` answer `503`. See [Sign in with Google](#sign-in-with-google). |
| `ASSISTANT_MODEL` | no | Model the AI travel assistant (`POST /api/assistant/chat`) asks through LiveKit Inference, as `provider/model`. Default `google/gemini-2.5-flash`. The assistant needs no key of its own: it uses the `LIVEKIT_*` keys and works only with a LiveKit Cloud project, billed to its inference quota. |

The server refuses to start if a required variable is missing.

## API

All bodies are JSON. Every error response is `{ "message": "..." }`, in
Vietnamese, ready to show in the UI. Errors the client handles specially also
carry a `code`, such as `EMAIL_NOT_VERIFIED` or `INVALID_VERIFY_TOKEN`.

| Route | Body | Success |
| --- | --- | --- |
| `POST /api/auth/register` | `displayName`, `username`, `email`, `password` | `201 { email, emailSent }`. No session: the account is unverified. |
| `POST /api/auth/verify-email` | `token` from the emailed link | `200 { token, user }`. Marks the email verified and signs in. |
| `POST /api/auth/resend-verification` | `email` | `200 { message }` when a new email went out. Otherwise `404 NO_ACCOUNT`, `409 ALREADY_VERIFIED`, or `429 RESEND_COOLDOWN` within a minute of the last send. |
| `POST /api/auth/google` | `credential`, the ID token from Google's button | `200 { token, user }`. Creates or links the account. |
| `POST /api/auth/login` | `email`, `password` | `200 { token, user }`, or `403` with `code: EMAIL_NOT_VERIFIED`. |
| `POST /api/users/me/upload-signature` | `kind`: `avatar` or `cover` | `200 { uploadUrl, fields }`: post the file plus `fields` straight to Cloudinary. |
| `PATCH /api/users/me` | any of `displayName`, `username`, `bio`, `location`, `avatar`/`cover` (`"uploaded"` or `"remove"`) | `200 { user }` |
| `GET /api/checkins?authors=a,b&before=ISO` | none | `200 { items }`: newest 20 photo check-ins with authors. Public. |
| `POST /api/checkins/upload-signature` | none | `200 { publicId, uploadUrl, fields }`: one per photo. |
| `POST /api/checkins` | `caption`, `photos` (0–4 publicIds), `feeling` (key from `src/lib/feelings.ts`) or null, `location` (`name`, `address`, `lat`, `lng`) or null. Needs photos, a feeling or a caption. | `201 { checkin }` |
| `DELETE /api/checkins/:id` | none | `200`. Author only; also deletes the photos from Cloudinary. |
| `POST /api/assistant/chat` | `messages`: up to 20 `{ role: "user" \| "assistant", content }`, ending with the user's question | `200`, the reply streamed as plain text. The model opens each reply with an intent tag (`<<g:explain>>` …), which the server strips and sends as the `X-Assistant-Intent` header (`greet`, `explain`, `agree`, `disagree`, `uncertain`, `celebrate`, `thanks`; absent when the model gave none); the web app's robot gestures by it. Signed in; 10 questions a minute per user. `503 ASSISTANT_OFF` without a LiveKit Cloud project, `429 ASSISTANT_BUSY` when the inference quota is used up, `503 ASSISTANT_UNAVAILABLE` for other gateway errors (the reason is in the server log). Nothing is stored. |
| `GET /api/settings/public` | none | `200 { settings }`: announcement and whether registration is open. |
| `GET /api/auth/me` | none; header `Authorization: Bearer <token>` | `200 { user }` |
| `GET /api/health` | none | `200 { ok: true }` |

Admin routes, under `/api/admin`, need a staff account; the permission is in brackets:

| Route | Who |
| --- | --- |
| `GET /stats` | [stats] |
| `GET /users?q&role&status&page` | [users]; admins only see role `user` |
| `POST /users/:id/lock` `{ reason }`, `POST /users/:id/unlock` | [users]. Locking bans the account: sign-in is refused, the stream it is hosting ends, and it leaves other accounts' follower / following counts. Unlocking puts the counts back. Accounts are never deleted. |
| `POST /users/:id/reset-password` | [users] |
| `PATCH /users/:id/role` `{ role, permissions? }` | Super Admin |
| `POST /admins` `{ displayName, username, email, password, permissions }` | Super Admin |
| `PATCH /admins/:id/permissions` `{ permissions }` | Super Admin |
| `GET /audit-logs?q&action&page` | Super Admin |
| `GET /settings`, `PUT /settings` | Super Admin |

`user` has exactly the `User` shape from `web/src/services/types.ts`. The
password hash is never returned.

Rules enforced by the API:

- **Username:** 3 to 30 characters, lowercase letters without accents, digits,
  `.` or `_`. It is lowercased before saving.
- **Email:** lowercased before saving, so login is case-insensitive.
- **Password:** 6 to 72 characters, with at least one uppercase letter and one
  special character (anything that is not a letter, digit or space). Stored as a
  bcrypt hash. Login does not re-check these rules, so older accounts still work.
- **Email verification:** login is refused until the emailed link is opened. The
  link is valid for 24 hours and works once. Only a SHA-256 hash of its token is
  stored. A resend replaces the previous link and is allowed once a minute.
- **Google accounts:** the first Google sign-in links to an existing account with
  the same email, and marks that email verified, or creates a new account. A new
  account gets a username from the email and has no password. A password login
  on it returns `401` with code `USE_GOOGLE`.
- **Duplicates:** a taken email or username returns `409`.
- **Wrong login:** a wrong email and a wrong password get the same `401` message
  and take the same time, so the API does not reveal which emails exist.
- **Brute force:** 20 failed attempts per IP per 15 minutes, then `429`. On
  Vercel this counter is per function instance, so it is not a hard global limit.
- **Recently Deleted:** a deleted journey or check-in can be restored for 30
  days. After that, a restore returns `410` with code `RESTORE_EXPIRED` and the
  item is deleted for good.
- **Locked accounts:** every signed-in route, including the
  notifications the apps poll, answers `401`, which signs the app out.

## Super Admin and admins

Three roles. The server checks them on every request, reading the role and
lock status fresh from the database, so a change applies immediately.

| | Super Admin | Admin | User |
| --- | --- | --- | --- |
| Create, lock, delete, demote Admins; set their permissions | yes | no | no |
| Promote a user to Admin | yes | no | no |
| Lock, unlock, reset password of regular users | yes | with the `users` module | no |
| Delete any account except the Super Admin | yes | no | no |
| Statistics | everything | regular users only, with `stats` | no |
| Audit log, system settings | yes | no | no |

Nobody can lock, delete or re-role the Super Admin through the API, and
nobody can act on their own account. Admin modules are `users`, `content`,
`reports`, `categories` and `stats`. The `content`, `reports` and `categories`
modules exist in the permission model, but their screens wait for posts,
reports and categories to move from mock JSON into MongoDB.

**Creating the Super Admin.** `npm run seed:superadmin` (from `server/` or the
project root) creates the account from `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`,
`SUPERADMIN_NAME` and `SUPERADMIN_USERNAME`. It deletes and changes no other
account. Run it again to restore that account: if the email already exists, its
role, password and active status are reset. Without a password, a random one is
generated and printed once.

**Locking** blocks sign-in with the reason the admin gave, and the next API call
from an open session gets `401 ACCOUNT_LOCKED`, which signs the web app out.
**Resetting a password** emails the owner a random temporary password; the
admin never sees it. Every admin action is written to the `auditlogs`
collection.

**System settings** (Super Admin): close registration, which blocks email sign-up
and first-time Google sign-up, and set a site-wide announcement.

## Profile images (Cloudinary)

1. Create a free account at <https://cloudinary.com>. On the dashboard, copy the
   **API environment variable**, which looks like `cloudinary://123:abc@my-cloud`.
2. Put it in `server/.env` as `CLOUDINARY_URL=...`. The server restarts on its own.

How an image change works:

1. The page asks `POST /api/users/me/upload-signature` for a signed upload.
2. The browser sends the file straight to Cloudinary. The image never passes
   through our API, so Vercel's 4.5 MB request limit does not apply. The API
   secret stays on the server.
3. `PATCH /api/users/me` with `avatar: "uploaded"`. The server looks the image
   up on Cloudinary itself, checks it is under 10 MB, and stores its URL. A client
   cannot point a profile at an arbitrary URL.

**Accepted formats:** JPG, PNG, WebP and AVIF only, checked in the browser
(`web/src/lib/images.ts`) and again by Cloudinary (`allowed_formats` in the
signed upload). GIF (heavy animations), HEIC (most browsers cannot show it;
iPhones send JPEG instead), SVG (can carry scripts) and BMP/TIFF are refused.

**Size:** the browser accepts originals up to 15 MB, then shrinks them before
upload (longest side 1024 px for avatars, 2560 px for covers, re-encoded as
WebP, or JPEG on Safari). A typical phone photo leaves the browser at a few
hundred KB. Cloudinary also caps what it stores at those sizes, even for
uploads made without our web page.

**Check-in photos** go to `chillngo/checkins/<userId>/<random>`, one per photo,
never overwritten. The server only accepts ids from the poster's own folder that
exist on Cloudinary, and deletes them with the check-in.

Each user has one image per kind, at `chillngo/users/<userId>/avatar` and
`.../cover`. A new upload overwrites the old one, so nothing piles up. The stored
URL carries the version number and a crop: 400×400 for avatars, 1800×600 for
covers, format and quality chosen per browser.

## Livestream

Video goes through **LiveKit**, a WebRTC service with a media server in the
middle, so one host can reach many viewers reliably. This API never carries
video; it only:

- creates the LiveKit room and hands out short-lived (10 min) access tokens.
  The host's token can publish camera and microphone; viewers can only watch.
  Nobody can publish data messages. A viewer's identity is `<userId>~<random>`,
  so one account can watch from several tabs; counts group by person.
- stores the stream in `livestreams`, its comments in `livestreamcomments` and
  one row per person who watched in `livestreamviewers` (the "unique viewers"
  statistic).
- takes comments (1–300 characters, 8 per 20 s per user) and reactions
  (`heart`, `fire`, `clap`, `wow`, `haha`; taps bundled up to 10 per request, 20
  requests per 10 s per user) through the API, stores them, then sends them to
  everyone in the room itself. The author always comes from the login.
- lets the host moderate: delete any comment, or block a viewer (disconnected
  at once, cannot rejoin, comment, react or preview; their comments go).
- keeps the LIVE status honest. On every list or read it asks LiveKit who is in
  the room: a stream whose room is gone, or whose host has been away for more
  than 45 s (closed tab, lost connection), is ended automatically. A page
  refresh within that window resumes the same stream. The same check updates
  the viewer count and the peak (open live pages ask every 15 s).
- tells the host's followers when a public or followers-only stream starts
  (a `live` notification).
- issues **preview** tokens for the muted picture on Newsfeed cards: hidden in
  the room, watch-only, never counted as a viewer. Anyone may ask for a public
  stream's preview (30 per minute per address).

**Audience.** `public` (anyone), `followers` (the host's followers) or
`private` (only the host, for a test run). It applies to the list, the page,
tokens, previews, comments, the replay and the history.

**Setup.** Create a free project at <https://cloud.livekit.io>, then copy the
WebSocket URL, API key and secret from *Settings > Keys* into
`LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`. The web app needs
no key: it receives the URL with each token.

**Optional webhook.** In LiveKit, point a webhook at
`https://<api>/api/livestreams/webhook`. Streams then end the moment LiveKit
closes their room, the peak viewer count updates as people join, and
recordings show up as soon as they are uploaded, instead of on the next
request. Signatures are checked with the same API key.

**Recording (optional).** LiveKit can record a stream to an MP4 and upload it
to any S3-compatible bucket; the host ticks "Lưu lại buổi phát" before going
live and the replay plays on the stream's page afterwards. The bucket stays
**private**: `GET /api/livestreams/:id` hands each viewer the stream's audience
allows a signed link valid for 6 hours, so a followers-only or private replay
cannot be opened by guessing its address.

Backblaze B2 works without a credit card (10 GB free; private buckets need no
payment details):

1. Sign up at <https://www.backblaze.com/sign-up/cloud-storage>.
2. *Buckets > Create a Bucket*: name `chillngo-recordings`, **Private**. Note the
   bucket's *Endpoint*, e.g. `s3.us-east-005.backblazeb2.com`.
3. *Application Keys > Add a New Application Key*: access to that bucket only,
   *Read and Write*. Copy the *keyID* and *applicationKey* (shown once).

| Variable | Backblaze B2 | Cloudflare R2 |
| --- | --- | --- |
| `RECORDING_S3_BUCKET` | `chillngo-recordings` | the bucket name |
| `RECORDING_S3_ACCESS_KEY` | keyID | R2 token's Access Key ID |
| `RECORDING_S3_SECRET` | applicationKey | R2 token's Secret Access Key |
| `RECORDING_S3_ENDPOINT` | `https://s3.us-east-005.backblazeb2.com` | `https://<account-id>.r2.cloudflarestorage.com` |
| `RECORDING_S3_REGION` | `us-east-005` (the part of the endpoint after `s3.`) | `auto` |

For AWS S3 leave the endpoint blank and use the bucket's region. Files are
stored as `livestreams/<streamId>.mp4`. The storage keys go to LiveKit with
each recording request and never to the database or browsers. Without these
variables the option is simply not offered. Recording uses LiveKit egress
minutes (check your plan's allowance), and B2's free daily download
allowance counts each chunk a video player fetches.

**Rewind while live.** The same recording also uploads the stream as HLS
segments (4 s each) under `livestreams/<streamId>-hls/` while it is live.
Viewers of a recorded stream get a timeline under the video: dragging it back
switches their player from the real-time WebRTC picture to those segments
(`hls.js`, loaded on first use); "Trực tiếp" switches back. The playlist goes
through `GET /api/livestreams/:id/dvr.m3u8`, which re-checks the audience on
every reload and signs each segment; its `access` token is signed with a key
derived from `JWT_SECRET`, so it can never be used as a sign-in token (nor
the other way round). Once the replay MP4 is ready, the segments are deleted.
The bucket needs a CORS rule allowing `GET`/`HEAD` from the web app's origin
(the player fetches segments with JavaScript), for example on B2 via the S3
API: `AllowedOrigins ["*"]`, `AllowedMethods ["GET","HEAD"]`,
`AllowedHeaders ["*"]`. The bucket stays private: every request still needs a
signed link.

**Local testing without an account.** Download `livekit-server` from
<https://github.com/livekit/livekit/releases>, run `livekit-server --dev`, and
use `LIVEKIT_URL=ws://127.0.0.1:7880`, key `devkey`, secret `secret`.
Recording needs LiveKit's separate egress service, which `--dev` does not
include.

| Route | Who | Result |
| --- | --- | --- |
| `GET /api/livestreams?authors=a,b` | anyone | streams live now that you may watch |
| `GET /api/livestreams/config` | anyone | `{ live, recording }`: what this server offers |
| `GET /api/livestreams/history?host=id&before=iso` | anyone | a host's ended streams you may see, with stats, 12 per page |
| `GET /api/livestreams/replays?authors=a,b&before=iso` | anyone | recorded ended streams you may watch again (ready or processing), 12 per page |
| `POST /api/livestreams` `{ title, description, audience, record }` | signed in | `201 { livestream, connection }`; `409 ALREADY_LIVE` if you are already live |
| `GET /api/livestreams/:id` | anyone who may see it | `{ livestream, blocked }` (live or ended, with stats and replay) |
| `POST /api/livestreams/:id/connection` | signed in | `{ connection: { url, token, role } }`; `410 LIVE_ENDED` once over, `403 LIVE_BLOCKED` |
| `POST /api/livestreams/:id/preview` | anyone who may see it | hidden watch-only `{ connection }` |
| `GET /api/livestreams/:id/dvr` | signed in, may watch | `{ playlist }`: the rewind playlist address with a 6 h access token; `404 DVR_UNAVAILABLE` if not recorded |
| `GET /api/livestreams/:id/dvr.m3u8?access=` | holder of a valid access token | the HLS playlist, segments signed; `404 DVR_NOT_READY` before the first segment |
| `POST /api/livestreams/:id/end` | host only | ends it and closes the room; `{ livestream }` with the final stats |
| `GET /api/livestreams/:id/comments?limit=50` | anyone who may see it | latest comments (max 200), oldest first |
| `POST /api/livestreams/:id/comments` `{ text }` | signed in | `201 { comment }` |
| `DELETE /api/livestreams/:id/comments/:commentId` | host, or the author | removed for everyone |
| `POST /api/livestreams/:id/reactions` `{ kind, count }` | signed in | `{ total }`, shown to everyone |
| `POST /api/livestreams/:id/block` `{ userId }` | host only | removes that viewer for good |
| `POST /api/livestreams/:id/thumbnail-signature` | host only, replay ready | `{ uploadUrl, fields }`: a signed Cloudinary upload for the replay's cover; `409 REPLAY_NOT_READY` otherwise |
| `PUT /api/livestreams/:id/thumbnail` | host only, replay ready | uses the cover just uploaded → `{ thumbnailUrl }` |
| `DELETE /api/livestreams/:id/thumbnail` | host only, replay ready | removes the cover → `{ thumbnailUrl: '' }` |

## Follows and notifications

| Route | Who | Result |
| --- | --- | --- |
| `GET /api/users/:id` | anyone | `{ user, followedByMe }`: public profile (no email, no admin details) |
| `POST /api/users/:id/follow` | signed in | toggles; `{ following, followerCount }`. Staff accounts cannot be followed |
| `GET /api/users/me/following` | signed in | `{ ids }` |
| `GET /api/notifications` | signed in | latest 50, newest first (`follow`, `live`) |
| `POST /api/notifications/read` | signed in | marks all read |

Follows live in `follows` (unique per pair; the users' follower counts are
kept in step). Notifications live in `notifications` and delete themselves
after 90 days. The web app still keeps the demo accounts from its fixtures
(`u_001`…) on mock data; real accounts use these routes.

## Sending email

Verification emails go out over SMTP. The template is in
`src/emails/verifyEmail.ts`.

**Local dev without SMTP:** leave `SMTP_USER` and `SMTP_PASS` blank. Each email
is printed in the server terminal, and you can open the link from there.

**Gmail** (free, about 500 emails a day):

1. Turn on 2-Step Verification for the Google account.
2. Create an App Password at <https://myaccount.google.com/apppasswords>.
3. Set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the 16-character app
   password. Spaces in it are ignored.

For a custom sender domain, use a provider such as Brevo or Resend and set
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS` from its SMTP settings.

## Sign in with Google

1. Open <https://console.cloud.google.com>, create or pick a project, and set up
   **APIs & Services > OAuth consent screen**: user type **External**, app name
   ChillnGo, your email as support contact. While the app is in **Testing**,
   add the Google accounts that may sign in under **Test users**.
2. **APIs & Services > Credentials > Create credentials > OAuth client ID**,
   type **Web application**.
3. Under **Authorized JavaScript origins**, add `http://localhost` and
   `http://localhost:5173`, plus the deployed web URL later. No redirect URI
   is needed: the button uses a popup.
4. Copy the client ID into `GOOGLE_CLIENT_ID` in `server/.env` **and**
   `VITE_GOOGLE_CLIENT_ID` in `web/.env.local`, then restart `npm run dev`.
   Vite only reads `VITE_*` values at startup.

The client ID is public and safe to ship to the browser. There is no client
secret in this flow.

The mobile app asks Google for a token addressed to this same Web client, so
`GOOGLE_CLIENT_ID` stays a single value. It also needs an Android OAuth client
for its package name and signing key: see [`mobile/README.md`](../mobile/README.md#google-sign-in).

## Setting up MongoDB Atlas

1. Create a free **M0** cluster at <https://cloud.mongodb.com>. Pick the AWS
   Singapore region (`ap-southeast-1`), close to Vietnam.
2. **Database Access**: add a database user with a password. Use only letters
   and digits in the password, or URL-encode it in the connection string.
3. **Network Access**: add your own IP for local development. For Vercel, add
   `0.0.0.0/0`, because Vercel functions do not have fixed IP addresses.
4. **Connect > Drivers**: copy the `mongodb+srv://...` string. Insert the
   database name before the `?`, e.g. `...mongodb.net/chillngo?retryWrites=true&w=majority`.

## Deploying to Vercel

Deploy the API and the web client as **two Vercel projects from the same repo**.

**API project**

1. Import the repo on Vercel and set **Root Directory** to `server`. Vercel
   detects Express and runs the default export of `src/app.ts` as a function. No `vercel.json` is needed.
2. Add the environment variables `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`,
   `APP_URL`, `SMTP_USER`, `SMTP_PASS`, `GOOGLE_CLIENT_ID`, `CLOUDINARY_URL`, and the
   three `LIVEKIT_*` variables (plus the `RECORDING_*` ones to offer replays). The AI assistant reuses the LiveKit keys. Set both `CORS_ORIGIN` and `APP_URL`
   to the web project's URL, e.g. `https://chillngo.vercel.app`. The API refuses
   to start on Vercel without `APP_URL` and SMTP settings.
3. Deploy. Check `https://<api-project>.vercel.app/api/health`.

Instead of creating the Atlas cluster yourself, you can add the **MongoDB Atlas**
integration from the Vercel Marketplace. It creates the cluster and injects
`MONGODB_URI` into the project for you.

**Web project**

1. Import the same repo again, with **Root Directory** set to `web`. Vercel
   detects Vite. `web/vercel.json` makes page reloads on routes like `/feed` work.
2. Add `VITE_API_URL` = `https://<api-project>.vercel.app`, `VITE_GOOGLE_CLIENT_ID`,
   and the existing `VITE_MAPBOX_TOKEN`. Add the web URL to the Google client's
   Authorized JavaScript origins.
3. Deploy, then make sure the API's `CORS_ORIGIN` matches this URL exactly.

`src/db.ts` caches the MongoDB connection between requests on a warm function
instance, which keeps the number of open Atlas connections low.

## Layout

```
src/
  index.ts              entry: listens locally, exported as the app on Vercel
  app.ts                Express app: CORS, JSON body, routes, error handler
  env.ts                reads and validates environment variables
  db.ts                 cached MongoDB connection
  models/User.ts        User schema + toPublicUser()
  routes/auth.ts        register, verify-email, resend-verification, login, me
  routes/admin.ts       back office: users, admins, stats, audit log, settings
  routes/users.ts       the signed-in user's profile and image uploads
  routes/checkins.ts    photo check-ins
  routes/livestreams.ts livestreams: start, watch, preview, end, comments, reactions,
                        moderation, history, LiveKit webhook
  lib/livekit.ts        every LiveKit call (rooms, tokens, messages, recording, webhooks, inference)
  lib/recordings.ts     signed links to replays and rewind playlists; cleanup
  models/Livestream.ts  livestream, its comments, its viewers
  routes/profiles.ts    public profiles and follows
  routes/notifications.ts  the signed-in user's notifications
  routes/assistant.ts   AI travel assistant: streams a reply from LiveKit Inference
  models/Follow.ts      who follows whom
  models/Notification.ts   notifications + notify()
  models/CheckIn.ts     check-in: photos, caption, feeling, place
  lib/feelings.ts       the fixed list of feelings and activities
  lib/cloudinary.ts     signed uploads, upload check, delivery URLs
  lib/permissions.ts    roles, admin modules, who may act on whom
  middleware/staff.ts   loads the signed-in user; role and permission guards
  models/AuditLog.ts    one row per admin action
  models/Setting.ts     system settings (single document)
  scripts/seed-superadmin.ts  create (or restore) the Super Admin
  emails/verifyEmail.ts the confirmation email (HTML + plain text)
  lib/mailer.ts         SMTP sending, or console output without SMTP
  lib/verification.ts   single-use verification tokens
  lib/google.ts         verifies Google ID tokens
  lib/googleAccount.ts  finds, links or creates the account for a Google profile
  middleware/requireAuth.ts   Bearer token check
  lib/token.ts          sign and verify JWTs
  lib/errors.ts         HttpError and the error handler
  scripts/seed.ts       demo accounts
```

## Planned endpoints (mirrors `web/src/services/`)

| Service fn | Planned route |
| --- | --- |
| `getFeed` | `GET /api/feed` |
| `getPostById` | `GET /api/posts/:id` |
| `createPost` / `updatePost` | `POST /api/posts`, `PATCH /api/posts/:id` |
| `clonePost` | `POST /api/posts/:id/clone` |
| `getMyItineraries` | `GET /api/itineraries` |
| `discoverPosts` | `GET /api/discover` |

New routes that need a signed-in user use the `requireAuth` middleware and read
the user id from `res.locals.userId`.
