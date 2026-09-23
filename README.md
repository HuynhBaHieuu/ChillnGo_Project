# ChillnGo

A travel social network: people publish real multi-day trip itineraries — day by
day, stop by stop, with what it actually cost — and clone each other's into their
own plans with one tap.

## Monorepo layout

| Folder | What it is | Status |
| --- | --- | --- |
| [`web/`](./web) | React + Vite + TypeScript client | **Built.** Runs against local mock fixtures. |
| [`server/`](./server) | Node + Express + MongoDB API | Placeholder. Not started. |
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

```bash
cd web
npm install
npm run dev
```
