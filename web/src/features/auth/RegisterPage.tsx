import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { PasswordInput } from '@/components/PasswordInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthCard } from '@/features/auth/AuthCard'
import { CheckEmailPanel } from '@/features/auth/CheckEmailPanel'
import { AuthDivider, GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { PasswordChecklist } from '@/features/auth/PasswordChecklist'
import { t } from '@/i18n'
import { passwordMeetsRules } from '@/lib/password'
import { adminService, authService } from '@/services'

export function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => authService.register({ displayName, username, email, password }),
  })

  const publicSettings = useQuery({
    queryKey: ['public-settings'],
    queryFn: adminService.getPublicSettings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!passwordMeetsRules(password)) {
      setFormError(t('Mật khẩu chưa đạt đủ các yêu cầu bên dưới ô mật khẩu.'))
      return
    }
    if (password !== confirmPassword) {
      setFormError(t('Mật khẩu xác nhận không khớp.'))
      return
    }
    setFormError(null)
    mutation.mutate()
  }

  if (mutation.isSuccess) {
    return (
      <AuthCard
        title={t('Kiểm tra email')}
        description={t('Tài khoản của bạn đã được tạo. Chỉ còn bước xác nhận email là xong.')}
        footer={
          <>
            {t('Đã xác nhận xong?')}{' '}
            <Link to="/login" className="text-foreground">
              {t('Đăng nhập')}
            </Link>
          </>
        }
      >
        <CheckEmailPanel email={mutation.data.email} emailSent={mutation.data.emailSent} />
      </AuthCard>
    )
  }

  // Only complain once the second field has something in it.
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== password

  if (publicSettings.data?.settings.registrationOpen === false) {
    return (
      <AuthCard
        title={t('Tạm ngừng đăng ký')}
        description={t('ChillnGo đang tạm ngừng nhận tài khoản mới. Vui lòng quay lại sau.')}
        footer={
          <>
            {t('Đã có tài khoản?')}{' '}
            <Link to="/login" className="text-foreground">
              {t('Đăng nhập')}
            </Link>
          </>
        }
      >
        <p className="rounded-2xl bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
          {t('Người đã có tài khoản vẫn đăng nhập bình thường, bằng email hoặc Google.')}
        </p>
      </AuthCard>
    )
  }

  const error = formError ?? (mutation.isError ? (mutation.error as Error).message : null)

  return (
    <AuthCard
      title={t('Bắt đầu ngay')}
      description={t('Tạo tài khoản để chia sẻ hành trình của bạn, và sao chép những lịch trình bạn thích về làm của mình.')}
      footer={
        <>
          {t('Đã có tài khoản?')}{' '}
          <Link to="/login" className="text-foreground">
            {t('Đăng nhập')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">{t('Tên hiển thị')}</Label>
          <Input
            id="displayName"
            required
            maxLength={60}
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">{t('Tên người dùng')}</Label>
          <Input
            id="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9._]+"
            title={t('Chữ không dấu, số, dấu chấm hoặc gạch dưới')}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

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
          <p className="text-xs text-muted-foreground">
            {t('Chúng tôi sẽ gửi email xác nhận tới địa chỉ này.')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('Mật khẩu')}</Label>
          <PasswordInput
            id="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            aria-describedby="password-rules"
            aria-invalid={formError !== null && !passwordMeetsRules(password)}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setFormError(null)
            }}
          />
          <PasswordChecklist id="password-rules" password={password} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('Xác nhận mật khẩu')}</Label>
          <PasswordInput
            id="confirmPassword"
            required
            maxLength={72}
            autoComplete="new-password"
            aria-invalid={confirmMismatch}
            aria-describedby="confirm-password-hint"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setFormError(null)
            }}
          />
          <p id="confirm-password-hint" aria-live="polite" className="text-xs">
            {confirmMismatch && <span className="text-destructive">{t('Mật khẩu xác nhận không khớp.')}</span>}
            {!confirmMismatch && confirmPassword.length > 0 && (
              <span className="text-foreground">{t('Mật khẩu đã khớp.')}</span>
            )}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <GlassButton type="submit" size="lg" tone="beam" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {t('Tạo tài khoản')}
        </GlassButton>
      </form>

      <div className="mt-6 space-y-6">
        <AuthDivider />
        <GoogleSignInButton mode="signup" />
      </div>
    </AuthCard>
  )
}
