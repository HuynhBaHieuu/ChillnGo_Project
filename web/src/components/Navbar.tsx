import { Menu, PenSquare } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { AccountMenu } from '@/components/AccountMenu'
import { GlassButton } from '@/components/Button'
import { LiquidLogo } from '@/components/LiquidLogo'
import { PillNav } from '@/components/PillNav'
import { NotificationBell } from '@/components/NotificationBell'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useLiveNow } from '@/features/livestream/useLiveNow'
import { t, translatedList } from '@/i18n'
import { cn } from '@/lib/utils'
import { useAuthStore, useUiStore } from '@/store'

/**
 * "Về ChillnGo" points at the landing page — the hero is where the product's
 * mission is stated, so there is no separate about route.
 */
const NAV_LINKS = translatedList([
  { to: '/discover', label: 'Khám phá' },
  { to: '/feed', label: 'Newsfeed' },
  { to: '/live', label: 'Đang live' },
  { to: '/itineraries', label: 'Hành trình của tôi' },
  { to: '/', label: 'Về ChillnGo' },
] as const, ['label'])

/**
 * The home page alternates forest and paper sections, so it gets a transparent
 * navbar that recolours itself; every other page keeps the liquid-glass bar.
 */
export function Navbar() {
  const { pathname } = useLocation()
  return pathname === '/' ? <TransparentNavbar /> : <GlassNavbar />
}

function GlassNavbar() {
  return (
    <header data-nav="glass" className="liquid-glass fixed inset-x-0 top-0 z-50">
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <Logo />
        <DesktopLinks />
        <NavControls />
      </nav>
    </header>
  )
}

/**
 * Home-page navbar: transparent, recoloured by the section under it.
 *
 * The stage timelines write <html data-nav-theme="dark|light"> as backgrounds
 * change (styles/home.css maps it to colours): white over the forest ground and
 * footage, forest over the paper sections.
 *
 * This is deliberately not `mix-blend-mode: difference`. Difference only
 * produces white over pure black; over the brand forest (#09392c) white inverts
 * to a dusty pink (246, 198, 211), and no text colour can fix that because the
 * ground's green channel caps the result at 198.
 */
function TransparentNavbar() {
  return (
    <header className="nav-transparent pointer-events-none fixed inset-x-0 top-0 z-50">
      <nav className="mx-auto grid h-[88px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-8">
        <div className="nav-brand pointer-events-auto justify-self-start">
          <Logo />
        </div>
        <div className="pointer-events-auto">
          <DesktopLinks />
        </div>
        <div className="nav-controls pointer-events-auto justify-self-end">
          <NavControls />
        </div>
      </nav>
    </header>
  )
}

function Logo() {
  return (
    <Link to="/" className="block transition-opacity hover:opacity-80">
      <span className="sr-only">ChillnGo</span>
      {/* Negative margins: the texture's padding would otherwise push the bar taller and the word right. */}
      <LiquidLogo className="-my-2 -ml-2 h-14" />
    </Link>
  )
}

/**
 * Five text pills are ~590px wide. The home navbar centres them between the
 * logo and the signed-out controls, which needs ~1100px, so they start at xl;
 * below that the menu sheet carries the links.
 */
function DesktopLinks() {
  const items = NAV_LINKS.map((link) => ({
    ...link,
    end: link.to === '/',
    badge: link.to === '/live' ? <LiveCount /> : undefined,
  }))

  return (
    <PillNav items={items} className="hidden xl:flex" />
  )
}

/** How many people are live right now, as a red pill beside "Đang live". Nothing when nobody is. */
function LiveCount({ className }: { className?: string }) {
  const { data } = useLiveNow()
  if (!data?.length) return null
  return (
    <span
      aria-label={t('{n} người đang phát trực tiếp', { n: data.length })}
      className={cn('inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold leading-5 text-white', className)}
    >
      {data.length}
    </span>
  )
}

/** Right side of the navbar: account controls plus the mobile menu sheet. */
function NavControls() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const signOut = useAuthStore((s) => s.signOut)
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    setMobileNavOpen(false)
    void navigate('/')
  }

  return (
    <div className="flex items-center gap-3">
      <LanguageSwitcher />

      {isAuthenticated && user ? (
        <>
          <NotificationBell />

          <AccountMenu user={user} onSignOut={handleSignOut} />
        </>
      ) : (
        <>
          <Link
            to="/login"
            className="nav-login hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            {t('Đăng nhập')}
          </Link>
          <GlassButton asChild size="md" tone="beam">
            <Link to="/register">{t('Bắt đầu ngay')}</Link>
          </GlassButton>
        </>
      )}

      {/* Mobile menu */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={t('Mở menu')}
            className="liquid-glass liquid-glass-interactive flex size-10 items-center justify-center rounded-full text-foreground xl:hidden"
          >
            <Menu className="relative z-[1] size-4" />
          </button>
        </SheetTrigger>

        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>ChillnGo</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-3 text-base text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground',
                    isActive && 'text-foreground',
                  )
                }
              >
                {link.label}
                {link.to === '/live' && <LiveCount className="ml-2" />}
              </NavLink>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-2">
            {isAuthenticated && user ? (
              <>
                <GlassButton asChild size="lg" className="w-full">
                  <Link to="/posts/new" onClick={() => setMobileNavOpen(false)}>
                    <PenSquare />
                    {t('Đăng bài mới')}
                  </Link>
                </GlassButton>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-xl px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('Đăng xuất')}
                </button>
              </>
            ) : (
              <>
                <GlassButton asChild size="lg" tone="beam" className="w-full">
                  <Link to="/register" onClick={() => setMobileNavOpen(false)}>
                    {t('Bắt đầu ngay')}
                  </Link>
                </GlassButton>
                <Link
                  to="/login"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('Đăng nhập')}
                </Link>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
