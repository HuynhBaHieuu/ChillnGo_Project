import { useEffect } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation, useMatch } from 'react-router-dom'

import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { Navbar } from '@/components/Navbar'
import { AssistantButton } from '@/features/assistant/AssistantButton'
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
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  // These pages keep their own controls at the bottom edge (post actions, live
  // comments, an AI draft's chat), which the floating assistant button would cover.
  const postMatch = useMatch('/posts/:id')
  const onLive = useMatch('/live/:id')
  const onAiDraft = useMatch('/ai-drafts/:id')
  const bottomControls = Boolean(onLive || onAiDraft) || (postMatch !== null && postMatch.params.id !== 'new')

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
      {signedIn && !bottomControls && <AssistantButton />}
      <ScrollRestoration />
    </div>
  )
}
