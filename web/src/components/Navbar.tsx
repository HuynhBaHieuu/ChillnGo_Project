import { Activity, LogOut, Menu, PenSquare, Settings, User as UserIcon } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { NotificationBell } from '@/components/NotificationBell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useLiveNow } from '@/features/livestream/useLiveNow'
import { cn } from '@/lib/utils'
import { useAuthStore, useUiStore } from '@/store'

/**
 * "Về ChillnGo" points at the landing page — the hero is where the product's
 * mission is stated, so there is no separate about route.
 */
const NAV_LINKS = [
  { to: '/discover', label: 'Khám phá' },
  { to: '/feed', label: 'Newsfeed' },
  { to: '/live', label: 'Đang live' },
  { to: '/itineraries', label: 'Hành trình của tôi' },
  { to: '/', label: 'Về ChillnGo' },
] as const

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
        <DesktopLinks linkClassName="text-muted-foreground hover:text-foreground" activeClassName="text-foreground" />
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
          <DesktopLinks linkClassName="nav-link" activeClassName="nav-link-active" />
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
    <Link
      to="/"
      className="font-display text-3xl tracking-tight transition-opacity hover:opacity-80"
    >
      ChillnGo
    </Link>
  )
}

function DesktopLinks({
  linkClassName,
  activeClassName,
}: {
  linkClassName: string
  activeClassName: string
}) {
  return (
    <div className="hidden items-center gap-8 md:flex">
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.label}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) =>
            cn('flex items-center gap-1.5 text-sm transition-colors', linkClassName, isActive && activeClassName)
          }
        >
          {link.label}
          {link.to === '/live' && <LiveCount />}
        </NavLink>
      ))}
    </div>
  )
}

/** How many people are live right now, as a red pill beside "Đang live". Nothing when nobody is. */
function LiveCount({ className }: { className?: string }) {
  const { data } = useLiveNow()
  if (!data?.length) return null
  return (
    <span
      aria-label={`${data.length} người đang phát trực tiếp`}
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
      {isAuthenticated && user ? (
        <>
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Tài khoản"
                className="rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Avatar className="size-10">
                  <AvatarImage src={user.avatarUrl} alt="" />
                  <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="normal-case tracking-normal">
                <span className="block text-sm text-foreground">{user.displayName}</span>
                <span className="block text-xs">@{user.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`/users/${user._id}`}>
                  <UserIcon />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/profile/edit">
                  <Settings />
                  Chỉnh sửa hồ sơ
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/posts/new">
                  <PenSquare />
                  Đăng bài mới
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/activity">
                  <Activity />
                  Hoạt động của bạn
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <Link
            to="/login"
            className="nav-login hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Đăng nhập
          </Link>
          <GlassButton asChild size="md">
            <Link to="/register">Bắt đầu ngay</Link>
          </GlassButton>
        </>
      )}

      {/* Mobile menu */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Mở menu"
            className="liquid-glass liquid-glass-interactive flex size-10 items-center justify-center rounded-full text-foreground md:hidden"
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
                key={link.label}
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
                    Đăng bài mới
                  </Link>
                </GlassButton>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-xl px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <GlassButton asChild size="lg" className="w-full">
                  <Link to="/register" onClick={() => setMobileNavOpen(false)}>
                    Bắt đầu ngay
                  </Link>
                </GlassButton>
                <Link
                  to="/login"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Đăng nhập
                </Link>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
