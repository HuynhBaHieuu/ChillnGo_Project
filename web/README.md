# ChillnGo — Web Client

React + Vite + TypeScript front end for ChillnGo, a travel social network where
people publish real multi-day trip itineraries and clone each other's into their
own plans.

**The Express API does not exist yet.** Every data call in this app goes through
a function in `src/services/`, which today reads local JSON fixtures with a
300–400ms artificial delay. Swapping in the real API means editing those
function bodies — never a component.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

Optional configuration — copy `.env.example` to `.env.local`:

| Variable | Effect if unset |
| --- | --- |
| `VITE_MAPBOX_TOKEN` | `<MapPreview />` renders a static SVG sketch of the route instead of an interactive map. Everything else works. |
| `VITE_HERO_VIDEO_URL` | The landing hero falls back to a public sample clip. Replace it with real travel footage. |

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
    discovery-admin/    Discover filters/map, admin shell
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
| `/feed` | Newsfeed, filtered to who you follow | — |
| `/discover` | Filters + grid/map toggle, sorted by saves | — |
| `/posts/:id` | Trip detail, itinerary, map, comments, clone | — |
| `/posts/new`, `/posts/:id/edit` | Multi-day form builder | signed in |
| `/itineraries`, `/itineraries/:id` | Cloned itineraries, drag to reorder | signed in |
| `/users/:id` | Profile with Bài viết / Đã lưu / Lịch trình đã clone | — |
| `/login`, `/register` | Auth forms | — |
| `/admin` | Tabs + empty states only | admin role |

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

- **Auth.** Any password works. The token looks like a JWT but is unsigned, and
  is stored in Zustand + localStorage. `RequireAuth` is wired and ready.
- **Image upload.** Picking a file in the form builder assigns a deterministic
  placeholder URL; no bytes leave the browser.
- **Mapbox Directions.** The "route" is a straight polyline through the stops in
  order, taken from `routeGeoJson` in the fixtures. No routing requests.
- **Clone / reorder / merge algorithms.** Clone is a deep copy with fresh ids and
  re-based dates; reorder is an array move plus renumbering; merge appends. The
  real versions (route re-optimisation, travel-time reconciliation, conflict
  handling) land with the API. See `itinerary.service.ts`.
- **Admin.** Tabs and empty states only. The reads it will need already exist in
  `discovery.service.ts` and are intentionally unwired.

Submitting the post form logs the full payload to the console in the exact
`TripPost` shape, so the form and the schema can be checked against each other
before the API exists.

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
