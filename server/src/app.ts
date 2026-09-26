import cors from 'cors'
import express from 'express'

import { connectDb } from './db.js'
import { env } from './env.js'
import { HttpError, errorHandler } from './lib/errors.js'
import { getSettings } from './models/Setting.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { checkinsRouter } from './routes/checkins.js'
import { livestreamsRouter } from './routes/livestreams.js'
import { notificationsRouter } from './routes/notifications.js'
import { profilesRouter } from './routes/profiles.js'
import { usersRouter } from './routes/users.js'

export const app = express()

// Vercel (and most hosts) sit behind a proxy; this makes req.ip the real client
// IP, which the rate limiter keys on.
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(cors({ origin: env.corsOrigins }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Every other API route needs the database. Connecting here, lazily, keeps a
// cold start cheap for routes that do not.
app.use('/api', async (_req, _res, next) => {
  try {
    await connectDb()
  } catch (error) {
    // Usually Atlas refusing this machine's IP (Network Access list), or no
    // network. One clear line instead of a driver stack trace per request.
    console.error(`MongoDB connection failed: ${(error as Error).name}. Check Atlas > Network Access.`)
    throw new HttpError(
      503,
      'Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau ít phút.',
      'DB_UNAVAILABLE',
    )
  }
  next()
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
// Public profiles and follows first; usersRouter (all sign-in only) takes the rest.
app.use('/api/users', profilesRouter)
app.use('/api/users', usersRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/checkins', checkinsRouter)
app.use('/api/livestreams', livestreamsRouter)

/** Settings every visitor needs: the announcement banner and whether sign-up is open. */
app.get('/api/settings/public', async (_req, res) => {
  res.json({ settings: await getSettings() })
})

app.use((_req, res) => {
  res.status(404).json({ message: 'Không tìm thấy' })
})

app.use(errorHandler)
