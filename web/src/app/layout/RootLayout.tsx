import { useEffect } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'

import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { Navbar } from '@/components/Navbar'
import { isStaff } from '@/lib/roles'
import { useAuthStore, useUiStore } from '@/store'

/**
 * Chrome that every public route shares: fixed navbar, content, mobile bottom nav.
 *
 * Admins and the superadmin never see the public site: while signed in, any
 * public URL sends them to the admin console. They use the site as a regular
 * user only by signing out.
 */
export function RootLayout() {
  const location = useLocation()
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const staff = useAuthStore((s) => isStaff(s.user))

  // A route change should never leave the mobile sheet hanging open.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

  if (staff) return <Navigate to="/admin" replace />

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <MobileBottomNav />
      <AnnouncementBanner />
      <ScrollRestoration />
    </div>
  )
}
