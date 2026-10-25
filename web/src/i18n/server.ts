/**
 * Translates text the API composes in Vietnamese: error messages, and the
 * notification lines it stores ("đã thích hành trình “…”"). Fixed strings
 * are looked up as they are; templated ones are matched by pattern and
 * their values carried over. Anything unknown comes back unchanged.
 */

import { t, tx } from '@/i18n'
import type { MessageKey, Params } from '@/i18n'

type Rule = [pattern: RegExp, toKey: (m: RegExpMatchArray) => [MessageKey, Params?]]

/** Server notifications write “của bạn” / “của họ” in place of an empty title. */
const NO_TITLE = new Set(['của bạn', 'của họ'])

const RULES: Rule[] = [
  [/^đã thích hành trình “(.*)”$/s, (m) => (NO_TITLE.has(m[1]) ? ['đã thích hành trình của bạn'] : ['đã thích hành trình “{title}”', { title: m[1] }])],
  [/^đang phát trực tiếp: “(.*)”$/s, (m) => ['đang phát trực tiếp: “{title}”', { title: m[1] }]],
  [/^đã trả lời bình luận của bạn: “(.*)”$/s, (m) => ['đã trả lời bình luận của bạn: “{text}”', { text: m[1] }]],
  [/^đã bình luận hành trình “(.*?)”: “(.*)”$/s, (m) => ['đã bình luận hành trình “{title}”: “{text}”', { title: m[1], text: m[2] }]],
  [/^mời bạn đi cùng hành trình “(.*)”$/s, (m) => (NO_TITLE.has(m[1]) ? ['mời bạn đi cùng hành trình của họ'] : ['mời bạn đi cùng hành trình “{title}”', { title: m[1] }])],
  [/^đã nhận lời đi cùng hành trình “(.*)”$/s, (m) => (NO_TITLE.has(m[1]) ? ['đã nhận lời đi cùng hành trình của bạn'] : ['đã nhận lời đi cùng hành trình “{title}”', { title: m[1] }])],
  [/^đã clone hành trình “(.*)” bằng AI$/s, (m) => (NO_TITLE.has(m[1]) ? ['đã clone hành trình của bạn bằng AI'] : ['đã clone hành trình “{title}” bằng AI', { title: m[1] }])],
  [/^đã clone hành trình “(.*)”$/s, (m) => (NO_TITLE.has(m[1]) ? ['đã clone hành trình của bạn'] : ['đã clone hành trình “{title}”', { title: m[1] }])],
  [/^đã clone lịch trình (.*) của bạn$/s, (m) => ['đã clone lịch trình {title} của bạn', { title: m[1] }]],
  [/^Bản nháp “(.*)” chưa được đăng\. Hoàn thiện để chia sẻ nhé\.$/s, (m) => ['Bản nháp “{title}” chưa được đăng. Hoàn thiện để chia sẻ nhé.', { title: m[1] }]],
  [/^Đã gửi email xác nhận mới tới (.*)\.$/s, (m) => ['Đã gửi email xác nhận mới tới {email}.', { email: m[1] }]],
  [/^Đã gửi mật khẩu tạm thời tới (.*)\.$/s, (m) => ['Đã gửi mật khẩu tạm thời tới {email}.', { email: m[1] }]],
  [/^Email vừa được gửi\. Vui lòng đợi (\d+) giây rồi thử lại\.$/, (m) => ['Email vừa được gửi. Vui lòng đợi {n} giây rồi thử lại.', { n: Number(m[1]) }]],
  [/^Tài khoản của bạn đã bị khoá: (.*)\. Liên hệ quản trị viên/s, (m) => ['Tài khoản của bạn đã bị khoá: {reason}. Liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn.', { reason: m[1] }]],
  [/^Hành trình “(.*)” chưa có điểm dừng nào\.$/s, (m) => ['Hành trình “{title}” chưa có điểm dừng nào.', { title: m[1] }]],
  [/^Clone từ hành trình “(.*)”\.$/s, (m) => ['Clone từ hành trình “{title}”.', { title: m[1] }]],
  [/^Bản nháp chỉ có (\d+) ngày\.$/, (m) => ['Bản nháp chỉ có {n} ngày.', { n: Number(m[1]) }]],
  [/^Tối đa (\d+) ảnh$/, (m) => ['Tối đa {n} ảnh', { n: Number(m[1]) }]],
  [/^Mỗi hành trình mời tối đa (\d+) người đi cùng\.$/, (m) => ['Mỗi hành trình mời tối đa {n} người đi cùng.', { n: Number(m[1]) }]],
]

export function translateServerMessage(message: string): string {
  const exact = tx(message)
  if (exact !== message) return exact
  for (const [pattern, toKey] of RULES) {
    const match = message.match(pattern)
    if (match) {
      const [key, params] = toKey(match)
      return t(key, params)
    }
  }
  return message
}
