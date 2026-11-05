import { useMutation } from '@tanstack/react-query'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCard } from '@/features/auth/AuthCard'
import { t } from '@/i18n'
import { authService } from '@/services'

/** Matches RESET_COOLDOWN_MS on the server. */
const COOLDOWN_SECONDS = 60

/**
 * /forgot-password — asks for the email to send a reset link to. The answer is
 * the same whether or not the email has an account, so this page never says
 * which it was.
 */
export function ForgotPasswordPage() {
  const location = useLocation()
  /** The login form passes along whatever was already typed there. */
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [sent, setSent] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const mutation = useMutation({
    mutationFn: () => authService.forgotPassword(email),
    onSuccess: () => {
      setSent(true)
      setSecondsLeft(COOLDOWN_SECONDS)
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  const footer = (
    <>
      {t('Đã nhớ ra mật khẩu?')}{' '}
      <Link to="/login" className="text-foreground">
        {t('Đăng nhập')}
      </Link>
    </>
  )

  const error = mutation.isError && (
    <p role="alert" className="text-sm text-destructive">
      {(mutation.error as Error).message}
    </p>
  )

  if (sent) {
    const waiting = secondsLeft > 0
    return (
      <AuthCard
        title={t('Kiểm tra email')}
        description={t('Mở email “Đặt lại mật khẩu tài khoản ChillnGo” và bấm nút trong đó để tạo mật khẩu mới.')}
        footer={footer}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 rounded-2xl bg-muted p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-sunset text-sunset-foreground">
              <MailCheck aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 text-sm leading-relaxed">
              <p>{t('Nếu địa chỉ này có tài khoản ChillnGo, chúng tôi đã gửi liên kết đặt lại mật khẩu tới')}</p>
              <p className="break-all font-semibold text-foreground">{email.trim()}</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('Không thấy email? Hãy xem thư mục Spam hoặc Quảng cáo. Liên kết có hiệu lực trong 60 phút và chỉ dùng được một lần.')}
          </p>

          {error}

          <GlassButton
            type="button"
            className="w-full border border-foreground"
            disabled={waiting || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
            {waiting ? t('Gửi lại email sau {n} giây', { n: secondsLeft }) : t('Gửi lại email')}
          </GlassButton>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t('Quên mật khẩu')}
      description={t('Nhập email của tài khoản, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.')}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t('Email')}</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error}

        <GlassButton type="submit" size="lg" tone="beam" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {t('Gửi liên kết đặt lại')}
        </GlassButton>
      </form>
    </AuthCard>
  )
}
