/**
 * The model behind AI clone: Google Gemini first, LiveKit Inference when
 * Gemini fails (out of quota, overloaded, unreachable, not configured). Both
 * speak OpenAI-style chat completions, so one request shape serves both.
 *
 * After a 429 from Gemini it is skipped for as long as it asked (else a
 * minute), so a spent daily quota does not add a failed call to every request.
 * Every call logs its provider, model, token usage and time.
 */

import { env } from '../env.js'
import { INFERENCE_CHAT_URL, inferenceToken } from '../lib/livekit.js'
import { AiUnavailableError } from './aiService.js'
import { AI_CONFIG } from './config.js'
import type { ChatMessage } from './aiService.js'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const TIMEOUT_MS = 90_000
const TEMPERATURE = 0.2

let geminiPausedUntil = 0

class ProviderError extends Error {
  status: number
  retryAfterMs: number

  constructor(status: number, detail: string, retryAfterMs = 60_000) {
    super(`HTTP ${status}: ${detail}`)
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/** How long a 429 asks us to wait: Retry-After, or Google's RetryInfo ("37s"); a minute if neither. */
function retryAfterMs(response: Response, body: string): number {
  const header = Number(response.headers.get('retry-after'))
  if (header > 0) return header * 1000
  const delay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body)
  return delay ? Math.min(Number(delay[1]) * 1000, 24 * 3600_000) : 60_000
}

async function complete(
  provider: string,
  url: string,
  key: string,
  model: string,
  messages: ChatMessage[],
  task: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const started = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: TEMPERATURE, response_format: { type: 'json_object' }, ...extra }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new ProviderError(response.status, body.replace(/\s+/g, ' ').slice(0, 300), retryAfterMs(response, body))
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  console.info(
    `[ai] task=${task} provider=${provider} model=${model} tokens in=${data.usage?.prompt_tokens ?? '?'} out=${data.usage?.completion_tokens ?? '?'} ${Date.now() - started}ms`,
  )
  if (!text.trim()) throw new ProviderError(502, 'empty reply')
  return text
}

export async function chat(messages: ChatMessage[], task: string): Promise<string> {
  const gemini = env.gemini
  if (gemini && Date.now() >= geminiPausedUntil) {
    try {
      return await complete('gemini', GEMINI_URL, gemini.apiKey, gemini.model, messages, task, {
        reasoning_effort: AI_CONFIG.geminiReasoning[task] ?? 'low',
      })
    } catch (error) {
      if (error instanceof ProviderError && error.status === 429) geminiPausedUntil = Date.now() + error.retryAfterMs
      console.warn(`[ai] task=${task} Gemini failed, using LiveKit: ${(error as Error).message}`)
    }
  }

  const token = await inferenceToken()
  if (!token) throw new AiUnavailableError('Gemini unavailable and LiveKit Inference not configured.')
  try {
    return await complete('livekit', INFERENCE_CHAT_URL, token, env.assistantModel, messages, task)
  } catch (error) {
    console.error(`[ai] task=${task} LiveKit Inference failed: ${(error as Error).message}`)
    throw new AiUnavailableError()
  }
}
