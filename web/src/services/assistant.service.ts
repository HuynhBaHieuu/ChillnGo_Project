/**
 * The AI travel assistant (server/src/routes/assistant.ts).
 *
 * The reply streams in as plain text, so this reads the response body itself
 * instead of going through `http()`, which waits for one whole JSON body.
 */

import { useAuthStore } from '@/store/auth.store'

import { ApiError } from './client'
import { apiUrl } from './http'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  /** Replies as the model wrote them, with the gesture tags the web app reads off (features/assistant/replyTags.ts). */
  content: string
}

/** Sends the conversation and calls `onText` with each piece of the reply as it arrives. */
export async function streamReply(messages: AssistantMessage[], onText: (text: string) => void, signal: AbortSignal): Promise<void> {
  const token = useAuthStore.getState().token

  let response: Response
  try {
    response = await fetch(apiUrl('/api/assistant/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ messages }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new ApiError('Không kết nối được máy chủ. Vui lòng thử lại sau.', 0)
  }

  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => null)) as { message?: string; code?: string } | null
    // Same as http(): a rejected token means the stored session is dead.
    if (response.status === 401 && token) useAuthStore.getState().signOut()
    throw new ApiError(data?.message ?? `Máy chủ trả về lỗi ${response.status}`, response.status, data?.code)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    // stream: true keeps a Vietnamese character split across two chunks whole.
    onText(decoder.decode(value, { stream: true }))
  }
}
