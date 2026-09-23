import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCard } from '@/features/auth/AuthCard'
import { authService } from '@/services'
import type { AuthSession } from '@/services/types'
import { useAuthStore } from '@/store'

export function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => authService.register({ displayName, username, email, password }),
    onSuccess: (session: AuthSession) => {
      signIn(session)
      void navigate('/feed', { replace: true })
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <AuthCard
      title="Bắt đầu ngay"
      description="Tạo tài khoản để chia sẻ hành trình của bạn, và clone những lịch trình bạn thích về làm của mình."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className=" text-foreground">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">Tên hiển thị</Label>
          <Input
            id="displayName"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Trần Nhật Minh"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Tên người dùng</Label>
          <Input
            id="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="minhtran"
          />
        </div>

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
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ít nhất 6 ký tự"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
        )}

        <GlassButton type="submit" size="lg" tone="sunset" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Tạo tài khoản
        </GlassButton>

        <p className="text-xs text-muted-foreground">
          Đây là bản demo — tài khoản chỉ tồn tại trong phiên làm việc này.
        </p>
      </form>
    </AuthCard>
  )
}
