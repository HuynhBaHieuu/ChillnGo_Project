import { useGSAP } from '@gsap/react'
import * as Dialog from '@radix-ui/react-dialog'
import { gsap } from 'gsap'
import { LogOut } from 'lucide-react'
import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import type { User } from '@/services/types'

gsap.registerPlugin(useGSAP)

/**
 * Coloured panels that sweep in ahead of the menu, in order. The accent leads
 * so its edge shows for a beat, then the raised grey, then the panel itself.
 */
const LAYERS = ['hsl(var(--primary))', 'hsl(var(--muted))'] as const

/**
 * Account menu behind the navbar avatar: a side panel whose coloured layers
 * sweep in one after another before the links rise into place.
 *
 * Radix Dialog owns focus trapping, Escape, scroll lock and focus return. It
 * would unmount the panel the moment it closes, so the panel intercepts every
 * close request, plays the exit, and only then flips `open`.
 */
export function AccountMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)

  const links = [
    { to: `/users/${user._id}`, label: t('Profile') },
    { to: '/profile/edit', label: t('Chỉnh sửa hồ sơ') },
    { to: '/posts/new', label: t('Đăng bài mới') },
    { to: '/activity', label: t('Hoạt động của bạn') },
  ]

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={t('Tài khoản')}
          className="rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Avatar className="size-10">
            <AvatarImage src={user.avatarUrl} alt="" />
            <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <AccountPanel user={user} links={links} onClosed={() => setOpen(false)} onSignOut={onSignOut} />
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function AccountPanel({
  user,
  links,
  onClosed,
  onSignOut,
}: {
  user: User
  links: { to: string; label: string }[]
  onClosed: () => void
  onSignOut: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const openTl = useRef<gsap.core.Timeline | null>(null)
  const closingRef = useRef(false)

  const sheets = () => {
    const content = contentRef.current
    return content ? gsap.utils.toArray<HTMLElement>('[data-sm-sheet]', content) : []
  }

  const { context } = useGSAP(() => {
    const content = contentRef.current
    const overlay = overlayRef.current
    if (!content || !overlay) return
    if (prefersReducedMotion()) {
      gsap.from([overlay, content], { opacity: 0, duration: 0.15 })
      return
    }

    const all = sheets()
    const panel = all[all.length - 1]
    const layers = all.slice(0, -1)
    const labels = content.querySelectorAll('[data-sm-label]')
    const crossBars = content.querySelectorAll('[data-sm-bar]')
    const panelAt = layers.length * 0.07 + 0.01

    gsap.set([...layers, panel], { xPercent: 100 })
    gsap.set(labels, { yPercent: 140, rotate: 6 })
    const fades = content.querySelectorAll('[data-sm-fade]')
    gsap.set(fades, { y: 16, opacity: 0 })

    openTl.current = gsap
      .timeline()
      .from(overlay, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0)
      .to(layers, { xPercent: 0, duration: 0.5, ease: 'power4.out', stagger: 0.07 }, 0)
      .to(panel, { xPercent: 0, duration: 0.65, ease: 'power4.out' }, panelAt)
      .to(crossBars, { rotate: (i: number) => (i ? -45 : 45), duration: 0.5, ease: 'power4.out' }, panelAt + 0.1)
      .to(labels, { yPercent: 0, rotate: 0, duration: 1, ease: 'power4.out', stagger: 0.08 }, panelAt + 0.1)
      .to(fades, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: 0.08 }, panelAt + 0.25)
  }, { scope: contentRef })

  function requestClose() {
    if (closingRef.current) return
    closingRef.current = true
    const content = contentRef.current
    const overlay = overlayRef.current
    if (!content || !overlay || prefersReducedMotion()) {
      onClosed()
      return
    }
    openTl.current?.kill()
    // Added to the hook's context so an unmount mid-exit reverts it.
    context.add(() => {
      gsap
        .timeline({ onComplete: onClosed })
        .to(content.querySelectorAll('[data-sm-bar]'), { rotate: 0, duration: 0.3, ease: 'power3.inOut' }, 0)
        .to(sheets(), { xPercent: 100, duration: 0.35, ease: 'power3.in', stagger: { each: 0.05, from: 'end' } }, 0)
        .to(overlay, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.1)
    })
  }

  return (
    <>
      <Dialog.Overlay ref={overlayRef} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]" />
      <Dialog.Content
        ref={contentRef}
        data-lenis-prevent
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => {
          // Close through the exit animation instead of Radix's instant unmount.
          e.preventDefault()
          requestClose()
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault()
          requestClose()
        }}
        className="fixed inset-y-0 right-0 z-[60] w-full overflow-hidden focus:outline-none sm:w-[420px]"
      >
        {LAYERS.map((color) => (
          <div key={color} data-sm-sheet aria-hidden className="absolute inset-0" style={{ background: color }} />
        ))}

        <div data-sm-sheet className="absolute inset-0 flex flex-col overflow-y-auto border-l border-border bg-card px-8 pb-10 pt-8 sm:px-10">
          <div className="flex items-center gap-3" data-sm-fade>
            <Avatar className="size-11">
              <AvatarImage src={user.avatarUrl} alt="" />
              <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-medium text-foreground">{user.displayName}</Dialog.Title>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label={t('Đóng')}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {/* Two stacked bars read as a dash, then open into an X. */}
              <span data-sm-bar className="absolute h-0.5 w-4 rounded-full bg-current" />
              <span data-sm-bar className="absolute h-0.5 w-4 rounded-full bg-current" />
            </button>
          </div>

          <nav aria-label={t('Tài khoản')} className="mt-16 flex-1">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {links.map((link, i) => (
                <li key={link.to} className="overflow-hidden pb-1 pt-2">
                  <NavLink
                    to={link.to}
                    end
                    onClick={requestClose}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-start gap-4 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        isActive ? 'text-primary' : 'text-foreground',
                      )
                    }
                  >
                    <span aria-hidden className="pt-1.5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      data-sm-label
                      className="inline-block origin-bottom-left font-display text-[2rem] font-semibold leading-[1.15] tracking-tight transition-colors group-hover:text-primary"
                    >
                      {link.label}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-12 border-t border-border pt-6" data-sm-fade>
            <button
              type="button"
              // Signing out unmounts the avatar and this panel with it, so there
              // is no exit to play.
              onClick={onSignOut}
              className="flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <LogOut className="size-4" />
              {t('Đăng xuất')}
            </button>
          </div>
        </div>
      </Dialog.Content>
    </>
  )
}
