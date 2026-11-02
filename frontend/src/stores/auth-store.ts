import { create } from 'zustand'

interface AuthUser { accountNo: string; email: string; role: string[]; exp: number }
interface AuthState { auth: { user: AuthUser | null; csrfToken: string; accessToken: string; setUser: (user: AuthUser | null) => void; setCsrfToken: (value: string) => void; setAccessToken: (value: string) => void; resetAccessToken: () => void; reset: () => void } }

// The actual session is an HttpOnly server cookie. Only display data and CSRF stay in memory.
export const useAuthStore = create<AuthState>()((set) => ({ auth: {
  user: null, csrfToken: '', accessToken: '',
  setUser: (user) => set((s) => ({ auth: { ...s.auth, user } })),
  setCsrfToken: (csrfToken) => set((s) => ({ auth: { ...s.auth, csrfToken } })),
  setAccessToken: () => {}, // Legacy template adapter; never persist an access token.
  resetAccessToken: () => set((s) => ({ auth: { ...s.auth, accessToken: '' } })),
  reset: () => set((s) => ({ auth: { ...s.auth, user: null, csrfToken: '', accessToken: '' } })),
} }))
