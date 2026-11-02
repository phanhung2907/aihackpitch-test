import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { ApiError, apiGet } from '@/lib/api'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

type SessionResponse = {
  user: AuthUser
  csrf_token: string
  expires_at: string
}

export const Route = createFileRoute('/_authenticated')({
  // The session lives in an HttpOnly cookie, so the only way to know whether
  // the browser still has one is to ask the API. Role checks stay server-side;
  // this guard only decides whether to show the app or the sign-in page.
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()
    if (auth.user) return

    try {
      const { data } = await apiGet<SessionResponse>('/auth/session')
      auth.setSession(data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
        })
      }
      throw error
    }
  },
  component: AuthenticatedLayout,
})
