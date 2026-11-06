/**
 * A small client for the ChillnGo API. It knows the API's error shape
 * ({ message, code, status, hint, docs }) and nothing else, so it works for
 * every endpoint.
 */

export const DEFAULT_BASE_URL = 'https://chillgo-project.vercel.app'

/** An error response from the API, or a network failure (status 0). */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {{ code?: string, hint?: string, issues?: { path: string, message: string }[] }} [details]
   */
  constructor(status, message, details = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = details.code
    this.hint = details.hint
    this.issues = details.issues
  }
}

/**
 * @param {{ baseUrl?: string, token?: string | null, fetch?: typeof fetch, userAgent?: string }} [options]
 */
export function createClient(options = {}) {
  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const token = options.token ?? null

  /**
   * @param {string} method
   * @param {string} path  An API path such as /api/posts, with or without the leading slash.
   * @param {{ query?: Record<string, string | undefined>, body?: unknown }} [request]
   * @returns {Promise<any>}  The parsed JSON body, or the text for non-JSON responses.
   */
  async function request(method, path, request = {}) {
    const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, value)
    }

    /** @type {Record<string, string>} */
    const headers = { Accept: 'application/json', 'User-Agent': options.userAgent ?? 'chillngo-cli' }
    if (request.body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    let response
    try {
      response = await doFetch(url, {
        method: method.toUpperCase(),
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      })
    } catch (error) {
      throw new ApiError(0, `Could not reach ${baseUrl}: ${/** @type {Error} */ (error).message}`, {
        code: 'NETWORK_ERROR',
        hint: 'Check your connection, or point --base-url / CHILLNGO_API_URL at a running server.',
      })
    }

    const type = response.headers.get('content-type') ?? ''
    const data = type.includes('json') ? await response.json().catch(() => null) : await response.text()

    if (!response.ok) {
      const body = data && typeof data === 'object' ? data : {}
      throw new ApiError(response.status, body.message ?? `HTTP ${response.status}`, {
        code: body.code,
        hint: body.hint,
        issues: body.issues,
      })
    }
    return data
  }

  return { baseUrl, request }
}
