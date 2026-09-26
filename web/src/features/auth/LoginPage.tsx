import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { PasswordInput } from '@/components/PasswordInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCard } from '@/features/auth/AuthCard'
import { AuthDivider, GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { ResendVerificationButton } from '@/features/auth/ResendVerificationButton'
import { homePathFor } from '@/lib/roles'
import { ApiError, authService } from '@/services'
import type { AuthSession } from '@/services/types'
import { useAuthStore } from '@/store'

interface FromState {
  from?: { pathname: string }
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()
  const location = useLocation()

  /** Where RequireAuth sent us from, if anywhere. */
  const from = (location.state as FromState | null)?.from?.pathname

  const mutation = useMutation({
    mutationFn: () => authService.login({ email, password }),
    onSuccess: (session: AuthSession) => {
      signIn(session)
      void navigate(from ?? homePathFor(session.user), { replace: true })
    },
  })

  const needsVerification =
    mutation.error instanceof ApiError && mutation.error.code === 'EMAIL_NOT_VERIFIED'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <AuthCard
      title="Chào mừng trở lại"
      description="Đăng nhập để theo dõi hành trình của những người bạn đi cùng, và tiếp tục những lịch trình bạn đã lưu."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className=" text-foreground">
            Đăng ký
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <PasswordInput
            id="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {mutation.isError && !needsVerification && (
          <p role="alert" className="text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}

        {needsVerification && (
          <div role="alert" className="space-y-3 rounded-2xl bg-muted p-4">
            <p className="text-sm font-semibold text-foreground">Email chưa được xác nhận</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hãy mở email xác nhận chúng tôi đã gửi tới{' '}
              <span className="break-all font-semibold text-foreground">{email.trim()}</span> và bấm
              nút <span className="font-semibold text-foreground">Xác nhận email</span>. Không
              thấy email? Gửi lại một email mới:
            </p>
            <ResendVerificationButton email={email} />
          </div>
        )}

        <GlassButton type="submit" size="lg" tone="sunset" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Đăng nhập
        </GlassButton>
      </form>

      <div className="mt-6 space-y-6">
        <AuthDivider />
        <GoogleSignInButton redirectTo={from} />
      </div>
    </AuthCard>
  )
}
