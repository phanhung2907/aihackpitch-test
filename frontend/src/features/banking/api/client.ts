import { useAuthStore } from '@/stores/auth-store'
import type { components } from './schema'
export type Models = components['schemas']
export type Session = Models['Session']
export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message) } }
export async function request<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': useAuthStore.getState().auth.csrfToken } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  if (response.status === 204) return undefined as T
  const result = await response.json()
  if (!response.ok) {
    if (response.status === 401) useAuthStore.getState().auth.reset()
    throw new ApiError(response.status, result.error?.code ?? 'API_ERROR', `${result.error?.message ?? 'Yêu cầu thất bại'} (${result.error?.code ?? response.status})`)
  }
  return result.data as T
}
export async function list<T>(path: string): Promise<T[]> {
  const all: T[] = []; const seen = new Set<string>(); let cursor: string | null = null
  do {
    const response = await fetch(`/api/v1${path}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { credentials: 'same-origin' })
    const result = await response.json()
    if (!response.ok) { if (response.status === 401) useAuthStore.getState().auth.reset(); throw new ApiError(response.status, result.error?.code ?? 'API_ERROR', result.error?.message ?? 'Không tải được dữ liệu') }
    all.push(...result.data); cursor = result.meta?.next_cursor ?? null
    if (cursor && seen.has(cursor)) throw new Error('API trả cursor lặp lại')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return all
}
export function saveSession(session: Session) {
  const auth = useAuthStore.getState().auth
  auth.setUser({ accountNo: session.user.id, email: session.user.login, role: [session.user.role], exp: new Date(session.expires_at).getTime() })
  auth.setCsrfToken(session.csrf_token)
}
export async function getSession() { const session = await request<Session>('/auth/session'); saveSession(session); return session }
export async function login(login: string, password: string) { const session = await request<Session>('/auth/login', 'POST', { login, password }); saveSession(session); return session }
