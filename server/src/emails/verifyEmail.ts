/**
 * The "confirm your email" message sent after sign-up.
 *
 * Built with tables and inline styles because that is the only layout most
 * mail clients (Gmail, Outlook) render reliably. Colours are the web app's:
 * ink #1A0B3C, sunset #FF3DA5 and the pale pink page background #FFF0F6.
 */

import { VERIFY_TTL_HOURS } from '../lib/verification.js'
import type { MailMessage } from '../lib/mailer.js'

interface VerifyEmailInput {
  to: string
  displayName: string
  username: string
  verifyUrl: string
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

export function verifyEmailMessage(input: VerifyEmailInput): MailMessage {
  const name = escapeHtml(input.displayName)
  const username = escapeHtml(input.username)
  const email = escapeHtml(input.to)
  const url = escapeHtml(input.verifyUrl)
  const year = new Date().getFullYear()

  const subject = 'Xác nhận email đăng ký tài khoản ChillnGo'
  const preheader = 'Bấm nút trong email để xác nhận địa chỉ email và kích hoạt tài khoản ChillnGo của bạn.'

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAGE};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

        <!-- Wordmark -->
        <tr>
          <td align="center" style="padding:0 0 24px 0;">
            <span style="font-family:'Arial Black','Segoe UI Black',${FONT};font-size:30px;font-weight:900;letter-spacing:1px;color:${INK};">ChillnGo</span>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background-color:#FFFFFF;border:2px solid ${INK};border-radius:20px;box-shadow:6px 6px 0 ${INK};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:40px 40px 8px 40px;font-family:${FONT};">
                  <p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${SUNSET_INK};">Xác nhận địa chỉ email</p>
                  <h1 style="margin:0 0 24px 0;font-size:26px;line-height:1.3;font-weight:800;color:${INK};">Chỉ còn một bước nữa để bắt đầu hành trình</h1>
                  <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:${INK_SOFT};">Xin chào <strong style="color:${INK};">${name}</strong>,</p>
                  <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:${INK_SOFT};">Cảm ơn bạn đã đăng ký tài khoản ChillnGo. Đây là email <strong style="color:${INK};">xác nhận địa chỉ email</strong> cho tài khoản dưới đây:</p>
                </td>
              </tr>

              <!-- Account summary -->
              <tr>
                <td style="padding:0 40px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};border-radius:14px;">
                    <tr>
                      <td style="padding:16px 20px;font-family:${FONT};font-size:14px;line-height:1.7;color:${INK_SOFT};">
                        <span style="color:${MUTED};">Tên người dùng:</span> <strong style="color:${INK};">@${username}</strong><br>
                        <span style="color:${MUTED};">Email:</span> <strong style="color:${INK};">${email}</strong>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:24px 40px 0 40px;font-family:${FONT};">
                  <p style="margin:0;font-size:16px;line-height:1.6;color:${INK_SOFT};">Bấm nút bên dưới để xác nhận email. Sau khi xác nhận, bạn sẽ được đưa về ChillnGo và đăng nhập ngay.</p>
                </td>
              </tr>

              <!-- Button -->
              <tr>
                <td align="center" style="padding:32px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <!-- Border and fill live on the link, which has the rounded corners;
                             on the cell, some clients draw them as a square box. -->
                        <a href="${url}" target="_blank" style="display:inline-block;padding:16px 40px;font-family:${FONT};font-size:16px;font-weight:700;color:${INK};text-decoration:none;background-color:${SUNSET};border:2px solid ${INK};border-radius:999px;">Xác nhận email</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0 0;font-family:${FONT};font-size:13px;color:${MUTED};">Liên kết có hiệu lực trong ${VERIFY_TTL_HOURS} giờ và chỉ dùng được một lần.</p>
                </td>
              </tr>

              <!-- Fallback link -->
              <tr>
                <td style="padding:0 40px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="border-top:1px solid #EADCE6;font-size:0;line-height:0;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 40px 0 40px;font-family:${FONT};">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${MUTED};">Nút không hoạt động? Sao chép liên kết sau và dán vào trình duyệt:</p>
                  <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${url}" target="_blank" style="color:${SUNSET_INK};text-decoration:underline;">${url}</a></p>
                </td>
              </tr>

              <!-- Safety note -->
              <tr>
                <td style="padding:24px 40px 40px 40px;font-family:${FONT};">
                  <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};"><strong style="color:${INK_SOFT};">Không phải bạn đăng ký?</strong> Bạn có thể bỏ qua email này. Tài khoản sẽ không được kích hoạt nếu email chưa được xác nhận.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:28px 24px 0 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
            Email tự động từ ChillnGo, gửi tới ${email} vì địa chỉ này vừa được dùng để đăng ký tài khoản.<br>
            Vui lòng không trả lời email này.<br>
            &copy; ${year} ChillnGo &middot; Review &amp; clone hành trình du lịch
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
    'Cảm ơn bạn đã đăng ký tài khoản ChillnGo. Đây là email xác nhận địa chỉ email cho tài khoản:',
    `  Tên người dùng: @${input.username}`,
    `  Email: ${input.to}`,
    '',
    'Mở liên kết sau để xác nhận email và đăng nhập vào ChillnGo:',
    input.verifyUrl,
    '',
    `Liên kết có hiệu lực trong ${VERIFY_TTL_HOURS} giờ và chỉ dùng được một lần.`,
    '',
    'Không phải bạn đăng ký? Hãy bỏ qua email này. Tài khoản sẽ không được kích hoạt nếu email chưa được xác nhận.',
    '',
    '— ChillnGo',
  ].join('\n')

  return { to: input.to, subject, html, text }
}
