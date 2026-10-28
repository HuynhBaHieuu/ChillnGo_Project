/**
 * AI clone: adapt one journey (or merge two or three at the same destination)
 * to your own trip, review what the AI changed, save it to "Đã sao chép".
 * Mounted at /api.
 *
 *   GET    /api/posts/:id/ai-clone                    the form's options: destination, interests, season, journeys to merge, AI requests left
 *   POST   /api/posts/:id/ai-clone                    form → { draft }                                 uses one AI request
 *   POST   /api/posts/ai-merge                        { sourceIds (2–3, one destination), form } → { draft }   uses one AI request
 *   GET    /api/ai-drafts/:draftId                    → { draft }
 *   POST   /api/ai-drafts/:draftId/chat               { message } → { draft, reply }                   uses one AI request
 *   PATCH  /api/ai-drafts/:draftId/changes/:changeId  { status: accepted | reverted | pending } → { draft }
 *   POST   /api/ai-drafts/:draftId/accept-all         → { draft }
 *   POST   /api/ai-drafts/:draftId/optimize-route     { dayIndex? } → { draft, routes }
 *   GET    /api/ai-drafts/:draftId/plan-b             → { planB }
 *   POST   /api/ai-drafts/:draftId/checklist          → { draft }   the AI orders it when a request is left
 *   POST   /api/ai-drafts/:draftId/commit             { title? } → { itinerary }
 *
 * The AI only picks places by id from what the database holds (ai/candidates.ts)
 * and every answer is checked before use (ai/validate.ts); costs, warnings,
 * routes, Plan B and the saved days are computed here. A draft is private to
 * its maker and lasts 24 hours. A request the AI could not answer is not
 * counted against the day's AI requests.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { Types, isValidObjectId } from 'mongoose'
import { z } from 'zod'

import { env } from '../env.js'
import { AiOutputError, AiUnavailableError } from '../ai/aiService.js'
import { destinationOf } from '../ai/candidates.js'
import { checklistItems, defaultChecklist, sortChecklist } from '../ai/checklist.js'
import type { Checklist } from '../ai/checklist.js'
import { chatEdit, createAiDraft } from '../ai/cloneService.js'
import { acceptAll, setChangeStatus } from '../ai/draft.js'
import type { Candidate, Change, DraftState, SeasonFacts, SourceStop } from '../ai/draft.js'
import { optimizeDay } from '../ai/feasibility.js'
import type { RouteResult } from '../ai/feasibility.js'
import { chat } from '../ai/llm.js'
import { formSchema } from '../ai/schemas.js'
import type { FormInput } from '../ai/schemas.js'
import { draftView, itineraryDays, planBList } from '../ai/view.js'
import { HttpError } from '../lib/errors.js'
import { creditClone, isServerPostId, readableJourney } from '../lib/journeys.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { currentUser, loadCurrentUser } from '../middleware/staff.js'
import { AiDraft } from '../models/AiDraft.js'
import { aiCallsLeft, giveBackAiCall, takeAiCall } from '../models/AiUsage.js'
import { ChecklistTemplate } from '../models/ChecklistTemplate.js'
import { Destination } from '../models/Destination.js'
import { Itinerary, itineraryView } from '../models/Itinerary.js'
import { PLACE_CATEGORIES } from '../models/Place.js'
import { Place } from '../models/Place.js'
import { TripPost } from '../models/TripPost.js'
import type { TripPostDocument } from '../models/TripPost.js'
import { User } from '../models/User.js'

export const aiCloneRouter = Router()

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Bạn thao tác quá nhanh. Vui lòng đợi vài phút.' },
})

/** A draft as stored (lean). */
interface DraftRecord {
  _id: unknown
  userId: string
  sourcePostIds: string[]
  destinationId: string | null
  formInput: unknown
  candidates: unknown[]
  sourceStops: unknown[]
  changes: unknown[]
  nextChange: number
  chatHistory: { role: string; content: string; at: Date }[]
  season: unknown
  checklist: unknown
  committedItineraryId: string | null
  rev: number
  expiresAt: Date
}

