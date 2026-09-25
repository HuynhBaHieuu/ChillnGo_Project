/**
 * MongoDB connection, shaped for serverless.
 *
 * On Vercel each warm function instance keeps its module scope between
 * requests, so the connection promise is cached here and reused. Opening a new
 * connection per request would exhaust the Atlas connection limit quickly.
 */

import { attachDatabasePool } from '@vercel/functions'
import mongoose from 'mongoose'

import { env } from './env.js'

let pending: Promise<typeof mongoose> | null = null

export function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose)

  pending ??= mongoose
    .connect(env.mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 })
    .then((connected) => {
      // Lets Vercel close idle pool connections before it suspends the instance.
      if (env.isVercel) attachDatabasePool(connected.connection.getClient())
      return connected
    })
    .catch((error: unknown) => {
      // Do not cache a failure: the next request should try again.
      pending = null
      throw error
    })

  return pending
}
