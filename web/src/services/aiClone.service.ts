/**
 * AI clone (server/src/routes/aiClone.ts): adapt a journey to your trip,
 * review what the AI changed, chat to edit, then save it to "Đã clone về".
 *
 * Only journeys stored by the API can be adapted: the AI may only use what
 * ChillnGo's database holds, and the sample journeys are not in it.
 */

import { http } from './http'
import { isServerPostId } from './serverPosts'
import type { AiChangeStatus, AiCloneForm, AiCloneOptions, AiDraft, ClonedItinerary, ObjectId } from './types'

/** What the route optimiser did to one day (straight-line km, an estimate). */
export interface RouteResult {
  dayIndex: number
  beforeKm: number
  afterKm: number
  changed: boolean
}

type DraftResponse = { draft: AiDraft }

export function canAiClone(postId: ObjectId): boolean {
  return isServerPostId(postId)
}

/** GET /api/posts/:id/ai-clone — where the journey goes, the interests on offer, AI requests left today. */
export function getAiCloneOptions(postId: ObjectId): Promise<AiCloneOptions> {
  return http<AiCloneOptions>(`/api/posts/${postId}/ai-clone`)
}

/** POST /api/posts/:id/ai-clone — uses one of today's AI requests; takes up to a minute. */
export async function createAiDraft(postId: ObjectId, form: AiCloneForm): Promise<AiDraft> {
  const { draft } = await http<DraftResponse>(`/api/posts/${postId}/ai-clone`, { method: 'POST', body: form })
  return draft
}

/** POST /api/posts/ai-merge — two or three journeys at one destination into one draft. Uses one AI request. */
export async function createAiMerge(sourceIds: ObjectId[], form: AiCloneForm): Promise<AiDraft> {
  const { draft } = await http<DraftResponse>('/api/posts/ai-merge', { method: 'POST', body: { sourceIds, form } })
  return draft
}

/** GET /api/ai-drafts/:id */
export async function getAiDraft(id: ObjectId): Promise<AiDraft> {
  const { draft } = await http<DraftResponse>(`/api/ai-drafts/${id}`)
  return draft
}

/** POST /api/ai-drafts/:id/chat — uses one of today's AI requests. */
export function sendAiChat(id: ObjectId, message: string): Promise<{ draft: AiDraft; reply: string }> {
  return http<{ draft: AiDraft; reply: string }>(`/api/ai-drafts/${id}/chat`, { method: 'POST', body: { message } })
}

/** PATCH /api/ai-drafts/:id/changes/:changeId — accept, revert, or back to pending. */
export async function setAiChangeStatus(id: ObjectId, changeId: string, status: AiChangeStatus): Promise<AiDraft> {
  const { draft } = await http<DraftResponse>(`/api/ai-drafts/${id}/changes/${changeId}`, {
    method: 'PATCH',
    body: { status },
  })
  return draft
}

/** POST /api/ai-drafts/:id/accept-all */
export async function acceptAllAiChanges(id: ObjectId): Promise<AiDraft> {
  const { draft } = await http<DraftResponse>(`/api/ai-drafts/${id}/accept-all`, { method: 'POST' })
  return draft
}

/** POST /api/ai-drafts/:id/optimize-route — one day, or all of them; no AI involved. */
export function optimizeAiRoute(id: ObjectId, dayIndex?: number): Promise<{ draft: AiDraft; routes: RouteResult[] }> {
  return http<{ draft: AiDraft; routes: RouteResult[] }>(`/api/ai-drafts/${id}/optimize-route`, {
    method: 'POST',
    body: { dayIndex },
  })
}

/** POST /api/ai-drafts/:id/checklist — the AI orders it when an AI request is left. */
export async function createAiChecklist(id: ObjectId): Promise<AiDraft> {
  const { draft } = await http<DraftResponse>(`/api/ai-drafts/${id}/checklist`, { method: 'POST' })
  return draft
}

/** POST /api/ai-drafts/:id/commit — saves it to "Đã clone về". Saving twice gives the same itinerary. */
export async function commitAiDraft(id: ObjectId, title?: string): Promise<ClonedItinerary> {
  const { itinerary } = await http<{ itinerary: ClonedItinerary }>(`/api/ai-drafts/${id}/commit`, {
    method: 'POST',
    body: { title },
  })
  return itinerary
}
