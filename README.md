# ChillnGo

A travel social network: people publish real multi-day trip itineraries — day by
day, stop by stop, with what it actually cost — and clone each other's into their
own plans with one tap.

## Monorepo layout

| Folder | What it is | Status |
| --- | --- | --- |
| [`web/`](./web) | React + Vite + TypeScript client | **Built.** Auth uses the API; other data is still mock fixtures. |
| [`server/`](./server) | Node + Express + MongoDB Atlas API | **Auth done** (register, login, current user). Other endpoints not started. |
| [`mobile/`](./mobile) | React Native client | Placeholder. Comes after the API. |

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
npm run setup        # npm install inside server/, web/ and mobile/
npm run dev          # starts every app at once, logs prefixed [server] [web] [mobile]
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts every app that has a `dev` script. Ctrl+C stops them all. |
| `npm run setup` | Runs `npm install` in every app that has a `package.json`. |
| `npm run build` | Builds every app that has a `build` script. |
| `npm run typecheck` | Type-checks every app that has a `typecheck` script. |

The server needs `server/.env` before it can reach the database; see
[`server/README.md`](./server/README.md). If the server fails, the web app keeps running.

An app joins these commands automatically once its folder has a
`package.json` with the matching script. That is how `mobile/` will start
alongside the others. The list of app folders lives in `scripts/run-all.mjs`.
