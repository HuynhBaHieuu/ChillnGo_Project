/**
 * Entry point.
 *
 * Locally this starts an HTTP server. On Vercel, src/app.ts is the entry point
 * instead (its default export runs as a Vercel Function), so no listen() call
 * is made there.
 */

import { app } from './app.js'
import { env } from './env.js'

if (!env.isVercel) {
  app.listen(env.port, () => {
    console.log(`ChillnGo API listening on http://localhost:${env.port}`)
  })
}

export default app
