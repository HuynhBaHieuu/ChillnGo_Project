/**
 * The conversation with the AI travel assistant.
 *
 * A store rather than component state, so it survives page changes (the home
 * page swaps the whole navbar). Kept in memory only: a reload starts over, and
 * signing out or switching accounts clears it.
 */

import { create } from 'zustand'

import { assistantService } from '@/services'
import type { AssistantMessage } from '@/services/assistant.service'
import { useAuthStore } from '@/store/auth.store'

export interface ChatMessage extends AssistantMessage {
  id: number
}

/** Odd, so the slice of a question/answer history still starts with a question. The server takes 20. */
const SENT_HISTORY = 19

interface AssistantState {
  messages: ChatMessage[]
  busy: boolean
  error: string | null
  /** False when the question was not answered, so the composer can give the text back. */
  send: (text: string) => Promise<boolean>
  stop: () => void
  clear: () => void
}

let inFlight: AbortController | null = null
let nextId = 0

export const useAssistantStore = create<AssistantState>()((set, get) => ({
  messages: [],
  busy: false,
  error: null,

  async send(text) {
    if (get().busy) return false
    const question: ChatMessage = { id: ++nextId, role: 'user', content: text }
    const replyId = ++nextId
    const history = [...get().messages, question]
    set({ messages: [...history, { id: replyId, role: 'assistant', content: '' }], busy: true, error: null })

    const replyText = () => get().messages.find((m) => m.id === replyId)?.content ?? ''
    // Drops an unanswered question with its empty reply, so the history keeps alternating.
    const dropExchange = () =>
      set((s) => ({ messages: s.messages.filter((m) => m.id !== question.id && m.id !== replyId) }))

    const controller = new AbortController()
    inFlight = controller
    try {
      await assistantService.streamReply(
        history.slice(-SENT_HISTORY).map(({ role, content, intent }) => ({ role, content, ...(intent && { intent }) })),
        (piece) =>
          set((s) => ({ messages: s.messages.map((m) => (m.id === replyId ? { ...m, content: m.content + piece } : m)) })),
        controller.signal,
        (intent) => set((s) => ({ messages: s.messages.map((m) => (m.id === replyId ? { ...m, intent } : m)) })),
      )
      if (replyText().trim()) return true
      dropExchange()
      set({ error: 'Trợ lý chưa trả lời được câu này. Bạn thử hỏi cách khác nhé.' })
      return false
    } catch (error) {
      if (controller.signal.aborted) {
        // Stopped on purpose: keep whatever part of the answer arrived.
        if (!replyText().trim()) dropExchange()
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
    set({ messages: [], error: null })
  },
}))

// A conversation belongs to whoever had it.
useAuthStore.subscribe((state, previous) => {
  if (state.user?._id !== previous.user?._id) useAssistantStore.getState().clear()
})
