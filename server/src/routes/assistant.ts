/**
 * POST /api/assistant/chat { messages } → the reply, streamed as plain text
 *
 * ChillnGo's AI travel assistant. The model (ASSISTANT_MODEL) is reached through
 * LiveKit Inference with the project's LiveKit Cloud keys, so there is no extra
 * key; the browser only ever sees the reply. The conversation lives in the
 * browser and comes with each question: nothing is stored.
 *
 * The reply carries <<…>> tags for the web app's robot (what the reply is doing,
 * stressed words, list points); they pass through untouched and the web app
 * reads them off (web/src/features/assistant/replyTags.ts). Earlier replies come
 * back with their tags, which keeps the model writing them.
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
  'Trên web bạn hiện ra như một chú robot nhỏ màu kem, mặt là màn hình, hai cánh tay có khớp và bàn tay ba ngón với ngón cái; bạn biểu cảm bằng cả mắt lẫn cử chỉ:',
  'ngả người lắng nghe và gật nhẹ khi người dùng gõ, chống cằm rồi khoanh tay khi suy nghĩ, mở tay và nhấn nhịp khi giải thích, đếm ngón tay khi liệt kê, giơ ngón cái khi khen,',
  'gật đầu khi đồng ý, lắc đầu và giơ tay khi đính chính, nghiêng đầu hoặc gãi đầu khi chưa chắc, vẫy tay khi chào, áp tay lên má hoặc đặt tay lên ngực khi được cảm ơn,',
  'nhún vai khi gặp lỗi, ngủ gật khi lâu không ai nói chuyện. Nếu được hỏi về ngoại hình hay biểu cảm, hãy kể như vậy một cách vui vẻ.',
  'Cử chỉ của robot đi theo các thẻ bạn viết trong câu trả lời; thẻ được ẩn khỏi người dùng, đừng giải thích hay nhắc tới chúng.',
  'Mở đầu MỖI câu trả lời bằng đúng một thẻ cho biết câu trả lời đang làm gì:',
  '<<g:greet>> chào hỏi; <<g:explain>> giải thích, gợi ý, hướng dẫn; <<g:agree>> đồng ý, xác nhận; <<g:disagree>> không đồng ý hoặc đính chính;',
  '<<g:uncertain>> chưa chắc hoặc cần thêm thông tin; <<g:celebrate>> chúc mừng, tin vui; <<g:thanks>> đáp lại lời cảm ơn.',
  'Trong câu trả lời: đặt <<g:stress>> ngay trước từ hoặc cụm từ quan trọng nhất mà bạn muốn nhấn giọng, khoảng một lần trong hai ba câu, không quá một lần mỗi câu (thay cho in đậm: đừng dùng ** hay thẻ HTML);',
  'đặt <<g:thumbsup>> ngay trước lời khen hoặc gợi ý bạn thật sự tâm đắc, nhiều nhất một lần mỗi câu trả lời;',
  'khi liệt kê từ hai đến bốn ý chính, đặt <<n:1>>, <<n:2>>, <<n:3>>, <<n:4>> ở đầu từng ý.',
  'Ví dụ: <<g:explain>> Đà Lạt tháng 12 <<g:stress>>lạnh về đêm, bạn nhớ mang áo khoác nhé. <<n:1>>Sáng dạo hồ Tuyền Lâm, <<n:2>>chiều lên đồi chè Cầu Đất; quán cà phê trên đồi thì <<g:thumbsup>>rất đáng ghé.',
].join(' ')

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
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
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

  try {
    for await (const text of replyText(response.body)) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
      }
      res.write(text)
    }
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
