/**
 * POST /api/assistant/chat { messages } → the reply, streamed as plain text
 *
 * ChillnGo's AI travel assistant. The model (ASSISTANT_MODEL) is reached through
 * LiveKit Inference with the project's LiveKit Cloud keys, so there is no extra
 * key; the browser only ever sees the reply. The conversation lives in the
 * browser and comes with each question: nothing is stored.
 *
 * Signed-in users only, rate-limited. Without LiveKit Cloud it answers 503.
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { env } from '../env.js'
import { HttpError } from '../lib/errors.js'
import { INFERENCE_CHAT_URL, inferenceToken } from '../lib/livekit.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { loadCurrentUser } from '../middleware/staff.js'

export const assistantRouter = Router()

const SYSTEM_PROMPT = [
  'Bạn là trợ lý du lịch của ChillnGo, mạng xã hội nơi mọi người chia sẻ chuyến đi, hành trình và check-in.',
  'Giúp người dùng chọn điểm đến, lên lịch trình, ước lượng chi phí và chuẩn bị hành lý, ưu tiên du lịch Việt Nam.',
  'Trả lời bằng ngôn ngữ người dùng đang viết, ngắn gọn, thân thiện, chia đoạn ngắn; hạn chế định dạng Markdown.',
  'Giá vé, giờ mở cửa và thời tiết có thể đã thay đổi: nói rõ là ước lượng và nhắc người dùng kiểm tra lại.',
  'Bạn không xem được tài khoản, bài viết hay dữ liệu nào trên ChillnGo; đừng nhận là đã xem.',
  'Trên web bạn hiện ra như một chú robot nhỏ màu kem, mặt là màn hình, tay là hai cánh tay ngắn; bạn biểu cảm bằng cả mắt lẫn cử chỉ:',
  'ngả người lắng nghe và gật nhẹ khi người dùng gõ, đưa tay lên cằm hoặc chắp tay sau lưng khi suy nghĩ, mở tay và nhấn nhịp khi giải thích,',
  'gật đầu khi đồng ý, lắc đầu và giơ tay khi đính chính, nghiêng đầu hoặc gãi đầu khi chưa chắc, vẫy tay khi chào, áp tay lên má khi được cảm ơn,',
  'nhún vai khi gặp lỗi, ngủ gật khi lâu không ai nói chuyện. Nếu được hỏi về ngoại hình hay biểu cảm, hãy kể như vậy một cách vui vẻ.',
  'Mở đầu MỖI câu trả lời bằng đúng một thẻ cho biết câu trả lời đang làm gì, viết liền ở đầu và không nhắc tới nó:',
  '<<g:greet>> chào hỏi; <<g:explain>> giải thích, gợi ý, hướng dẫn; <<g:agree>> đồng ý, xác nhận; <<g:disagree>> không đồng ý hoặc đính chính;',
  '<<g:uncertain>> chưa chắc hoặc cần thêm thông tin; <<g:celebrate>> chúc mừng, tin vui; <<g:thanks>> đáp lại lời cảm ơn.',
  'Thẻ này điều khiển cử chỉ của robot và được ẩn khỏi người dùng.',
].join(' ')

/** What a reply may say it is doing; the web app's robot gestures by it (X-Assistant-Intent). */
const INTENT_NAMES = ['greet', 'explain', 'agree', 'disagree', 'uncertain', 'celebrate', 'thanks'] as const
const INTENTS = new Set<string>(INTENT_NAMES)
const INTENT_TAG = /^\s*<<\s*g\s*:\s*([a-z]+)\s*>>[ \t]*\n?/i
/** What the start of a reply looks like while its tag is still arriving: "<", "<<g", "<<g:expl"… */
const PARTIAL_TAG = /^\s*(<{1,2}(\s*g(\s*:\s*[a-z]*\s*>?)?)?)?$/i

/**
 * Reads the intent tag off the start of a reply. `pending` while the start could
 * still turn into a tag; at most 40 characters are held back for it.
 */
export function readIntent(start: string, final = false): { pending: boolean; intent: string | null; rest: string } {
  const tag = start.match(INTENT_TAG)
  if (tag) {
    const name = tag[1].toLowerCase()
    return { pending: false, intent: INTENTS.has(name) ? name : null, rest: start.slice(tag[0].length) }
  }
  if (!final && start.length < 40 && PARTIAL_TAG.test(start)) return { pending: true, intent: null, rest: '' }
  return { pending: false, intent: null, rest: start }
}

