/**
 * Back-office API (server/src/routes/admin.ts). Every call needs a signed-in
 * admin or superadmin; the server checks the exact permission.
 */

import type { AdminModule, Role } from '@/lib/roles'

import { http } from './http'

export interface AdminUser {
  _id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string
  role: Role
  permissions: AdminModule[]
  status: 'active' | 'locked'
  lockedReason: string
  lockedAt: string | null
  emailVerified: boolean
  googleLinked: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminStats {
  /** "users": an admin's view, regular users only. "full": the superadmin's view. */
  scope: 'users' | 'full'
  users: {
    total: number
    verified: number
    locked: number
    googleLinked: number
    new7: number
    new30: number
  }
  /** Journeys, check-ins, streams, moderation and AI use. Missing from an older server. */
  content?: {
    posts: number
    posts7: number
    checkins: number
    checkins7: number
    liveNow: number
    streams30: number
    hidden: number
    reports7: number
    aiRequestsToday: number
    aiUsersToday: number
    aiDrafts7: number
  }
  signupsByDay: { date: string; count: number }[]
  byRole?: Partial<Record<Role, number>>
  adminActions7?: number
  /** Pieces of content with reports waiting; only for those with the Reports permission. */
  pendingReports?: number
  /** Business pages waiting for review; only with the Businesses permission. */
  pendingBusinesses?: number
  /** Paid in the last 30 days and Premium members now; only with the Revenue permission. */
  revenue?: { revenue30: number; premiumMembers: number }
  /** With the news permission: news published today and waiting for review. */
  news?: { today: number; pending: number }
}

export interface AuditEntry {
  _id: string
  actorName: string
  actorRole: string
  action: string
  targetLabel: string
  details: Record<string, unknown>
  ip: string
  createdAt: string
}

export interface AppSettings {
  registrationOpen: boolean
  announcement: string
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function getStats(): Promise<AdminStats> {
  return http<AdminStats>('/api/admin/stats')
}

export function listUsers(params: {
  q?: string
  role?: Role
  status?: 'active' | 'locked'
  page?: number
}): Promise<Page<AdminUser>> {
  return http<Page<AdminUser>>(`/api/admin/users${query(params)}`)
}

export function lockUser(id: string, reason: string): Promise<{ user: AdminUser }> {
  return http(`/api/admin/users/${id}/lock`, { method: 'POST', body: { reason } })
}

export function unlockUser(id: string): Promise<{ user: AdminUser }> {
  return http(`/api/admin/users/${id}/unlock`, { method: 'POST' })
}

export function resetPassword(id: string): Promise<{ message: string }> {
  return http(`/api/admin/users/${id}/reset-password`, { method: 'POST' })
}

export function createAdmin(input: {
  displayName: string
  username: string
  email: string
  password: string
  permissions: AdminModule[]
}): Promise<{ user: AdminUser }> {
  return http('/api/admin/admins', { method: 'POST', body: input })
}

export function setRole(
  id: string,
  role: 'user' | 'admin',
  permissions?: AdminModule[],
): Promise<{ user: AdminUser }> {
  return http(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role, permissions } })
}

export function setPermissions(id: string, permissions: AdminModule[]): Promise<{ user: AdminUser }> {
  return http(`/api/admin/admins/${id}/permissions`, { method: 'PATCH', body: { permissions } })
}

export function listAuditLogs(params: { q?: string; action?: string; page?: number }): Promise<Page<AuditEntry>> {
  return http<Page<AuditEntry>>(`/api/admin/audit-logs${query(params)}`)
}

export function getSettings(): Promise<{ settings: AppSettings }> {
  return http('/api/admin/settings')
}

export function saveSettings(settings: AppSettings): Promise<{ settings: AppSettings }> {
  return http('/api/admin/settings', { method: 'PUT', body: settings })
}

/** Public: banner text and whether sign-up is open. No sign-in needed. */
export function getPublicSettings(): Promise<{ settings: AppSettings }> {
  return http('/api/settings/public', { auth: false })
}

export interface LiveStreamRow {
  _id: string
  title: string
  description: string
  audience: 'public' | 'followers' | 'private'
  startedAt: string
  viewerCount: number
  peakViewers: number
  commentCount: number
  host: { _id: string; username: string; displayName: string; avatarUrl: string; status: 'active' | 'locked'; role: Role } | null
}

/** GET /api/admin/livestreams — [content]. Every stream live right now. */
export function listLiveStreams(): Promise<{ items: LiveStreamRow[] }> {
  return http('/api/admin/livestreams')
}

/** POST /api/admin/livestreams/:id/end — [content]. Stops a stream; the host is told why. */
export function endLiveStream(id: string, reason: string): Promise<{ ok: true }> {
  return http(`/api/admin/livestreams/${id}/end`, { method: 'POST', body: { reason } })
}
