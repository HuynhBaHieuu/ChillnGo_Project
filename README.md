# ChillnGo

A travel social network: people publish real multi-day trip itineraries — day by
day, stop by stop, with what it actually cost — and clone each other's into their
own plans with one tap.

## Monorepo layout

| Folder | What it is | Status |
| --- | --- | --- |
| [`web/`](./web) | React + Vite + TypeScript client | **Built.** Accounts, journeys, check-ins, follows, notifications and livestreams use the API. Seed journeys, likes, comments, bookmarks and cloned itineraries are still mock fixtures. |
| [`server/`](./server) | Node + Express + MongoDB Atlas API | **Running.** Auth, profiles and follows, journeys, check-ins, livestreams, notifications, Your Activity and the admin back office. Likes, comments, bookmarks and itineraries not started. |
| [`mobile/`](./mobile) | Flutter app (Android, iOS) | **Built.** Every web screen, laid out for phones. Same API and the same mock fixtures as the web. Open it in Android Studio. |

Start with [`web/README.md`](./web/README.md).

## How the pieces fit

The web client is complete as a UI, but nothing behind it is real yet. Every
data call goes through a function in `web/src/services/`, each of which is a
stand-in for an endpoint that will live in `server/`. Those functions read JSON
fixtures shaped exactly like the agreed MongoDB collections, with an artificial
300–400ms delay so loading states are honest.

When the API exists, connecting it means editing the bodies of those service
functions. No component changes.

The collection shapes are defined once, in `web/src/services/types.ts`, and both
`server/` and `mobile/` are expected to conform to them.

## Getting started

Everything runs from this folder.

```bash
npm install          # root tooling
npm run setup        # npm install in server/ and web/, flutter pub get in mobile/
npm run dev          # starts all three at once, logs prefixed [server] [web] [mobile]
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the server, the web app and the mobile app. Ctrl+C stops them all. |
| `npm run setup` | Runs `npm install` in server/ and web/, and `flutter pub get` in mobile/. |
| `npm run build` | Builds every app that has a `build` script. |
| `npm run typecheck` | Type-checks server/ and web/, and runs `flutter analyze` in mobile/. |

The server needs `server/.env` before it can reach the database; see
[`server/README.md`](./server/README.md). If the server fails, the web app keeps running.

An app joins these commands automatically once its folder has a
`package.json` with the matching script. The list of app folders lives in
`scripts/run-all.mjs`.

The mobile app is Flutter, so `scripts/mobile.mjs` runs its part. In `npm run dev`
it uses an Android phone connected over USB, or an emulator that is already
open, or else opens the first emulator of Android Studio's Device Manager and
waits for it. Type `r` then Enter in the terminal to hot-reload the app. A
computer without Flutter skips mobile and runs the other two. The emulator stays
open after Ctrl+C, so the next start is quick. Details, and what to do on a
16 GB computer, are in [`mobile/README.md`](./mobile/README.md#running-it-with-npm-run-dev).
