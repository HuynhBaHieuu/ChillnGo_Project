/**
 * Sent when someone asks to reset a forgotten password. Same look as verifyEmail.ts.
 */

import { RESET_TTL_MINUTES } from '../lib/verification.js'
import type { MailMessage } from '../lib/mailer.js'

interface ResetPasswordInput {
  to: string
  displayName: string
  username: string
  resetUrl: string
}

const INK = '#1A0B3C'
const INK_SOFT = '#4A3F66'
const MUTED = '#6A5C8A'
const SUNSET = '#FF3DA5'
const SUNSET_INK = '#D60072'
const PAGE = '#FFF0F6'
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function resetPasswordMessage(input: ResetPasswordInput): MailMessage {
  const name = escapeHtml(input.displayName)
  const username = escapeHtml(input.username)
  const email = escapeHtml(input.to)
  const url = escapeHtml(input.resetUrl)
  const year = new Date().getFullYear()

  const subject = 'Đặt lại mật khẩu tài khoản ChillnGo'
  const preheader = 'Bấm nút trong email để đặt mật khẩu mới cho tài khoản ChillnGo của bạn.'

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAGE};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:0 0 24px 0;">
            <span style="font-family:'Arial Black','Segoe UI Black',${FONT};font-size:30px;font-weight:900;letter-spacing:1px;color:${INK};">ChillnGo</span>
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;border:2px solid ${INK};border-radius:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:40px 40px 8px 40px;font-family:${FONT};">
                  <p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${SUNSET_INK};">Đặt lại mật khẩu</p>
                  <h1 style="margin:0 0 24px 0;font-size:26px;line-height:1.3;font-weight:800;color:${INK};">Tạo mật khẩu mới cho tài khoản của bạn</h1>
                  <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:${INK_SOFT};">Xin chào <strong style="color:${INK};">${name}</strong>,</p>
                  <p style="margin:0;font-size:16px;line-height:1.6;color:${INK_SOFT};">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong style="color:${INK};">@${username}</strong>. Bấm nút bên dưới để đặt mật khẩu mới.</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:32px 40px;">
                  <a href="${url}" target="_blank" style="display:inline-block;padding:16px 40px;font-family:${FONT};font-size:16px;font-weight:700;color:${INK};text-decoration:none;background-color:${SUNSET};border:2px solid ${INK};border-radius:999px;">Đặt lại mật khẩu</a>
                  <p style="margin:16px 0 0 0;font-family:${FONT};font-size:13px;color:${MUTED};">Liên kết có hiệu lực trong ${RESET_TTL_MINUTES} phút và chỉ dùng được một lần.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="border-top:1px solid #EADCE6;font-size:0;line-height:0;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 40px 0 40px;font-family:${FONT};">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${MUTED};">Nút không hoạt động, hoặc bạn đang dùng ứng dụng ChillnGo? Sao chép liên kết sau, rồi dán vào trình duyệt hoặc màn hình "Đặt lại mật khẩu" trong ứng dụng:</p>
                  <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${url}" target="_blank" style="color:${SUNSET_INK};text-decoration:underline;">${url}</a></p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 40px 40px 40px;font-family:${FONT};">
                  <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};"><strong style="color:${INK_SOFT};">Không phải bạn yêu cầu?</strong> Hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 24px 0 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
            Email tự động từ ChillnGo, gửi tới ${email}.<br>
            Vui lòng không trả lời email này.<br>
            &copy; ${year} ChillnGo
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  const text = [
    `Xin chào ${input.displayName},`,
    '',
    `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản @${input.username}.`,
    'Mở liên kết sau để đặt mật khẩu mới. Nếu dùng ứng dụng ChillnGo, bạn có thể dán liên kết vào màn hình "Đặt lại mật khẩu":',
    input.resetUrl,
    '',
    `Liên kết có hiệu lực trong ${RESET_TTL_MINUTES} phút và chỉ dùng được một lần.`,
    '',
    'Không phải bạn yêu cầu? Hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.',
    '',
    '— ChillnGo',
  ].join('\n')

  return { to: input.to, subject, html, text }
}
