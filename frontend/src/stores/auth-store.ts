import { create } from 'zustand'
import { type Role } from '@/features/banking/data/types'

/** Shape of `user` in the auth/login and auth/session responses. */
export type AuthUser = {
  id: string
  login: string
  role: Role
  customer_id: string | null
  branch_id: string | null
  enabled: boolean
  version: number
}

type AuthState = {
  auth: {
    user: AuthUser | null
    /** Bound to the session; required on every write request. */
    csrfToken: string | null
    expiresAt: string | null
    setSession: (session: {
      user: AuthUser
      csrf_token: string
      expires_at: string
    }) => void
    setUser: (user: AuthUser | null) => void
    reset: () => void
  }
}

// The session itself lives in an HttpOnly cookie the browser sends on its own,
// so nothing here is a credential: only the CSRF token and the user view, both
// re-fetchable from GET /auth/session. Nothing is persisted to storage.
export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    csrfToken: null,
    expiresAt: null,
    setSession: (session) =>
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user: session.user,
          csrfToken: session.csrf_token,
          expiresAt: session.expires_at,
        },
      })),
    setUser: (user) =>
      set((state) => ({ ...state, auth: { ...state.auth, user } })),
    reset: () =>
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user: null,
          csrfToken: null,
          expiresAt: null,
        },
      })),
  },
}))

/** Read the CSRF token outside React (mutation helpers, route loaders). */
export function currentCsrfToken(): string | null {
  return useAuthStore.getState().auth.csrfToken
}
