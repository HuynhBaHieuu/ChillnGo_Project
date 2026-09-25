import { createTransport } from 'nodemailer'

import { env } from '../env.js'

export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
}

let transporter: ReturnType<typeof createTransport> | null = null

/**
 * Sends one email over SMTP.
 *
 * Without SMTP settings (local dev only; env.ts refuses to boot on Vercel
 * without them) the plain-text version is printed to the server console
 * instead, so the verification link can be copied from there.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (!env.smtp) {
    console.log(
      [
        '',
        '──── Email (not sent: SMTP is not configured) ────',
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.text,
        '──────────────────────────────────────────────────',
        '',
      ].join('\n'),
    )
    return
  }

  transporter ??= createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  })

  await transporter.sendMail({ from: env.mailFrom, ...message })
}
