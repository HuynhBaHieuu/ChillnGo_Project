/**
 * /api/notifications — the signed-in user's notifications.
 *
 *   GET  /api/notifications        latest 50, newest first, with who caused each
 *   POST /api/notifications/read   mark all as read
 */

import { Router } from 'express'

import { requireAuth } from '../middleware/requireAuth.js'
import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'

export const notificationsRouter = Router()
notificationsRouter.use(requireAuth)

notificationsRouter.get('/', async (_req, res) => {
  const userId = res.locals.userId as string
  const items = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean()
  const actorIds = [...new Set(items.map((n) => n.actorId).filter((id): id is string => Boolean(id)))]
  const actors = await User.find({ _id: { $in: actorIds } }).select('username displayName avatarUrl').lean()
  const byId = new Map(actors.map((a) => [a._id, a]))

  res.json({
    items: items.map((n) => {
      const actor = n.actorId ? byId.get(n.actorId) : null
      return {
        _id: String(n._id),
        userId: n.userId,
        type: n.type,
        actorId: n.actorId,
        postId: null,
        livestreamId: n.livestreamId,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        actor: actor ? { _id: actor._id, username: actor.username, displayName: actor.displayName, avatarUrl: actor.avatarUrl } : null,
      }
    }),
  })
})

notificationsRouter.post('/read', async (_req, res) => {
  await Notification.updateMany({ userId: res.locals.userId as string, read: false }, { $set: { read: true } })
  res.json({ unreadCount: 0 })
})
