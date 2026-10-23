import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { currentLocale, t } from '@/i18n'
import type { Locale } from '@/i18n'
import { optionalEnv } from '@/lib/env'
import { homePathFor } from '@/lib/roles'
import { authService } from '@/services'
import { useAuthStore } from '@/store'

/**
 * "Tiếp tục với Google", rendered by Google Identity Services.
 *
 * Google draws the button itself (its branding rules require that) and, once
 * the user picks an account, hands back a signed ID token. The API verifies
 * that token and returns a normal ChillnGo session.
 *
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is not set.
 */

const CLIENT_ID = optionalEnv(import.meta.env.VITE_GOOGLE_CLIENT_ID)
const GSI_SRC = 'https://accounts.google.com/gsi/client'

/** Just the parts of the Google Identity Services API used here. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(config: {
        client_id: string
        callback: (response: { credential: string }) => void
        ux_mode?: 'popup' | 'redirect'
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
      }): void
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

let scriptPromise: Promise<GoogleIdentity> | null = null

/** Loads Google's script once per page load, however many buttons mount. */
function loadGoogleIdentity(): Promise<GoogleIdentity> {
  scriptPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google)
      return
    }
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('GSI missing')))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('GSI failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * `initialize` must run once per page load, but the button appears on several
 * pages. Google calls this single dispatcher, which forwards to whichever
 * button is currently mounted.
 */
let onCredential: ((credential: string) => void) | null = null
let initialized = false

/** Google's own locale codes for the button's text. */
const GOOGLE_LOCALES: Record<Locale, string> = { vi: 'vi', en: 'en', zh: 'zh_CN', ja: 'ja', ko: 'ko' }

interface GoogleSignInButtonProps {
  /** Where to go after sign-in. Default: the admin console for staff, the feed for everyone else. */
  redirectTo?: string
  /** Google's wording: "Đăng nhập bằng Google" vs "Đăng ký bằng Google". */
  mode?: 'signin' | 'signup'
}

export function GoogleSignInButton({ redirectTo, mode = 'signin' }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: (credential: string) => authService.loginWithGoogle(credential),
    onSuccess: (session) => {
      signIn(session)
      void navigate(redirectTo ?? homePathFor(session.user), { replace: true })
    },
  })

  // Keep the dispatcher pointed at this button's latest mutate.
  const { mutate } = mutation
  useEffect(() => {
    onCredential = (credential) => mutate(credential)
    return () => {
      onCredential = null
    }
  }, [mutate])

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !container.current) return
        if (!initialized) {
          google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: ({ credential }) => onCredential?.(credential),
            ux_mode: 'popup',
            auto_select: false,
          })
          initialized = true
        }
        // Google's button takes a fixed pixel width between 200 and 400.
        const width = Math.round(Math.min(400, Math.max(200, container.current.offsetWidth)))
        google.accounts.id.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          logo_alignment: 'center',
          locale: GOOGLE_LOCALES[currentLocale()],
          width,
        })
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [mode])

  if (!CLIENT_ID) return null

  return (
    <div className="space-y-2">
      <div className="relative flex min-h-11 justify-center">
        <div ref={container} className="flex w-full justify-center" />
        {mutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-card/90 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('Đang đăng nhập bằng Google…')}
          </div>
        )}
      </div>

      {loadFailed && (
        <p className="text-center text-xs text-muted-foreground">
          {t('Không tải được nút đăng nhập Google. Kiểm tra kết nối mạng hoặc trình chặn quảng cáo.')}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-center text-sm text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  )
}

/** "hoặc" rule between the Google button and the email form. */
export function AuthDivider({ label = t('hoặc') }: { label?: string }) {
  if (!CLIENT_ID) return null
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
      <span className="h-px flex-1 bg-foreground/15" />
      {label}
      <span className="h-px flex-1 bg-foreground/15" />
    </div>
  )
}
