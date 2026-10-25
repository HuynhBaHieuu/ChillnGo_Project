/**
 * Real HTTP transport, for endpoints that exist in `server/`.
 *
 * Services that are still mocked keep using `./client`. As each endpoint lands,
 * its service function switches from `db` to `http()` with the same signature.
 */

import { t } from '@/i18n'
import { optionalEnv } from '@/lib/env'
import { useAuthStore } from '@/store/auth.store'

import { ApiError } from './client'
import { translateServerMessage } from '@/i18n/server'

/**
 * Where the API lives. Blank in local dev: requests go to `/api/...` on the
 * Vite dev server, which proxies them to `server/` (see vite.config.ts).
 * Set VITE_API_URL to the deployed API's URL in production.
 */
const API_URL = (optionalEnv(import.meta.env.VITE_API_URL) ?? '').replace(/\/$/, '')

/** The full address of an API path, for things that fetch it themselves (a video player). */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`
}

interface HttpOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Send the stored token. Off for login/register. Default: true. */
  auth?: boolean
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options
  const token = auth ? useAuthStore.getState().token : null

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(t('Không kết nối được máy chủ. Vui lòng thử lại sau.'), 0)
  }

  const data = (await response.json().catch(() => null)) as { message?: string; code?: string } | null

  if (!response.ok) {
    // A rejected token means the stored session is dead: drop it so the UI
    // stops showing a signed-in user the server no longer recognises.
    if (response.status === 401 && token) useAuthStore.getState().signOut()
    throw new ApiError(
      data?.message ? translateServerMessage(data.message) : t('Máy chủ trả về lỗi {status}', { status: response.status }),
      response.status,
      data?.code,
    )
  }

  return data as T
}
