# ChillnGo news worker

Fetches the Newsfeed's **social sources** (X/Twitter, Reddit, Facebook,
Instagram, YouTube search, Xiaohongshu, Bilibili) with
[Agent Reach](https://github.com/Panniantong/Agent-Reach) on this machine and
sends the items to the ChillnGo API. RSS, Google News and YouTube channel
sources are fetched by the API itself; this worker is only needed for social
sources.

## Set up (once)

1. Install Agent Reach and check it works: `agent-reach version`.
   For platforms that need a login, run `agent-reach add <platform>` and log
   in **with a spare account**: platforms may block accounts used by tools.
2. In ChillnGo: **Admin → Tin tức → Máy cào → Tạo mã**. Copy the key (shown once).
3. Next to `worker.mjs`, create `worker.env`:

   ```
   CHILLNGO_API=https://chillgo-project.vercel.app
   CHILLNGO_WORKER_KEY=cgw_...
   ```

   `worker.env` is git-ignored. Never commit the key.
4. Run it once: `node worker.mjs` (Node 20+). Each source prints ✓ or ✗.

## Run on a schedule (Windows)

Task Scheduler → Create Basic Task → every 2 hours → Start a program:

- Program: `node`
- Arguments: `worker.mjs`
- Start in: this folder

The API only hands out sources whose interval has passed, so running the
worker more often than the sources' interval is harmless.

## What it sends

For each source: `agent-reach <platform> search <query> --limit 15` (or
`agent-reach read <url>` when the source has a page instead of a query). Only
the link, title, a short excerpt, a picture, the author and the date are sent;
the API keeps a title, a summary and the link, and readers open the original.
