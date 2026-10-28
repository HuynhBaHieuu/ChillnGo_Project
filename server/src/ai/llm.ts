/**
 * The models behind the AI assistant and AI clone, tried in order: Muse, then
 * LiveKit Inference, then Google Gemini. When one fails (out of tokens,
 * overloaded, unreachable) the next is asked; one not configured is left out.
 * All speak OpenAI-style chat completions, so one request shape serves them all.
 *
 * After a 429 or 402 (out of quota or credit) a model is skipped for as long
 * as it asked (else a minute), so a spent quota does not add a failed call to
 * every request. Every clone call logs its provider, model, token usage and time.
 */

import { env } from '../env.js'
import { INFERENCE_CHAT_URL, inferenceToken } from '../lib/livekit.js'
import { AiUnavailableError } from './aiService.js'
import { AI_CONFIG } from './config.js'
import type { ChatMessage } from './aiService.js'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const TIMEOUT_MS = 90_000
const TEMPERATURE = 0.2

export interface Provider {
  name: 'muse' | 'livekit' | 'gemini'
  url: string
  key: string
  model: string
}

const pausedUntil = new Map<Provider['name'], number>()

/** The models to ask, in order. Paused ones are left out, unless every one is paused. */
export async function providers(): Promise<Provider[]> {
  const all: Provider[] = []
  if (env.muse) all.push({ name: 'muse', url: env.muse.url, key: env.muse.apiKey, model: env.muse.model })
  const token = await inferenceToken()
  if (token) all.push({ name: 'livekit', url: INFERENCE_CHAT_URL, key: token, model: env.assistantModel })
  if (env.gemini) all.push({ name: 'gemini', url: GEMINI_URL, key: env.gemini.apiKey, model: env.gemini.model })
  const ready = all.filter((p) => Date.now() >= (pausedUntil.get(p.name) ?? 0))
  return ready.length > 0 ? ready : all
}

/** Out of quota or credit: skip this model until it says it is back. */
export function pauseIfSpent(provider: Provider, response: Response, body: string): void {
  if (response.status === 429 || response.status === 402) pausedUntil.set(provider.name, Date.now() + retryAfterMs(response, body))
}

/** How long a 429 asks us to wait: Retry-After, or Google's RetryInfo ("37s"); a minute if neither. */
function retryAfterMs(response: Response, body: string): number {
  const header = Number(response.headers.get('retry-after'))
  if (header > 0) return header * 1000
  const delay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body)
  return delay ? Math.min(Number(delay[1]) * 1000, 24 * 3600_000) : 60_000
}

async function complete(provider: Provider, messages: ChatMessage[], task: string): Promise<string> {
  const started = Date.now()
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' },
      ...(provider.name === 'gemini' && { reasoning_effort: AI_CONFIG.geminiReasoning[task] ?? 'low' }),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    pauseIfSpent(provider, response, body)
    throw new Error(`HTTP ${response.status}: ${body.replace(/\s+/g, ' ').slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  console.info(
    `[ai] task=${task} provider=${provider.name} model=${provider.model} tokens in=${data.usage?.prompt_tokens ?? '?'} out=${data.usage?.completion_tokens ?? '?'} ${Date.now() - started}ms`,
  )
  if (!text.trim()) throw new Error('empty reply')
  return text
}

export async function chat(messages: ChatMessage[], task: string): Promise<string> {
  const list = await providers()
  if (list.length === 0) throw new AiUnavailableError('No AI model configured (Muse, LiveKit Inference, Gemini).')
  for (const provider of list) {
    try {
      return await complete(provider, messages, task)
    } catch (error) {
      console.warn(`[ai] task=${task} ${provider.name} failed: ${(error as Error).message}`)
    }
  }
  throw new AiUnavailableError()
}
