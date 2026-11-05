import { useMutation } from '@tanstack/react-query'
import { CircleCheck, CircleX, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { PasswordInput } from '@/components/PasswordInput'
import { Label } from '@/components/ui/label'
import { AuthCard } from '@/features/auth/AuthCard'
import { PasswordChecklist } from '@/features/auth/PasswordChecklist'
import { t } from '@/i18n'
import { passwordMeetsRules } from '@/lib/password'
import { ApiError, authService } from '@/services'
import { useAuthStore } from '@/store'

/** /reset-password?token=... — the page the password reset email links to. */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const signOut = useAuthStore((s) => s.signOut)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => authService.resetPassword(token, password),
    // The server has just ended every session of the account.
    onSuccess: () => signOut(),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!passwordMeetsRules(password)) {
      setFormError(t('Mật khẩu chưa đạt đủ các yêu cầu bên dưới ô mật khẩu.'))
      return
    }
    setFormError(null)
    // The hint under the field already says so.
    if (password !== confirmPassword) return
    mutation.mutate()
  }

  if (mutation.isSuccess) {
    return (
      <AuthCard
        title={t('Đã đổi mật khẩu')}
        description={t('Mật khẩu mới đã có hiệu lực. Mọi thiết bị đang đăng nhập đã được đăng xuất.')}
        footer={null}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 rounded-2xl bg-muted p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-sunset text-sunset-foreground">
              <CircleCheck aria-hidden className="size-5" />
            </span>
            <p className="text-sm leading-relaxed text-foreground">{t('Hãy đăng nhập bằng mật khẩu mới.')}</p>
          </div>
          <GlassButton asChild size="lg" tone="sunset" className="w-full">
            <Link to="/login" replace>
              {t('Đăng nhập')}
            </Link>
          </GlassButton>
        </div>
      </AuthCard>
    )
  }

  const linkFailed = mutation.error instanceof ApiError && mutation.error.code === 'INVALID_RESET_TOKEN'
  if (!token || linkFailed) {
    return (
      <AuthCard
        title={t('Liên kết không dùng được')}
        description={t('Liên kết đặt lại mật khẩu chỉ dùng được một lần và có hiệu lực trong 60 phút. Bạn có thể nhận một liên kết mới.')}
        footer={null}
      >
        <div className="space-y-6">
          <div role="alert" className="flex items-start gap-4 rounded-2xl bg-muted p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-paper text-destructive">
              <CircleX aria-hidden className="size-5" />
            </span>
            <p className="text-sm leading-relaxed text-foreground">
              {token
                ? (mutation.error as Error).message
                : t('Liên kết đặt lại mật khẩu bị thiếu mã. Hãy mở lại liên kết trong email.')}
            </p>
          </div>
          <GlassButton asChild size="lg" tone="sunset" className="w-full">
            <Link to="/forgot-password" replace>
              {t('Nhận liên kết mới')}
            </Link>
          </GlassButton>
        </div>
      </AuthCard>
    )
  }

  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== password

  return (
    <AuthCard
      title={t('Đặt mật khẩu mới')}
      description={t('Chọn mật khẩu mới cho tài khoản ChillnGo của bạn.')}
      footer={null}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">{t('Mật khẩu mới')}</Label>
          <PasswordInput
            id="password"
            required
            autoFocus
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
          </p>
        </div>

        {(formError !== null || mutation.isError) && (
          <p role="alert" className="text-sm text-destructive">
            {formError ?? (mutation.error as Error).message}
          </p>
        )}

        <GlassButton type="submit" size="lg" tone="beam" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {t('Đặt mật khẩu mới')}
        </GlassButton>
      </form>
    </AuthCard>
  )
}