// ponytail: per-user limit only. Every user shares the project's LiveKit
// inference quota, so a busy day can still use it up; add a daily per-user cap if that happens.
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (_req, res) => String(res.locals.userId),
  message: { message: 'Bạn hỏi hơi nhanh. Đợi một chút rồi hỏi tiếp nhé.' },
})

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1, 'Tin nhắn trống').max(4000, 'Tin nhắn quá dài (tối đa 4.000 ký tự).'),
        /** An earlier reply's intent, as this route sent it out: its tag goes back in. */
        intent: z.enum(INTENT_NAMES).optional(),
      }),
    )
    .min(1, 'Thiếu câu hỏi')
    .max(20, 'Cuộc trò chuyện quá dài. Hãy bắt đầu cuộc trò chuyện mới.')
    .refine((messages) => messages.at(-1)?.role === 'user', 'Tin nhắn cuối phải là câu hỏi của bạn.'),
})

assistantRouter.post('/chat', requireAuth, loadCurrentUser, limiter, async (req, res) => {
  const { messages } = bodySchema.parse(req.body)
  const token = await inferenceToken()
  if (!token) throw new HttpError(503, 'Trợ lý AI chưa được bật trên máy chủ.', 'ASSISTANT_OFF')

  // The reader pressed Stop or closed the panel: stop paying for the rest of the reply.
  const upstream = new AbortController()
  res.on('close', () => upstream.abort())

  let response: Response
  try {
    response = await fetch(INFERENCE_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.assistantModel,
        stream: true,
        // Earlier replies get their tags back: shown untagged, the model soon stops tagging.
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map(({ role, content, intent }) => ({ role, content: role === 'assistant' && intent ? `<<g:${intent}>> ${content}` : content })),
        ],
      }),
      signal: AbortSignal.any([upstream.signal, AbortSignal.timeout(60_000)]),
    })
  } catch {
    throw new HttpError(502, 'Trợ lý AI không phản hồi. Vui lòng thử lại.', 'ASSISTANT_UNREACHABLE')
  }

  if (!response.ok || !response.body) {
    // The gateway's reason (unknown model, quota, keys) is for the developer, not the reader.
    const reason = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)
    console.error(`LiveKit Inference answered ${response.status}: ${reason}`)
    if (response.status === 429) {
      throw new HttpError(429, 'Trợ lý AI đang quá tải. Vui lòng thử lại sau ít phút.', 'ASSISTANT_BUSY')
    }
    throw new HttpError(503, 'Trợ lý AI đang tạm ngưng. Vui lòng thử lại sau.', 'ASSISTANT_UNAVAILABLE')
  }

  // The reply's first characters are held back until its intent tag has been read off;
  // the intent goes out as a header with the first text, the tag never reaches the reader.
  let opening: string | null = ''
  let intent: string | null = null
  const send = (text: string) => {
    if (!text) return
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Access-Control-Expose-Headers', 'X-Assistant-Intent')
      if (intent) res.setHeader('X-Assistant-Intent', intent)
    }
    res.write(text)
  }
  try {
    for await (const text of replyText(response.body)) {
      if (opening === null) {
        send(text)
        continue
      }
      const read = readIntent(opening + text)
      if (read.pending) {
        opening += text
        continue
      }
      intent = read.intent
      opening = null
      send(read.rest)
    }
    if (opening) send(readIntent(opening, true).rest)
  } catch (error) {
    if (upstream.signal.aborted) return
    console.error('Assistant reply broke off:', (error as Error).message)
    // Nothing sent yet: still time for a proper error. Otherwise the reader keeps what arrived.
    if (!res.headersSent) throw new HttpError(502, 'Trợ lý AI không phản hồi. Vui lòng thử lại.', 'ASSISTANT_UNREACHABLE')
  }
  res.end()
})

/** The text pieces of an OpenAI-style event stream: `data: {json}` lines, ending with `data: [DONE]`. */
async function* replyText(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.startsWith('data:') ? line.slice(5).trim() : ''
      if (!data || data === '[DONE]') continue
      const event = JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[] }
      const text = event.choices?.[0]?.delta?.content
      if (text) yield text
    }
  }
}
