import { LogOut, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { ADMIN_SECTIONS, sectionsFor } from '@/features/discovery-admin/admin/sections'
import { Avatar, NoticeBar, RoleBadge } from '@/features/discovery-admin/admin/shared'
import type { Notice } from '@/features/discovery-admin/admin/shared'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store'

/**
 * /admin — the admin console. A separate shell from the public site: its own
 * sidebar, no public navbar. Staff accounts cannot open the public site at all
 * (see RootLayout); signing out takes them to the login page. Sections the signed-in account may not use are
 * not listed, and their URLs send it back to /admin.
 */
export function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  if (!user) return null
  const sections = sectionsFor(user)

  function handleSignOut() {
    signOut()
    void navigate('/login', { replace: true })
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-sunset text-sunset-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* Sidebar, desktop */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r-2 border-foreground bg-card px-4 py-6 lg:flex">
        <Link to="/admin" className="px-4">
          <span className="block font-display text-2xl tracking-tight">ChillnGo</span>
          <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Quản trị hệ thống
          </span>
        </Link>

        <nav aria-label="Mục quản trị" className="mt-8 flex flex-col gap-1">
          {sections.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={`/admin/${path}`} className={navLinkClass}>
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.displayName}</p>
              <RoleBadge role={user.role} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar, mobile and tablet */}
        <header className="sticky top-0 z-30 border-b-2 border-foreground bg-card lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link to="/admin">
              <span className="block font-display text-xl tracking-tight">ChillnGo</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Quản trị hệ thống
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <RoleBadge role={user.role} />
              <button type="button" onClick={handleSignOut} aria-label="Đăng xuất" className="grid size-9 place-items-center rounded-full hover:bg-muted">
                <LogOut className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <nav aria-label="Mục quản trị" className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={`/admin/${path}`} className={(s) => cn(navLinkClass(s), 'shrink-0 px-3 py-2')}>
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** /admin — opens the first section this account may use. */
export function AdminIndex() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  const first = sectionsFor(user)[0]
  if (first) return <Navigate to={`/admin/${first.path}`} replace />
  return (
    <EmptyState
      icon={ShieldOff}
      title="Chưa được cấp quyền"
      description="Tài khoản Admin của bạn chưa được Super Admin cấp quyền cho mục nào."
    />
  )
}

/** /admin/:section — header, result notice, and the section's panel. */
export function AdminSectionPage({ path }: { path: string }) {
  const user = useAuthStore((s) => s.user)
  const [notice, setNotice] = useState<Notice | null>(null)

  const section = ADMIN_SECTIONS.find((s) => s.path === path)
  if (!user || !section) return null
  if (!section.allowed(user)) return <Navigate to="/admin" replace />

  return (
    <div className="space-y-6">
      <header className="animate-fade-rise">
        <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">{section.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{section.description(user)}</p>
      </header>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      {section.render({ user, onNotice: setNotice })}
    </div>
  )
}
