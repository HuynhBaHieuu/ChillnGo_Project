# ChillnGo — Server

Node.js + Express + MongoDB API for ChillnGo.

**Not built yet.** This folder is a placeholder so the monorepo layout is in place from day one.

The web client (`../web`) currently talks to local mock JSON fixtures through
`web/src/services/*.ts`. Every one of those functions is a 1:1 stand-in for an
endpoint that will live here. When this API exists, swapping it in means editing
the body of those service functions only — never a component.

## Planned collections

`User`, `TripPost`, `Comment`, `Follow`, `Bookmark`, `ClonedItinerary`, `Notification`

The canonical field shapes are already mirrored in `web/src/mocks/*.json` and typed
in `web/src/services/types.ts`.

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
| `login` / `register` | `POST /api/auth/login`, `POST /api/auth/register` |
