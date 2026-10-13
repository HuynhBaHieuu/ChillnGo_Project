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
  content: string
  /** Replies only: what the reply is doing (the robot gestures by it). Sent back so the model keeps tagging. */
  intent?: AssistantIntent | null
}

/**
 * What a reply is doing, as the model tags it (the server passes it on in the
 * X-Assistant-Intent header). The robot's gestures follow it.
 */
export const INTENTS = ['greet', 'explain', 'agree', 'disagree', 'uncertain', 'celebrate', 'thanks'] as const
export type AssistantIntent = (typeof INTENTS)[number]

const isIntent = (value: string | null): value is AssistantIntent => INTENTS.includes(value as AssistantIntent)

/**
 * Sends the conversation, calls `onIntent` once with what the reply is doing
 * (null when the model gave no tag), then `onText` with each piece as it arrives.
 */
export async function streamReply(
  messages: AssistantMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
  onIntent?: (intent: AssistantIntent | null) => void,
): Promise<void> {
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

  const intent = response.headers.get('X-Assistant-Intent')
  onIntent?.(isIntent(intent) ? intent : null)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    // stream: true keeps a Vietnamese character split across two chunks whole.
    onText(decoder.decode(value, { stream: true }))
  }
}
