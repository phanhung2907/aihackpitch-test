// Single HTTP client for the banking API. Screens call these helpers and never
// fetch directly, so auth, CSRF and the response envelope stay in one place.
//
// In dev, Vite proxies /api to the backend so the browser treats the API as
// same-origin: the HttpOnly `bank_session` cookie is sent automatically and the
// Origin header stays the frontend origin, which the backend checks on writes.

const BASE = '/api/v1'

export type ApiMeta = {
  next_cursor: string | null
  limit: number
}

export class ApiError extends Error {
  status: number
  code: string
  details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`
  let message = response.statusText || code
  let details: unknown
  try {
    const body = await response.json()
    const error = body?.error ?? body
    if (typeof error?.code === 'string') code = error.code
    if (typeof error?.message === 'string') message = error.message
    details = error?.details
  } catch {
    // A non-JSON body (proxy error page, empty 502) keeps the status-based code.
  }
  return new ApiError(response.status, code, message, details)
}

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown
    csrfToken?: string | null
    idempotencyKey?: string
    signal?: AbortSignal
  } = {}
): Promise<{ data: T; meta?: ApiMeta }> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && method !== 'HEAD') {
    // The backend rejects writes without a CSRF token bound to the session.
    if (options.csrfToken) headers['X-CSRF-Token'] = options.csrfToken
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey
    }
  }

  const response = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'same-origin',
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return { data: undefined as T }

  const body = await response.json()
  return { data: body.data as T, meta: body.meta as ApiMeta | undefined }
}

export async function apiGet<T>(
  path: string,
  signal?: AbortSignal
): Promise<{ data: T; meta?: ApiMeta }> {
  return request<T>('GET', path, { signal })
}

export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: {
    body?: unknown
    csrfToken?: string | null
    idempotencyKey?: string
  } = {}
): Promise<{ data: T }> {
  const { data } = await request<T>(method, path, options)
  return { data }
}

/**
 * One key per money command. A retry of the same command must reuse its key,
 * so callers generate the key once and keep it across retries.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
