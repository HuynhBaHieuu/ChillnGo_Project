import { useMutation } from '@tanstack/react-query'
import { Loader2, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { t } from '@/i18n'
import { translateServerMessage } from '@/i18n/server'
import { ApiError, authService } from '@/services'

/** Matches RESEND_COOLDOWN_MS on the server. */
const COOLDOWN_SECONDS = 60

interface ResendVerificationButtonProps {
  email: string
  /** Start already cooling down, e.g. right after the first email went out. */
  justSent?: boolean
}

/** "Gửi lại email xác nhận", with a 60-second wait between sends. */
export function ResendVerificationButton({ email, justSent = false }: ResendVerificationButtonProps) {
  const [secondsLeft, setSecondsLeft] = useState(justSent ? COOLDOWN_SECONDS : 0)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const mutation = useMutation({
    mutationFn: () => authService.resendVerification(email),
    onSuccess: () => setSecondsLeft(COOLDOWN_SECONDS),
  })

  const waiting = secondsLeft > 0
  const alreadyVerified =
    mutation.error instanceof ApiError && mutation.error.code === 'ALREADY_VERIFIED'

  return (
    <div className="space-y-2">
      <GlassButton
        type="button"
        className="w-full border border-foreground"
        disabled={waiting || mutation.isPending || !email}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
        {waiting ? t('Gửi lại email sau {n} giây', { n: secondsLeft }) : t('Gửi lại email xác nhận')}
      </GlassButton>

      <p aria-live="polite" className="text-center text-xs">
        {mutation.isSuccess && (
          <span className="text-muted-foreground">
            {translateServerMessage(mutation.data.message)}{' '}
            {t('Hãy mở email mới nhất, liên kết cũ không còn dùng được. Gmail có thể gộp email mới vào cùng cuộc hội thoại với email trước.')}
          </span>
        )}
        {mutation.isError && (
          <span className={alreadyVerified ? 'text-foreground' : 'text-destructive'}>
            {(mutation.error as Error).message}{' '}
            {alreadyVerified && (
              <Link to="/login" className="font-semibold underline">
                {t('Đăng nhập')}
              </Link>
            )}
          </span>
        )}
      </p>
    </div>
  )
}
