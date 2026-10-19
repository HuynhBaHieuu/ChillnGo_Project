/**
 * Structured answers from the model: ask, read its JSON, check it against the
 * schema and the request's own rules, and on any problem send the problems
 * back and ask again, a bounded number of times. Nothing unchecked leaves here.
 *
 * Which model answers is llm.ts's business (`chat`); this file takes it as an
 * argument, so tests run it against a fake.
 */

import type { z } from 'zod'

import { AI_CONFIG } from './config.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** One model call: the conversation in, the reply's text out. `task` is for the logs. */
export type ChatFn = (messages: ChatMessage[], task: string) => Promise<string>

/** No model could be reached (both providers down, out of quota or not configured). */
export class AiUnavailableError extends Error {
  constructor(message = 'No AI provider answered.') {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

/** The model kept answering something unusable. */
export class AiOutputError extends Error {
  problems: string[]

  constructor(problems: string[]) {
    super(`AI output rejected: ${problems.slice(0, 3).join(' | ')}`)
    this.name = 'AiOutputError'
    this.problems = problems
  }
}

/** The JSON object in a reply, even when wrapped in a ``` fence or a sentence. */
export function parseJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end < start) throw new Error('no JSON object')
  return JSON.parse(text.slice(start, end + 1))
}

function problemsOf<S extends z.ZodType>(
  text: string,
  schema: S,
  check: (value: z.infer<S>) => string[],
): { value?: z.infer<S>; problems: string[] } {
  let json: unknown
  try {
    json = parseJson(text)
  } catch {
    return { problems: ['The reply is not a valid JSON object. Answer with the JSON object only.'] }
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.slice(0, 15).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    }
  }
  return { value: parsed.data, problems: check(parsed.data) }
}

export async function generateStructured<S extends z.ZodType>(options: {
  chat: ChatFn
  task: string
  system: string
  messages: ChatMessage[]
  schema: S
  /** The request's own rules (ids, days, times…): problems, or none. */
  check?: (value: z.infer<S>) => string[]
  retries?: number
}): Promise<z.infer<S>> {
  const { chat, task, schema, check = () => [], retries = AI_CONFIG.retries } = options
  const conversation: ChatMessage[] = [{ role: 'system', content: options.system }, ...options.messages]
  let problems: string[] = []

  for (let attempt = 0; attempt <= retries; attempt++) {
    const text = await chat(conversation, task)
    const result = problemsOf(text, schema, check)
    if (result.problems.length === 0) return result.value as z.infer<S>

    problems = result.problems
    console.warn(`[ai] ${task}: answer ${attempt + 1} rejected: ${problems.slice(0, 5).join(' | ')}`)
    conversation.push(
      { role: 'assistant', content: text },
      {
        role: 'user',
        content: `Câu trả lời vừa rồi không hợp lệ:\n- ${problems.join('\n- ')}\nHãy trả lại TOÀN BỘ JSON đã sửa, đúng định dạng, không kèm chữ nào khác.`,
      },
    )
  }
  throw new AiOutputError(problems)
}
