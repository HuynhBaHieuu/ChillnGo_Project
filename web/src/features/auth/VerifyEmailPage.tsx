import { CircleCheck, CircleX, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCard } from '@/features/auth/AuthCard'
import { ResendVerificationButton } from '@/features/auth/ResendVerificationButton'
import { authService } from '@/services'
import { useAuthStore } from '@/store'

/** Seconds on the success screen before moving on to the feed. */
const REDIRECT_SECONDS = 5
const HOME_AFTER_VERIFY = '/feed'

type Status =
  | { kind: 'verifying' }
  | { kind: 'success'; displayName: string }
  | { kind: 'error'; message: string }

/**
 * /verify-email?token=... — the page the confirmation email links to.
 *
 * Confirms the email, signs the user in, then returns them to ChillnGo.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>(() =>
    token
      ? { kind: 'verifying' }
      : { kind: 'error', message: 'Liên kết xác nhận bị thiếu mã. Hãy mở lại liên kết trong email.' },
  )
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)
  const [resendEmail, setResendEmail] = useState('')

  // The token is single-use. React's dev-mode double effect would send it
  // twice and the second call would fail, so run the request only once.
  const requested = useRef(false)

  useEffect(() => {
    if (!token || requested.current) return
    requested.current = true

    authService
      .verifyEmail(token)
      .then((session) => {
        signIn(session)
        setStatus({ kind: 'success', displayName: session.user.displayName })
      })
      .catch((error: unknown) => {
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Không thể xác nhận email.',
        })
      })
  }, [token, signIn])

  // Countdown, then leave for the feed.
  useEffect(() => {
    if (status.kind !== 'success') return
    if (secondsLeft <= 0) {
      void navigate(HOME_AFTER_VERIFY, { replace: true })
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [status.kind, secondsLeft, navigate])

  if (status.kind === 'verifying') {
    return (
      <AuthCard
        title="Đang xác nhận"
        description="Chúng tôi đang kiểm tra liên kết xác nhận email của bạn."
        footer={null}
      >
        <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Vui lòng đợi trong giây lát…
        </div>
      </AuthCard>
    )
  }

  if (status.kind === 'success') {
    return (
      <AuthCard
        title="Đã xác nhận"
        description="Email của bạn đã được xác nhận và tài khoản đã sẵn sàng."
        footer={null}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 rounded-2xl bg-muted p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-sunset text-sunset-foreground">
              <CircleCheck aria-hidden className="size-5" />
            </span>
            <div className="text-sm leading-relaxed">
              <p className="font-semibold text-foreground">
                Chào mừng {status.displayName} đến với ChillnGo!
              </p>
              <p className="text-muted-foreground">Bạn đã được đăng nhập.</p>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            Tự động chuyển về ChillnGo sau {secondsLeft} giây…
          </p>

          <GlassButton asChild size="lg" tone="sunset" className="w-full">
            <Link to={HOME_AFTER_VERIFY} replace>
              Vào ChillnGo ngay
            </Link>
          </GlassButton>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Chưa xác nhận được"
      description="Liên kết này không dùng được nữa. Bạn có thể nhận một liên kết mới."
      footer={
        <>
          Email đã được xác nhận trước đó?{' '}
          <Link to="/login" className="text-foreground">
            Đăng nhập
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div role="alert" className="flex items-start gap-4 rounded-2xl bg-muted p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-paper text-destructive">
            <CircleX aria-hidden className="size-5" />
          </span>
          <p className="text-sm leading-relaxed text-foreground">{status.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resend-email">Email đã dùng để đăng ký</Label>
          <Input
            id="resend-email"
            type="email"
            autoComplete="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
          />
        </div>

        <ResendVerificationButton email={resendEmail} />
      </div>
    </AuthCard>
  )
}
