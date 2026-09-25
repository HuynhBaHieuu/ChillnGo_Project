/**
 * Entry point.
 *
 * Locally this starts an HTTP server. On Vercel, the default export is picked
 * up as the Express app and runs as a Vercel Function, so no listen() call is
 * made there.
 */

import { app } from './app.js'
import { env } from './env.js'

if (!env.isVercel) {
  app.listen(env.port, () => {
    console.log(`ChillnGo API listening on http://localhost:${env.port}`)
  })
}

export default app
