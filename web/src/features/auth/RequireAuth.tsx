import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/store'

interface RequireAuthProps {
  children: ReactNode
  /** Additionally require the admin role — used by /admin. */
  adminOnly?: boolean
}

/**
 * Route guard.
 *
 * Gates /posts/new, /posts/:id/edit, /itineraries and /admin. Sends anyone
 * signed out to /login and remembers where they were headed, so the login form
 * can return them there.
 *
 * The check is against the persisted Zustand session, which today holds a fake
 * token. When real auth lands, this component keeps its shape — only the store
 * behind it changes.
 */
export function RequireAuth({ children, adminOnly = false }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/feed" replace />
  }

  return <>{children}</>
}
