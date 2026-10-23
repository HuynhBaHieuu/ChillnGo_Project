# ChillnGo — Web Client

React + Vite + TypeScript front end for ChillnGo, a travel social network where
people publish real multi-day trip itineraries and clone each other's into their
own plans.

**Auth is real; everything else is still mocked.** Login, register and session
checks call the Express API in `../server` (MongoDB). Every other data call goes
through a function in `src/services/` that reads local JSON fixtures with a
300–400ms artificial delay. Moving those to the API means editing the function
bodies — never a component.

## Running it

Start the API first (see `../server/README.md`), then:

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api to localhost:4000
npm run build    # type-check + production build
npm run lint
```

Optional configuration — copy `.env.example` to `.env.local`:

| Variable | Effect if unset |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | The "Đăng nhập bằng Google" button and its divider are hidden. Setup steps are in `../server/README.md`. |
| `VITE_API_URL` | Requests go to `/api` on the same origin. Fine for local dev, where Vite proxies them to the API. Set it to the deployed API URL in production. |
| `VITE_MAPBOX_TOKEN` | `<MapPreview />` renders a static SVG sketch of the route instead of an interactive map. Everything else works. |
| `VITE_HERO_VIDEO_URL` | With reduced motion on, the landing hero shows a still photo instead of this footage. Otherwise the hero uses the neon tubes background and ignores it. |

Blank values count as unset (see `src/lib/env.ts`), so a copied `.env.example`
behaves the same as no file at all.

## Layout

```
src/
  app/            router, providers, layout shell, home page (app/landing/home)
  components/     shared UI (Navbar, GlassCard, TripCard, TagChip, Modal,
                  Button, MapPreview) + shadcn/ui primitives in ui/
  features/
    auth/               login, register, RequireAuth guard
    trip-post/          feed, post detail, multi-day form builder
    map/                Mapbox layer and its no-token fallback
    social/             profile, follow, notifications
    itinerary-clone/    my itineraries, drag-and-drop reorder, merge
    discovery-admin/    Discover filters/map, admin console (AdminLayout + admin/)
  mocks/          one JSON fixture per MongoDB collection
  services/       the only place that knows where data comes from
  store/          Zustand (auth session, transient UI state)
  styles/         theme.css, liquid-glass.css, animations.css
  lib/            formatting, query keys, cost math, cn()
