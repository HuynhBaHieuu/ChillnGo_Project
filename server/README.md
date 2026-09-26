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
| `GOOGLE_CLIENT_ID` | no | OAuth client ID for Sign in with Google. Unset makes `/api/auth/google` answer `503`. See [Sign in with Google](#sign-in-with-google). |

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
| `GET /api/settings/public` | none | `200 { settings }`: announcement and whether registration is open. |
| `GET /api/auth/me` | none; header `Authorization: Bearer <token>` | `200 { user }` |
| `GET /api/health` | none | `200 { ok: true }` |

Admin routes, under `/api/admin`, need a staff account; the permission is in brackets:

| Route | Who |
| --- | --- |
| `GET /stats` | [stats] |
| `GET /users?q&role&status&page` | [users]; admins only see role `user` |
| `POST /users/:id/lock` `{ reason }`, `POST /users/:id/unlock` | [users] |
| `POST /users/:id/reset-password` | [users] |
| `DELETE /users/:id` | Super Admin |
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
   detects Express and runs `src/index.ts` as a function. No `vercel.json` is needed.
2. Add the environment variables `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`,
   `APP_URL`, `SMTP_USER`, `SMTP_PASS`, `GOOGLE_CLIENT_ID`, and `CLOUDINARY_URL`. Set both `CORS_ORIGIN` and `APP_URL`
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
| `toggleFollow` | `POST /api/users/:id/follow` |

New routes that need a signed-in user use the `requireAuth` middleware and read
the user id from `res.locals.userId`.
