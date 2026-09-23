/**
 * Auth session state.
 *
 * Holds the (fake) JWT and the signed-in user, mirrored into localStorage by
 * zustand's persist middleware so a refresh keeps you logged in. Components
 * read `user`/`token` from here; `RequireAuth` reads `isAuthenticated`.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AuthSession, User } from '@/services/types'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  signIn: (session: AuthSession) => void
  signOut: () => void
  /** Keep the cached user fresh after a profile-affecting action. */
  patchUser: (patch: Partial<User>) => void
}

export const AUTH_STORAGE_KEY = 'chillngo.auth'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      signIn: (session) =>
        set({ token: session.token, user: session.user, isAuthenticated: true }),

      signOut: () => set({ token: null, user: null, isAuthenticated: false }),

      patchUser: (patch) =>
        set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

/** The viewer id every service call needs, or `null` when signed out. */
export function useViewerId(): string | null {
  return useAuthStore((state) => state.user?._id ?? null)
}
