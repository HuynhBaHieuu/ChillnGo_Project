/**
 * Business pages and their ads: server/src/routes/businesses.ts, and the
 * review queue under /api/admin/businesses.
 */

import type { Page } from './admin.service'
import { http } from './http'
import type { Business, BusinessAd, BusinessAdInput, BusinessInput, BusinessStatus } from './types'

export interface SponsoredAd extends BusinessAd {
  business: Business
}

/** GET /api/businesses/sponsored — "Gợi ý nổi bật" on Discover. */
export function getSponsored(): Promise<{ businesses: Business[]; posts: SponsoredAd[] }> {
  return http('/api/businesses/sponsored', { auth: false })
}

/** GET /api/businesses/me — your business (any status) and its ads; business is null before you register. */
export function getMine(): Promise<{ business: Business | null; posts: BusinessAd[] }> {
  return http('/api/businesses/me')
}

/** GET /api/businesses/:slug */
export function getBySlug(slug: string): Promise<{ business: Business; posts: BusinessAd[] }> {
  return http(`/api/businesses/${encodeURIComponent(slug)}`)
}

/** POST /api/businesses — waits for an admin afterwards. */
export async function register(input: BusinessInput): Promise<Business> {
  const { business } = await http<{ business: Business }>('/api/businesses', { method: 'POST', body: input })
  return business
}

/** PATCH /api/businesses/me — a rejected page goes back to review. */
export async function updateMine(input: BusinessInput): Promise<Business> {
  const { business } = await http<{ business: Business }>('/api/businesses/me', { method: 'PATCH', body: input })
  return business
}

export async function createAd(input: BusinessAdInput): Promise<BusinessAd> {
  const { post } = await http<{ post: BusinessAd }>('/api/businesses/me/posts', { method: 'POST', body: input })
  return post
}

export async function updateAd(id: string, input: BusinessAdInput): Promise<BusinessAd> {
  const { post } = await http<{ post: BusinessAd }>(`/api/businesses/me/posts/${id}`, { method: 'PATCH', body: input })
  return post
}

export async function deleteAd(id: string): Promise<void> {
  await http(`/api/businesses/me/posts/${id}`, { method: 'DELETE' })
}

/* ------------------------------------------------------------------ admin */

export interface AdminBusiness extends Business {
  reviewedAt: string | null
  owner: { _id: string; username: string; displayName: string; avatarUrl: string; email: string } | null
}

export type ReviewAction = 'approve' | 'reject' | 'hide' | 'restore'

/** GET /api/admin/businesses */
export function getAdminBusinesses(params: { status?: BusinessStatus; q?: string; page?: number }): Promise<Page<AdminBusiness>> {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const qs = search.toString()
  return http(`/api/admin/businesses${qs ? `?${qs}` : ''}`)
}

/** POST /api/admin/businesses/:id/review — reject and hide need a reason. */
export function review(id: string, action: ReviewAction, reason = ''): Promise<{ business: Business }> {
  return http(`/api/admin/businesses/${id}/review`, { method: 'POST', body: { action, reason } })
}
