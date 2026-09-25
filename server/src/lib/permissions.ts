/**
 * Roles and admin permissions.
 *
 *   superadmin  everything, implicitly. The only role that can create, lock,
 *               delete or re-permission admins, read the audit log and change
 *               system settings. Cannot be locked or deleted through the API.
 *   admin       only the modules listed in their `adminPermissions`, and only
 *               over regular users, never over other admins.
 *   user        no admin access.
 *
 * web/src/lib/roles.ts mirrors these names for the UI; keep them in step.
 */

export const ROLES = ['user', 'admin', 'superadmin'] as const
export type Role = (typeof ROLES)[number]

export const ADMIN_MODULES = ['users', 'content', 'reports', 'categories', 'stats'] as const
export type AdminModule = (typeof ADMIN_MODULES)[number]

export function isStaff(role: string): boolean {
  return role === 'admin' || role === 'superadmin'
}

/** The modules a user can actually use. */
export function effectivePermissions(user: {
  role: string
  adminPermissions?: string[] | null
}): AdminModule[] {
  if (user.role === 'superadmin') return [...ADMIN_MODULES]
  if (user.role !== 'admin') return []
  return ADMIN_MODULES.filter((module) => user.adminPermissions?.includes(module))
}

/**
 * Whether `actor` may act on `target`'s account (lock, unlock, reset password).
 * Nobody acts on a superadmin or on themselves; admins only on regular users.
 */
export function canManageAccount(
  actor: { _id: string; role: string },
  target: { _id: string; role: string },
): boolean {
  if (target.role === 'superadmin') return false
  if (actor._id === target._id) return false
  if (actor.role === 'superadmin') return true
  return actor.role === 'admin' && target.role === 'user'
}
