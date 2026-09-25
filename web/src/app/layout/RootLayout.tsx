import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'

import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { Navbar } from '@/components/Navbar'
import { useUiStore } from '@/store'

/** Chrome that every route shares: fixed navbar, content, mobile bottom nav. */
export function RootLayout() {
  const location = useLocation()
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)

  // A route change should never leave the mobile sheet hanging open.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

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