function stateOf(draft: DraftRecord): DraftState {
  return {
    formInput: draft.formInput as FormInput,
    candidates: draft.candidates as Candidate[],
    sourceStops: draft.sourceStops as SourceStop[],
    changes: draft.changes as Change[],
    nextChange: draft.nextChange,
    season: (draft.season as SeasonFacts | null) ?? null,
  }
}

async function loadDraft(userId: string, id: string, forEdit: boolean): Promise<DraftRecord> {
  const draft = isValidObjectId(id) ? ((await AiDraft.findOne({ _id: id, userId }).lean()) as DraftRecord | null) : null
  // Past its 24 hours it is gone, even if MongoDB has not swept it yet.
  if (!draft || draft.expiresAt < new Date()) {
    throw new HttpError(404, 'Không tìm thấy bản nháp. Bản nháp AI chỉ được giữ 24 giờ, bạn hãy tạo lại nhé.', 'DRAFT_NOT_FOUND')
  }
  if (forEdit && draft.committedItineraryId) {
    throw new HttpError(409, 'Bản nháp này đã được lưu thành lịch trình.', 'DRAFT_COMMITTED')
  }
  return draft
}

/** Writes over exactly the version read; a write in between (another tab, a double click) is a 409. */
async function saveDraft(draft: DraftRecord, set: Partial<DraftRecord>): Promise<DraftRecord> {
  const result = await AiDraft.updateOne({ _id: draft._id, rev: draft.rev }, { $set: set, $inc: { rev: 1 } })
  if (result.matchedCount === 0) {
    throw new HttpError(409, 'Bản nháp vừa được thay đổi ở nơi khác. Hãy tải lại trang.', 'DRAFT_CHANGED')
  }
  return { ...draft, ...set, rev: draft.rev + 1 }
}

/**
 * Applies an edit that is safe to repeat (review statuses, the route
 * optimiser) and saves it. When another write got in between (a double
 * click), it reads the draft again and applies the edit to that, so the click
 * still counts and nobody sees a 409.
 */
async function editDraft(userId: string, draftId: string, edit: (state: DraftState) => void): Promise<DraftRecord> {
  for (let attempt = 1; ; attempt++) {
    const draft = await loadDraft(userId, draftId, true)
    const state = stateOf(draft)
    edit(state)
    try {
      return await saveDraft(draft, { changes: state.changes })
    } catch (error) {
      if (attempt >= 3 || !(error instanceof HttpError) || error.code !== 'DRAFT_CHANGED') throw error
    }
  }
}

/** The draft for the web app: its days and diff, costs, warnings, season, chat, and whose journeys it adapts. */
async function draftResponse(draft: DraftRecord) {
  const ids = draft.sourcePostIds.filter(isServerPostId)
  const posts = await TripPost.find({ _id: { $in: ids } }).select('title authorId').lean()
  const authors = await User.find({ _id: { $in: posts.map((p) => p.authorId) } }).select('username displayName avatarUrl').lean()
  const destination = draft.destinationId ? await Destination.findById(draft.destinationId).select('name').lean() : null
  return {
    _id: String(draft._id),
    sources: draft.sourcePostIds.map((postId) => {
      const post = posts.find((p) => String(p._id) === postId)
      const author = post && authors.find((a) => a._id === post.authorId)
      return {
        postId,
        title: post?.title ?? '',
        author: author ? { _id: author._id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl } : null,
      }
    }),
    destination: destination?.name ?? null,
    formInput: draft.formInput,
    ...draftView(stateOf(draft)),
    checklist: (draft.checklist as Checklist | null) ?? null,
    chat: draft.chatHistory.map((m) => ({ role: m.role, content: m.content, at: new Date(m.at).toISOString() })),
    committedItineraryId: draft.committedItineraryId,
    expiresAt: draft.expiresAt.toISOString(),
    callsLeft: await aiCallsLeft(draft.userId),
    dailyLimit: env.aiDailyLimit,
  }
}

