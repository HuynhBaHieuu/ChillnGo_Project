/**
 * The preparation checklist, from data alone. The trip's tags (`all`, its
 * places' categories and Place.tags, `outdoor`, the season's `rainy`/`peak`,
 * the group's `kids`/`elderly`) pick ChecklistTemplate items, and every place
 * that needs booking is listed first, under "Đặt trước". The model may only
 * order the template items and sort them under the given headings: an id or
 * heading it was not given is rejected, and anything it leaves out is put
 * back, so nothing is lost and nothing is added.
 */

import { z } from 'zod'

import { generateStructured } from './aiService.js'
import type { ChatFn } from './aiService.js'
import { plannedStops } from './draft.js'
import type { DraftState } from './draft.js'
import { CHECKLIST_SYSTEM } from './prompts.js'

export interface ChecklistItem {
  id: string
  text: string
  group: string
}

export interface Checklist {
  groups: { group: string; items: { id: string; text: string }[] }[]
  /** False when the AI could not order it (or no AI request was left): template order. */
  sortedByAi: boolean
}

export const BOOKING_GROUP = 'Đặt trước'

/** What kind of trip this is, as far as the data says. */
export function tripTags(state: DraftState): string[] {
  const tags = new Set(['all'])
  for (const { place } of plannedStops(state)) {
    if (place.category) tags.add(place.category)
    for (const tag of place.tags ?? []) tags.add(tag)
    if (place.isOutdoor) tags.add('outdoor')
  }
  if (state.season?.rainy) tags.add('rainy')
  if (state.season?.peak) tags.add('peak')
  if (state.formInput.withChildren) tags.add('kids')
  if (state.formInput.withElderly) tags.add('elderly')
  return [...tags]
}

/** The items this trip needs: matching templates in their order, then the places to book. */
export function checklistItems(templates: { text: string; group: string; tags: string[] }[], state: DraftState): ChecklistItem[] {
  const tags = new Set(tripTags(state))
  const seen = new Set<string>()
  const items: ChecklistItem[] = []
  for (const template of templates) {
    if (!template.tags.some((tag) => tags.has(tag)) || seen.has(template.text)) continue
    seen.add(template.text)
    items.push({ id: `i${items.length + 1}`, text: template.text, group: template.group })
  }
  const booked = new Set<string>()
  for (const { place } of plannedStops(state)) {
    if (place.requiresBooking !== true || booked.has(place.key)) continue
    booked.add(place.key)
    items.push({ id: `b${booked.size}`, text: place.name, group: BOOKING_GROUP })
  }
  return items
}

const isBooking = (item: ChecklistItem) => item.group === BOOKING_GROUP

/** What to book comes first: it has to be done before anything is packed. */
function bookingsFirst(groups: Checklist['groups'], items: ChecklistItem[]): Checklist['groups'] {
  const bookings = items.filter(isBooking).map(({ id, text }) => ({ id, text }))
  return bookings.length ? [{ group: BOOKING_GROUP, items: bookings }, ...groups] : groups
}

/** Grouped by each item's own heading, headings in the order they first appear. */
export function defaultChecklist(items: ChecklistItem[]): Checklist {
  const groups: Checklist['groups'] = []
  for (const item of items.filter((i) => !isBooking(i))) {
    let group = groups.find((g) => g.group === item.group)
    if (!group) groups.push((group = { group: item.group, items: [] }))
    group.items.push({ id: item.id, text: item.text })
  }
  return { groups: bookingsFirst(groups, items), sortedByAi: false }
}

export const checklistOutputSchema = z.strictObject({
  groups: z.array(z.strictObject({ group: z.string(), itemIds: z.array(z.string()) })).max(20),
})

export type ChecklistOutput = z.infer<typeof checklistOutputSchema>

/** `items`: the template items the model was given (no bookings). */
export function validateChecklist(output: ChecklistOutput, items: ChecklistItem[]): string[] {
  const ids = new Set(items.map((i) => i.id))
  const headings = new Set(items.map((i) => i.group))
  const used = new Set<string>()
  const problems: string[] = []
  for (const group of output.groups) {
    if (!headings.has(group.group)) problems.push(`group "${group.group}" is not one of the given groups; use only those.`)
    for (const id of group.itemIds) {
      if (!ids.has(id)) problems.push(`itemId "${id}" is not a given item; never add items.`)
      else if (used.has(id)) problems.push(`itemId "${id}" is listed twice.`)
      used.add(id)
    }
  }
  return problems
}

/** The model's order of the template items, with what it left out put back, after the bookings. */
export function applyChecklist(output: ChecklistOutput, allItems: ChecklistItem[]): Checklist {
  const items = allItems.filter((i) => !isBooking(i))
  const byId = new Map(items.map((i) => [i.id, i]))
  const groups: Checklist['groups'] = []
  const placed = new Set<string>()
  const groupNamed = (name: string) => {
    let group = groups.find((g) => g.group === name)
    if (!group) groups.push((group = { group: name, items: [] }))
    return group
  }
  for (const { group, itemIds } of output.groups) {
    for (const id of itemIds) {
      const item = byId.get(id)
      if (!item || placed.has(id)) continue
      placed.add(id)
      groupNamed(group).items.push({ id, text: item.text })
    }
  }
  for (const item of items) if (!placed.has(item.id)) groupNamed(item.group).items.push({ id: item.id, text: item.text })
  return { groups: bookingsFirst(groups.filter((g) => g.items.length > 0), allItems), sortedByAi: true }
}

/** Asks the model to order the template items for this trip. Throws as generateStructured does. */
export async function sortChecklist(chat: ChatFn, allItems: ChecklistItem[], state: DraftState): Promise<Checklist> {
  const items = allItems.filter((i) => !isBooking(i))
  const form = state.formInput
  const input = {
    trip: {
      days: form.days,
      groupSize: form.groupSize,
      withChildren: form.withChildren || undefined,
      withElderly: form.withElderly || undefined,
      rainySeason: state.season?.rainy || undefined,
      peakSeason: state.season?.peak || undefined,
      tags: tripTags(state),
    },
    groups: [...new Set(items.map((i) => i.group))],
    items,
  }
  const output = await generateStructured({
    chat,
    task: 'checklist',
    system: CHECKLIST_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    schema: checklistOutputSchema,
    check: (o) => validateChecklist(o, items),
  })
  return applyChecklist(output, allItems)
}
