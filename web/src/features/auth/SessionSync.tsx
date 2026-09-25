import { useEffect } from 'react'

import { authService } from '@/services'
import { useAuthStore } from '@/store'

/**
 * Checks a session restored from localStorage against the API once, on load.
 *
 * An expired or revoked token is dropped (the HTTP layer signs out on any 401),
 * and a valid one gets the latest user record. A network failure leaves the
 * session alone so an offline reload does not log anyone out.
 */
export function SessionSync() {
  useEffect(() => {
    if (!useAuthStore.getState().token) return
    let cancelled = false

    authService
      .getCurrentUser()
      .then((user) => {
        if (!cancelled) useAuthStore.getState().patchUser(user)
      })
      .catch(() => {
        // 401 is already handled by the HTTP layer; anything else is transient.
      })

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