/** Runs one AI request against today's allowance; one the AI could not answer is given back. */
async function withAiRequest<T>(userId: string, failure: string, run: () => Promise<T>): Promise<T> {
  await takeAiCall(userId)
  try {
    return await run()
  } catch (error) {
    await giveBackAiCall(userId)
    if (error instanceof AiUnavailableError) {
      throw new HttpError(503, 'AI đang bận hoặc tạm ngưng. Bạn thử lại sau ít phút nhé.', 'AI_UNAVAILABLE')
    }
    if (error instanceof AiOutputError) throw new HttpError(502, failure, 'AI_INVALID_OUTPUT')
    throw error
  }
}

const PLAN_FAILED = 'AI chưa lập được lịch trình hợp lệ sau vài lần thử. Bạn thử lại, hoặc đổi số ngày, nhịp độ cho dễ hơn nhé.'

function assertHasStops(post: TripPostDocument) {
  if (!(post.days as { locations?: unknown[] }[]).some((d) => d.locations?.length)) {
    throw new HttpError(400, `Hành trình “${post.title}” chưa có điểm dừng nào.`, 'EMPTY_JOURNEY')
  }
}

/* ------------------------------------------------------------------ start */

aiCloneRouter.get('/posts/:id/ai-clone', requireAuth, loadCurrentUser, async (req, res) => {
  const user = currentUser(res)
  const post = await readableJourney(String(req.params.id), user._id)
  const destination = await destinationOf([post])
  const places = destination ? await Place.find({ destinationId: destination._id }).select('category').lean() : []
  const present = new Set(places.map((p) => p.category))

  // Other published journeys that visit this destination's places: what an AI merge can take in.
  const others = places.length
    ? await TripPost.find({
        _id: { $ne: post._id },
        status: 'published',
        deletedAt: null,
        'days.locations.placeId': { $in: places.map((p) => String(p._id)) },
      })
        .select('title authorId days')
        .sort({ likeCount: -1 })
        .limit(10)
        .lean()
    : []
  const authors = await User.find({ _id: { $in: others.map((o) => o.authorId) } }).select('username').lean()

  res.json({
    destination: destination?.name ?? null,
    interests: Object.entries(PLACE_CATEGORIES)
      .filter(([value]) => present.has(value))
      .map(([value, label]) => ({ value, label })),
    season: destination
      ? { rainyMonths: destination.rainyMonths, peakMonths: destination.peakMonths, festivals: destination.festivals }
      : null,
    mergeable: others.map((o) => ({
      postId: String(o._id),
      title: o.title,
      days: o.days.length,
      author: authors.find((a) => a._id === o.authorId)?.username ?? null,
    })),
    sourceDays: post.days.length,
    callsLeft: await aiCallsLeft(user._id),
    dailyLimit: env.aiDailyLimit,
  })
})

aiCloneRouter.post('/posts/:id/ai-clone', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const form = formSchema.parse(req.body)
  const user = currentUser(res)
  const post = await readableJourney(String(req.params.id), user._id)
  assertHasStops(post)
  const destination = await destinationOf([post])
  const draft = await withAiRequest(user._id, PLAN_FAILED, () => createAiDraft(user._id, [post], form, destination))
  res.status(201).json({ draft: await draftResponse(draft.toObject() as unknown as DraftRecord) })
})

const mergeSchema = z.object({
  sourceIds: z
    .array(z.string().max(40))
    .min(2, 'Hãy chọn ít nhất hai hành trình để gộp.')
    .max(3, 'Gộp được nhiều nhất ba hành trình.')
    .refine((ids) => new Set(ids).size === ids.length, 'Mỗi hành trình chỉ chọn một lần.'),
  form: formSchema,
})

