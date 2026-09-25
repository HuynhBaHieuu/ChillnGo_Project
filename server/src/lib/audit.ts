import type { Request } from 'express'

import { AuditLog } from '../models/AuditLog.js'

interface Actor {
  _id: string
  displayName: string
  username: string
  role: string
}

interface Target {
  type?: string
  id?: string
  label?: string
}

/**
 * Records one admin action. Awaited by the caller, so an action that cannot
 * be logged fails instead of happening silently.
 */
export async function audit(
  req: Request,
  actor: Actor,
  action: string,
  target: Target = {},
  details: Record<string, unknown> = {},
): Promise<void> {
  await AuditLog.create({
    actorId: actor._id,
    actorName: `${actor.displayName} (@${actor.username})`,
    actorRole: actor.role,
    action,
    targetType: target.type ?? 'user',
    targetId: target.id ?? '',
    targetLabel: target.label ?? '',
    details,
    ip: req.ip ?? '',
  })
}
