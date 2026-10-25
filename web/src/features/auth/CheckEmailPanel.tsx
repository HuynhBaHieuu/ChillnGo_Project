import { MailCheck, MailWarning } from 'lucide-react'

import { ResendVerificationButton } from '@/features/auth/ResendVerificationButton'
import { t } from '@/i18n'
import { tr } from '@/i18n/rich'

interface CheckEmailPanelProps {
  email: string
  /** False when the account exists but the first email failed to send. */
  emailSent: boolean
}

/** Shown after sign-up: where the confirmation email went and what to do next. */
export function CheckEmailPanel({ email, emailSent }: CheckEmailPanelProps) {
  const Icon = emailSent ? MailCheck : MailWarning

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 rounded-2xl bg-muted p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-sunset text-sunset-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 text-sm leading-relaxed">
          {emailSent ? (
            <>
              <p>{t('Chúng tôi đã gửi email xác nhận tới')}</p>
              <p className="break-all font-semibold text-foreground">{email}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">{t('Chưa gửi được email xác nhận')}</p>
              <p>
                {tr('Tài khoản {email} đã được tạo. Bấm nút bên dưới để gửi lại email.', {
                  email: <span className="break-all font-semibold">{email}</span>,
                })}
              </p>
            </>
          )}
        </div>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:font-semibold marker:text-foreground">
        <li>{t('Mở email có tiêu đề “Xác nhận email đăng ký tài khoản ChillnGo”.')}</li>
        <li>
          {tr('Bấm nút {button}. Bạn sẽ được đưa về ChillnGo và đăng nhập ngay.', {
            button: <span className="font-semibold text-foreground">{t('Xác nhận email')}</span>,
          })}
        </li>
      </ol>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('Không thấy email? Hãy xem thư mục Spam hoặc Quảng cáo. Liên kết có hiệu lực trong 24 giờ.')}
      </p>

      <ResendVerificationButton email={email} justSent={emailSent} />
    </div>
  )
}