aiCloneRouter.post('/posts/ai-merge', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const { sourceIds, form } = mergeSchema.parse(req.body)
  const user = currentUser(res)
  const posts = await Promise.all(sourceIds.map((id) => readableJourney(id, user._id)))
  posts.forEach(assertHasStops)
  // One destination for all, known to ChillnGo: its places are what the AI picks from.
  const destinations = await Promise.all(posts.map((p) => destinationOf([p])))
  const [destination] = destinations
  if (!destination || destinations.some((d) => !d || String(d._id) !== String(destination._id))) {
    throw new HttpError(400, 'Chỉ gộp được các hành trình cùng một điểm đến mà ChillnGo có dữ liệu.', 'DIFFERENT_DESTINATIONS')
  }
  const draft = await withAiRequest(user._id, PLAN_FAILED, () => createAiDraft(user._id, posts, form, destination))
  res.status(201).json({ draft: await draftResponse(draft.toObject() as unknown as DraftRecord) })
})

/* ----------------------------------------------------------------- review */

aiCloneRouter.get('/ai-drafts/:draftId', requireAuth, async (req, res) => {
  const draft = await loadDraft(res.locals.userId as string, String(req.params.draftId), false)
  res.json({ draft: await draftResponse(draft) })
})

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Hãy nhập yêu cầu.').max(500, 'Yêu cầu tối đa 500 ký tự.'),
})

aiCloneRouter.post('/ai-drafts/:draftId/chat', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const { message } = chatSchema.parse(req.body)
  const user = currentUser(res)
  const draft = await loadDraft(user._id, String(req.params.draftId), true)
  const history = draft.chatHistory.map(({ role, content }) => ({ role, content }))
  const { state, reply } = await withAiRequest(
    user._id,
    'AI chưa đưa ra được thay đổi hợp lệ sau vài lần thử. Bạn thử nói rõ hơn, ví dụ tên điểm và ngày muốn đổi nhé.',
    () => chatEdit(stateOf(draft), message, history),
  )
  const at = new Date()
  const saved = await saveDraft(draft, {
    changes: state.changes,
    nextChange: state.nextChange,
    chatHistory: [...draft.chatHistory, { role: 'user', content: message, at }, { role: 'assistant', content: reply, at }].slice(-40),
  })
  res.json({ draft: await draftResponse(saved), reply })
})

const statusSchema = z.object({ status: z.enum(['accepted', 'reverted', 'pending'], 'Trạng thái không hợp lệ') })

aiCloneRouter.patch('/ai-drafts/:draftId/changes/:changeId', requireAuth, writeLimiter, async (req, res) => {
  const { status } = statusSchema.parse(req.body)
  const saved = await editDraft(res.locals.userId as string, String(req.params.draftId), (state) => {
    const problem = setChangeStatus(state, String(req.params.changeId), status)
    if (problem) throw new HttpError(400, problem, 'BAD_CHANGE')
  })
  res.json({ draft: await draftResponse(saved) })
})

aiCloneRouter.post('/ai-drafts/:draftId/accept-all', requireAuth, writeLimiter, async (req, res) => {
  const saved = await editDraft(res.locals.userId as string, String(req.params.draftId), acceptAll)
  res.json({ draft: await draftResponse(saved) })
})

/* ------------------------------------------------- route, Plan B, checklist */

const routeSchema = z.object({ dayIndex: z.number().int().min(1).max(14).optional() })

aiCloneRouter.post('/ai-drafts/:draftId/optimize-route', requireAuth, writeLimiter, async (req, res) => {
  const { dayIndex } = routeSchema.parse(req.body ?? {})
  let routes: RouteResult[] = []
  const saved = await editDraft(res.locals.userId as string, String(req.params.draftId), (state) => {
    const days = state.formInput.days
    if (dayIndex !== undefined && dayIndex > days) throw new HttpError(400, `Bản nháp chỉ có ${days} ngày.`, 'BAD_DAY')
    routes = []
    for (const day of dayIndex ? [dayIndex] : Array.from({ length: days }, (_, i) => i + 1)) {
      const { state: next, result } = optimizeDay(state, day)
      state.changes = next.changes
      routes.push(result)
    }
  })
  res.json({ draft: await draftResponse(saved), routes })
})

aiCloneRouter.get('/ai-drafts/:draftId/plan-b', requireAuth, async (req, res) => {
  const draft = await loadDraft(res.locals.userId as string, String(req.params.draftId), false)
  res.json({ planB: planBList(stateOf(draft)) })
})