```

Components import from `@/services`, never from `@/mocks`. That one rule is what
keeps the API swap contained.

## Routes

| Route | Page | Guard |
| --- | --- | --- |
| `/` | Home — scroll-driven landing (GSAP + Lenis), see below | — |
| `/landing-print` | Alternative landing in a print-editorial style (`app/landing/print/`): five pinned stages driven by CSS variables from one scroll handler, own fonts and nav | — |
| `/feed` | Newsfeed, filtered to who you follow | — |
| `/discover` | Filters + grid/map toggle, sorted by saves | — |
| `/posts/:id` | Trip detail, itinerary, map, comments, clone | — |
| `/posts/new`, `/posts/:id/edit` | Multi-day form builder | signed in |
| `/itineraries`, `/itineraries/:id` | Cloned itineraries, drag to reorder | signed in |
| `/users/:id` | Profile with Bài viết / Đã lưu / Lịch trình đã clone | — |
| `/login`, `/register` | Auth forms | — |
| `/admin/*` | Admin console with its own sidebar layout: overview, users, admins, content, audit log, settings. Real data from the API | admin or superadmin; sections by permission |

## Home page scroll experience

`/` is six scroll-driven stages in `src/app/landing/home/`, built with GSAP
ScrollTrigger (+ SplitText) on Lenis smooth scrolling:

| Stage | What happens |
| --- | --- |
| Intro | Hero headline splits and flies past the camera; mission statement lights up character by character |
| Stats | Four circles slide apart, numbers count up; a light "dome" rises |
| How it works | Feature list slides through a fixed navy band — text turns white only where it crosses it |
| Destinations | Every trip stop as coordinates through a scanner line with a lens effect; a circle opens into a rotating photo wheel |
| Featured trips | Most-saved trips fly past a pinned title at different speeds |
| Footer | Wordmark parallax, CTA circle |

- **Tuning:** pinned timelines are written in units of 100vh of scroll. Every
  length lives in `config.ts` — change `UNITS` or `SCRUB` there, not in the stages.
- **Data:** stats, coordinates and photos come from `services/landing.service.ts`;
  stages mount only once data is in, because pins measure their content when created.
- **Lenis runs on `/` only.** Other pages use native scrolling (dnd-kit
  drag-and-drop and sticky elements don't mix well with smooth scroll).
- **Navbar on `/`** is transparent and recolours by section via
  `<html data-nav-theme>`, which the stage timelines set; every other page keeps
  the glass navbar.
- **Reduced motion:** no Lenis, no pins, no scrubbing — every section renders
  static and fully readable.

## Data layer

`src/services/types.ts` is the single source of truth for the collection shapes
(`User`, `TripPost`, `Comment`, `Follow`, `Bookmark`, `ClonedItinerary`,
`Notification`). The fixtures in `src/mocks/` satisfy those types, and so must
the future API.

`src/services/client.ts` seeds an in-memory database from the fixtures. Writes
made during a session — likes, bookmarks, follows, clones, reorders, new posts —
persist across navigation and reset on a full page reload. Every read returns a
detached copy, so a component can never mutate the store by holding a reference.

Each service function maps 1:1 to a planned endpoint; `server/README.md` has the
table.

## What is deliberately not real yet

- **Auth is the exception: it is real.** Passwords are checked by the API and the
  token is a signed JWT, stored in Zustand + localStorage. `SessionSync` re-checks
  a stored token on load, and any 401 signs the user out. Signed-in users are
  also copied into the mock `db.users` table so the still-mocked services can
  find them (see `auth.service.ts`).
- **Image upload.** Picking a file in the form builder assigns a deterministic
  placeholder URL; no bytes leave the browser.
- **Mapbox Directions.** The "route" is a straight polyline through the stops in
  order, taken from `routeGeoJson` in the fixtures. No routing requests.
- **Clone / reorder / merge algorithms.** Clone is a deep copy with fresh ids and
  re-based dates; reorder is an array move plus renumbering; merge appends. The
  real versions (route re-optimisation, travel-time reconciliation, conflict
  handling) land with the API. See `itinerary.service.ts`.
- **Admin content moderation.** The admin console manages accounts for real, but
  its "Nội dung" section (posts, reports, categories) waits for that data to move
  to the API.

Submitting the post form logs the full payload to the console in the exact
`TripPost` shape, so the form and the schema can be checked against each other
before the API exists.

## Languages

The site speaks Vietnamese (the source language), English, Chinese, Japanese
and Korean. The globe button in the navbar (and in the admin sidebar) switches
language; the choice is kept in localStorage, and a first visit follows the
browser's language when the site speaks it. Everything lives in `src/i18n/`.

Strings stay in Vietnamese in the code, wrapped in `t()`; the Vietnamese is the
key into the catalog:

```tsx
t('Đăng nhập')                         // "Log in"
t('{n} ngày', { n: 3 })                // "3 days"
tr('Gửi tới {email}.', { email: <b>{email}</b> })   // a sentence with JSX inside
```

- Translations live in `src/i18n/messages/*.ts`, one file per area, each
  entry `'Tiếng Việt': { en, zh, ja, ko }`. An English entry may be a
  `[singular, plural]` pair, picked by the `n` parameter.
- `t()` only accepts strings the catalog has, so a new string fails
  `npm run typecheck` until it gets its translations. Add a file to
  `catalog.ts` when you create one.
- A Vietnamese word with two meanings gets a context after `#`
  (`'Người dùng#role'`); the context is never shown.
- Text only known at run time (tags, labels from the API) goes through `tx()`,
  which shows it unchanged when the catalog lacks it.
- Changing language remounts the pages, so every `t()` call runs again. Label
  tables declared at module level use `translated()` / `translatedList()` so
  they translate when read, not once at load.
- Dates, numbers and money use the current language's `Intl` locale
  (`localeTag()`, `dateLocale()`); map labels use `mapLanguage()`.
- The API answers in Vietnamese. `i18n/server.ts` translates its error
  messages and notification lines back (exact matches, plus patterns for the
  templated ones). A new server message needs an entry in
  `messages/server.ts`, or it shows in Vietnamese.

Content people write (journey titles, comments, AI replies) is shown as written.

## Design system

One dark theme, defined as HSL tokens in `src/styles/theme.css`, plus a light
`--paper` surface used only by the home page's light sections. Instrument Serif
for every heading and title (`--font-display`), Inter for body text
(`--font-body`).

Instrument Serif has no Vietnamese glyphs. Condensed Noto Serif Display sits
right after it in `--font-display` and supplies only the letters it lacks
(ế, ấ, ề…); without it those letters render with a detached accent. The browser
downloads only Noto's Vietnamese subset, and only when a page needs it.

`.liquid-glass` (in `liquid-glass.css`) is the single surface treatment: a
near-transparent pane with a 4px backdrop blur, an inset top highlight, and a
1.4px gradient rim drawn by `::before` that is bright at the top and bottom
edges and invisible through the middle. It is used on the navbar, every primary
CTA, the notification dropdown, the Discover filter panel, modals, and the
mobile sheets. Anything using it must render its content in a `relative z-[1]`
layer so it sits above that rim — `GlassCard` does this for you.

`fade-rise` (in `animations.css`) is the only entrance motion, applied to the
first-paint content of every page in three staggered steps
(`.animate-fade-rise`, `-delay`, `-delay-2`). It respects
`prefers-reduced-motion`.

No decorative blobs or radial gradients anywhere. The one flat overlay in the
app is the scrim on the landing hero, which exists so white type stays legible
over moving footage. The home page's "dome" transitions are solid clipped shapes
with a blurred edge, not gradients.

## Notes

- Mapbox GL (~1.8 MB) is code-split behind `React.lazy` in
  `features/map/MapPreview.tsx`, so it is only fetched when a map actually
  renders — and never at all without a token.
- Fixture photos use `picsum.photos` seeded URLs, so they are stable across
  reloads and need no asset pipeline.
- Seed accounts: `minh@chillngo.vn` (regular user, pre-filled on the login form)
  and `admin@chillngo.vn` (admin role, for `/admin`).
