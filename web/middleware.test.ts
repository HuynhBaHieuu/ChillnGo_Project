import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import middleware, { config } from './middleware.ts'

const ORIGIN = 'https://chillgo.example'
const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>'

function request(path: string, accept?: string, method = 'GET'): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers: accept ? { Accept: accept } : {} })
}

const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

let fetchMock: ReturnType<typeof mock.method>

beforeEach(() => {
  // The middleware fetches the app shell for HTML 404s.
  fetchMock = mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input)
    assert.equal(url.pathname, '/index.html')
    return new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html' } })
  })
})

afterEach(() => {
  mock.restoreAll()
})

describe('middleware: Markdown negotiation', () => {
  it('serves the home page as Markdown with Vary: Accept', async () => {
    const response = await middleware(request('/', 'text/markdown'))
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(response.headers.get('vary'), 'Accept')
    const body = await response.text()
    assert.match(body, /^# ChillnGo/)
    assert.ok(body.length > 500)
    assert.match(body, new RegExp(`\\(${ORIGIN}/llms.txt\\)`), 'links are absolute, on the request origin')
  })

  it('serves public inner pages as Markdown', async () => {
    for (const path of ['/discover', '/feed', '/live', '/feed/']) {
      const response = await middleware(request(path, 'text/markdown'))
      assert.equal(response?.status, 200, path)
      assert.match(await response!.text(), /^# /, path)
    }
  })

  it('passes browsers through to the HTML app', async () => {
    assert.equal(await middleware(request('/', BROWSER)), undefined)
    assert.equal(await middleware(request('/', 'text/html')), undefined)
    assert.equal(await middleware(request('/discover')), undefined)
  })

  it('passes pages without a Markdown version through to the HTML app', async () => {
    assert.equal(await middleware(request('/posts/65a1b2c3d4e5f6a7b8c9d0e1', 'text/markdown')), undefined)
  })

  it('answers HEAD with headers only', async () => {
    const response = await middleware(request('/', 'text/markdown', 'HEAD'))
    assert.equal(response?.status, 200)
    assert.equal(response?.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(await response?.text(), '')
  })
})

describe('middleware: 404s', () => {
  it('answers an unknown path with 404 Markdown for agents', async () => {
    const response = await middleware(request('/some-path-that-does-not-exist', 'text/markdown'))
    assert.equal(response?.status, 404)
    assert.equal(response?.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(response?.headers.get('vary'), 'Accept')
    const body = await response!.text()
    assert.ok(body.length >= 20)
    assert.match(body, /some-path-that-does-not-exist/)
    assert.match(body, /llms\.txt/)
    assert.match(body, /openapi\.json/)
    assert.equal(fetchMock.mock.callCount(), 0)
  })

  it('answers an unknown path with the app shell and a 404 status for browsers', async () => {
    const response = await middleware(request('/some-path-that-does-not-exist', BROWSER))
    assert.equal(response?.status, 404)
    assert.equal(response?.headers.get('content-type'), 'text/html; charset=utf-8')
    assert.equal(await response!.text(), SHELL)
  })

  it('falls back to a plain HTML 404 when the shell cannot be fetched', async () => {
    fetchMock.mock.mockImplementation(async () => new Response('nope', { status: 401 }))
    const response = await middleware(request('/nope'))
    assert.equal(response?.status, 404)
    assert.match(await response!.text(), /<h1>404/)
  })

  it('leaves files, the API and non-GET requests alone', async () => {
    assert.equal(await middleware(request('/llms.txt', 'text/markdown')), undefined)
    assert.equal(await middleware(request('/openapi.json')), undefined)
    assert.equal(await middleware(request('/favicon.svg')), undefined)
    assert.equal(await middleware(request('/api/nope', 'text/markdown')), undefined)
    assert.equal(await middleware(request('/api')), undefined)
    assert.equal(await middleware(request('/nope', BROWSER, 'POST')), undefined)
    assert.equal(fetchMock.mock.callCount(), 0)
  })
})

describe('middleware config', () => {
  it('excludes the API proxy and built assets', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`)
    assert.match('/', matcher)
    assert.match('/feed', matcher)
    assert.doesNotMatch('/api/posts', matcher)
    assert.doesNotMatch('/assets/index-abc.js', matcher)
  })
})
