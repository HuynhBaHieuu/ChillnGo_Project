import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCard } from '@/features/auth/AuthCard'
import { authService } from '@/services'
import type { AuthSession } from '@/services/types'
import { useAuthStore } from '@/store'

interface FromState {
  from?: { pathname: string }
}

export function LoginPage() {
  const [email, setEmail] = useState('minh@chillngo.vn')
  const [password, setPassword] = useState('chillngo')
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()
  const location = useLocation()

  /** Where RequireAuth sent us from, if anywhere. */
  const redirectTo = (location.state as FromState | null)?.from?.pathname ?? '/feed'

  const mutation = useMutation({
    mutationFn: () => authService.login({ email, password }),
    onSuccess: (session: AuthSession) => {
      signIn(session)
      void navigate(redirectTo, { replace: true })
    },
  })

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
            placeholder="ban@email.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}

        <GlassButton type="submit" size="lg" tone="sunset" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Đăng nhập
        </GlassButton>

        <p className="text-xs text-muted-foreground">
          Đây là bản demo — xác thực chưa được nối. Mật khẩu nào cũng vào được.
        </p>
      </form>
    </AuthCard>
  )
}
