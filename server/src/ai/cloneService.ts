/**
 * What asks the model about a draft: making one from journeys (with one extra
 * round when it comes out over budget), and editing one by chat. The
 * checklist's ordering is in checklist.ts.
 */

import { AiDraft } from '../models/AiDraft.js'
import type { DestinationDocument } from '../models/Destination.js'
import type { TripPostDocument } from '../models/TripPost.js'
import { generateStructured } from './aiService.js'
import type { ChatMessage } from './aiService.js'
import { buildCandidates } from './candidates.js'
import { applyPatches, changesFromPlan, costSummary, plannedStops } from './draft.js'
import type { DraftState } from './draft.js'
import { seasonOf } from './feasibility.js'
import { chat } from './llm.js'
import { CHAT_SYSTEM, CLONE_SYSTEM, budgetFeedback, chatInput, cloneInput } from './prompts.js'
import { chatOutputSchema, planSchema } from './schemas.js'
import type { FormInput, Plan } from './schemas.js'
import { validatePatches, validatePlan } from './validate.js'

/** A draft from one journey (AI clone) or several at the same destination (AI merge). */
export async function createAiDraft(
  userId: string,
  posts: TripPostDocument[],
  form: FormInput,
  destination: DestinationDocument | null,
) {
  const season = seasonOf(destination, form)
  const base = { formInput: form, season, ...(await buildCandidates(posts, form, destination)) }
  const journeys = posts.map((p) => ({ postId: String(p._id), title: p.title, days: p.days.length }))
  const request: ChatMessage[] = [{ role: 'user', content: cloneInput(base, journeys, destination?.name ?? null) }]
  const ask = (messages: ChatMessage[]) =>
    generateStructured({ chat, task: 'clone', system: CLONE_SYSTEM, messages, schema: planSchema, check: (plan) => validatePlan(plan, base) })
  const draftOf = (plan: Plan): DraftState => ({ ...base, ...changesFromPlan(plan, base) })

  let plan = await ask(request)
  let state = draftOf(plan)

  // Over budget: the backend's numbers go back once, for a cheaper plan.
  const cost = costSummary(plannedStops(state), form)
  if (cost.overBudget) {
    try {
      const cheaper = await ask([
        ...request,
        { role: 'assistant', content: JSON.stringify(plan) },
        { role: 'user', content: budgetFeedback(cost, plannedStops(state), state.candidates, form.groupSize) },
      ])
      const cheaperState = draftOf(cheaper)
      const cheaperTotal = costSummary(plannedStops(cheaperState), form).total
      console.info(`[ai] clone: budget round ${cost.total} → ${cheaperTotal} (budget ${form.budget})`)
      if (cheaperTotal < cost.total) {
        plan = cheaper
        state = cheaperState
      }
    } catch (error) {
      // The first plan stands, with its over-budget warning.
      console.warn(`[ai] clone: budget round failed: ${(error as Error).message}`)
    }
  }

  return AiDraft.create({
    userId,
    sourcePostIds: journeys.map((j) => j.postId),
    destinationId: destination ? String(destination._id) : null,
    formInput: form,
    season,
    plan,
    candidates: state.candidates,
    sourceStops: state.sourceStops,
    changes: state.changes,
    nextChange: state.nextChange,
  })
}

export async function chatEdit(
  state: DraftState,
  message: string,
  history: { role: string; content: string }[],
): Promise<{ state: DraftState; reply: string }> {
  const output = await generateStructured({
    chat,
    task: 'chat',
    system: CHAT_SYSTEM,
    messages: [{ role: 'user', content: chatInput(state, message, history) }],
    schema: chatOutputSchema,
    check: (out) => validatePatches(state, out),
  })
  return { state: output.patches.length ? applyPatches(state, output.patches) : state, reply: output.reply }
}
