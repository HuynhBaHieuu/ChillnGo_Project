/**
 * The conversation with the AI travel assistant.
 *
 * A store rather than component state, so it survives page changes (the home
 * page swaps the whole navbar). Kept in memory only: a reload starts over, and
 * signing out or switching accounts clears it.
 *
 * Replies are kept as the model wrote them, gesture tags and all (replyTags.ts);
 * what the reader sees is read off them. The newest reply is "said" at a
 * speaking pace (`spoken`), so the robot's gestures land on the words they
 * were tagged on as those words appear.
 */

import { create } from 'zustand'

import { assistantService } from '@/services'
import type { AssistantMessage } from '@/services/assistant.service'
import { useAuthStore } from '@/store/auth.store'

import { parseReply } from './replyTags'

export interface ChatMessage extends AssistantMessage {
  id: number
}

/** Odd, so the slice of a question/answer history still starts with a question. The server takes 20. */
const SENT_HISTORY = 19
/** Characters a second while saying a reply: a brisk talker. Faster when far behind what has arrived. */
const PACE = 42
const CATCH_UP = 0.6

interface AssistantState {
  messages: ChatMessage[]
  busy: boolean
  error: string | null
  /** How many characters of the newest reply's text have been said so far. */
  spoken: number
  /** False when the question was not answered, so the composer can give the text back. */
  send: (text: string) => Promise<boolean>
  stop: () => void
  clear: () => void
}

let inFlight: AbortController | null = null
let nextId = 0
let speaking: ReturnType<typeof setInterval> | null = null

/** How long the newest reply's text is, if the newest message is a reply. */
export function replyLength(messages: ChatMessage[]) {
  const last = messages.at(-1)
  return last?.role === 'assistant' ? parseReply(last.content).text.length : 0
}

/** Still saying the newest reply: it is arriving, or not all of it has been said. */
export function isTalking(state: Pick<AssistantState, 'busy' | 'messages' | 'spoken'>) {
  return state.busy || state.spoken < replyLength(state.messages)
}

export const useAssistantStore = create<AssistantState>()((set, get) => ({
  messages: [],
  busy: false,
  error: null,
  spoken: 0,

  async send(text) {
    if (get().busy) return false
    const question: ChatMessage = { id: ++nextId, role: 'user', content: text }
    const replyId = ++nextId
    const history = [...get().messages, question]
    // Reduced motion: no typing out, the reply shows as it arrives.
    const spoken = matchMedia('(prefers-reduced-motion: reduce)').matches ? Infinity : 0
    set({ messages: [...history, { id: replyId, role: 'assistant', content: '' }], busy: true, error: null, spoken })
    if (spoken === 0) speak()

    const replyText = () => get().messages.find((m) => m.id === replyId)?.content ?? ''
    // Drops an unanswered question with its empty reply, so the history keeps alternating
    // (and the reply before it, newest again, is not said over).
    const dropExchange = () =>
      set((s) => ({ messages: s.messages.filter((m) => m.id !== question.id && m.id !== replyId), spoken: Infinity }))

    const controller = new AbortController()
    inFlight = controller
    try {
      await assistantService.streamReply(
        history.slice(-SENT_HISTORY).map(({ role, content }) => ({ role, content })),
        (piece) =>
          set((s) => ({ messages: s.messages.map((m) => (m.id === replyId ? { ...m, content: m.content + piece } : m)) })),
        controller.signal,
      )
      if (parseReply(replyText()).text.trim()) return true
      dropExchange()
      set({ error: 'Trợ lý chưa trả lời được câu này. Bạn thử hỏi cách khác nhé.' })
      return false
    } catch (error) {
      if (controller.signal.aborted) {
        // Stopped on purpose: keep whatever part of the answer arrived, all of it shown.
        if (!parseReply(replyText()).text.trim()) dropExchange()
        set({ spoken: Infinity })
        return true
      }
      dropExchange()
      set({ error: (error as Error).message })
      return false
    } finally {
      if (inFlight === controller) inFlight = null
      set({ busy: false })
    }
  },

  stop: () => inFlight?.abort(),

  clear() {
    inFlight?.abort()
    set({ messages: [], error: null, spoken: 0 })
  },
}))

/** Says the newest reply, a few characters every 50 ms, until all of it has arrived and been said. */
function speak() {
  if (speaking) return
  let last = performance.now()
  speaking = setInterval(() => {
    const now = performance.now()
    const dt = (now - last) / 1000
    last = now
    const { messages, spoken, busy } = useAssistantStore.getState()
    const total = replyLength(messages)
    if (spoken >= total) {
      if (!busy && speaking) {
        clearInterval(speaking)
        speaking = null
      }
      return
    }
    const pace = PACE + Math.max(0, total - spoken - 120) * CATCH_UP
    useAssistantStore.setState({ spoken: Math.min(total, spoken + pace * dt) })
  }, 50)
}

// A conversation belongs to whoever had it.
useAuthStore.subscribe((state, previous) => {
  if (state.user?._id !== previous.user?._id) useAssistantStore.getState().clear()
})