aiCloneRouter.post('/ai-drafts/:draftId/checklist', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const user = currentUser(res)
  const draft = await loadDraft(user._id, String(req.params.draftId), true)
  const state = stateOf(draft)
  const templates = await ChecklistTemplate.find().sort({ order: 1, _id: 1 }).lean()
  const items = checklistItems(templates, state)

  // The AI only orders it; without an AI request left, or if it fails, the template order stands.
  let checklist = defaultChecklist(items)
  if (items.length > 1 && (await aiCallsLeft(user._id)) > 0) {
    try {
      checklist = await withAiRequest(user._id, '', () => sortChecklist(chat, items, state))
    } catch (error) {
      console.warn(`[ai] checklist kept in template order: ${(error as Error).message}`)
    }
  }
  res.json({ draft: await draftResponse(await saveDraft(draft, { checklist })) })
})

/* ----------------------------------------------------------------- commit */

const commitSchema = z.object({ title: z.string().trim().max(150, 'Tên lịch trình tối đa 150 ký tự').optional() })

aiCloneRouter.post('/ai-drafts/:draftId/commit', requireAuth, loadCurrentUser, writeLimiter, async (req, res) => {
  const { title } = commitSchema.parse(req.body ?? {})
  const user = currentUser(res)
  const draft = await loadDraft(user._id, String(req.params.draftId), false)

  // Saved already (a second click, another tab): the same itinerary.
  if (draft.committedItineraryId) {
    const existing = await Itinerary.findById(draft.committedItineraryId)
    if (existing) {
      res.json({ itinerary: itineraryView(existing) })
      return
    }
  }

  const state = stateOf(draft)
  const form = state.formInput
  const sources = await TripPost.find({ _id: { $in: draft.sourcePostIds.filter(isServerPostId) } }).select('title coverUrl').lean()
  const ordered = draft.sourcePostIds.flatMap((id) => sources.filter((s) => String(s._id) === id))
  const titles = ordered.map((s) => `“${s.title}”`).join(', ')
  const destination = draft.destinationId ? await Destination.findById(draft.destinationId).select('name').lean() : null

  const id = new Types.ObjectId()
  const { days, total } = itineraryDays(state, String(id))
  const merged = draft.sourcePostIds.length > 1
  const itinerary = await Itinerary.create({
    _id: id,
    ownerId: user._id,
    sourcePostIds: draft.sourcePostIds,
    cloneType: merged ? 'merge' : 'ai',
    aiMeta: form,
    // As the draft page headed it; a source's title would carry its own length ("3N2Đ").
    title: title || `${destination?.name ?? 'Lịch trình'} ${form.days} ngày cho ${form.groupSize} người`,
    note: `AI ${merged ? 'gộp từ các hành trình' : 'điều chỉnh từ hành trình'} ${titles} cho ${form.groupSize} người trong ${form.days} ngày.`,
    coverUrl: ordered[0]?.coverUrl ?? '',
    startDate: form.startDate,
    days,
    totalEstCost: total,
    checklist: (draft.checklist as Checklist | null) ?? null,
  })

  // Only the first commit counts, however many raced here.
  const marked = await AiDraft.updateOne({ _id: draft._id, committedItineraryId: null }, { $set: { committedItineraryId: String(id) } })
  if (marked.modifiedCount === 0) {
    await itinerary.deleteOne()
    const fresh = await loadDraft(user._id, String(draft._id), false)
    const existing = fresh.committedItineraryId ? await Itinerary.findById(fresh.committedItineraryId) : null
    if (!existing) throw new HttpError(409, 'Bản nháp vừa được lưu ở nơi khác. Hãy tải lại trang.', 'DRAFT_CHANGED')
    res.json({ itinerary: itineraryView(existing) })
    return
  }

  await creditClone(draft.sourcePostIds, user._id, ' bằng AI')
  res.status(201).json({ itinerary: itineraryView(itinerary) })
})
