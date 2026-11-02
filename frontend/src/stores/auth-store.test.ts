import { beforeEach, describe, expect, it } from 'vitest'
import { currentCsrfToken, useAuthStore, type AuthUser } from './auth-store'

const user: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  login: 'analyst',
  role: 'fraud_analyst',
  customer_id: null,
  branch_id: null,
  enabled: true,
  version: 1,
}

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().auth.reset()
  })

  it('starts with no session', () => {
    const { auth } = useAuthStore.getState()
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBeNull()
    expect(currentCsrfToken()).toBeNull()
  })

  it('stores the user and csrf token from a session response', () => {
    useAuthStore.getState().auth.setSession({
      user,
      csrf_token: 'csrf-value',
      expires_at: '2026-11-03T12:00:00Z',
    })

    const { auth } = useAuthStore.getState()
    expect(auth.user?.login).toBe('analyst')
    expect(auth.user?.role).toBe('fraud_analyst')
    expect(auth.expiresAt).toBe('2026-11-03T12:00:00Z')
    // Mutation helpers read the token outside React, so this must stay in sync.
    expect(currentCsrfToken()).toBe('csrf-value')
  })

  it('clears everything on reset', () => {
    useAuthStore.getState().auth.setSession({
      user,
      csrf_token: 'csrf-value',
      expires_at: '2026-11-03T12:00:00Z',
    })

    useAuthStore.getState().auth.reset()

    const { auth } = useAuthStore.getState()
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBeNull()
    expect(auth.expiresAt).toBeNull()
  })
})
