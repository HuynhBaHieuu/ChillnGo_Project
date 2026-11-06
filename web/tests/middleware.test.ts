import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import middleware, { config } from '../middleware.ts'

const ORIGIN = 'https://chillgo.example'
const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>'
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

function request(path: string, accept?: string, method = 'GET'): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers: accept ? { Accept: accept } : {} })
}

/** Vercel's "continue to the next handler" response, as `next()` from @vercel/functions builds it. */
function assertContinues(response: Response, label = '') {
  assert.equal(response.headers.get('x-middleware-next'), '1', `${label} should continue via next()`)
}

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

describe('middleware: always answers with a Response', () => {
  it('never returns undefined, which Vercel cannot invoke', async () => {
    for (const [path, accept] of [
      ['/', BROWSER],
      ['/', 'text/markdown'],
      ['/nope', BROWSER],
      ['/favicon.svg', undefined],
      ['/developers', BROWSER],
    ] as const) {
      assert.ok((await middleware(request(path, accept))) instanceof Response, path)
    }
  })

  it('falls back to next() when its own logic throws', async (t) => {
    t.mock.method(console, 'error', () => {})
    // A Request whose headers getter throws stands in for any unexpected bug.
    const broken = request('/', 'text/markdown')
    Object.defineProperty(broken, 'headers', {
      get() {
        throw new Error('boom')
      },
    })
    assertContinues(await middleware(broken))
  })
})

describe('middleware: Markdown negotiation', () => {
  it('serves the home page as Markdown with Vary: Accept', async () => {
    const response = await middleware(request('/', 'text/markdown'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(response.headers.get('vary'), 'Accept')
    assert.equal(response.headers.get('x-middleware-next'), null)
    const body = await response.text()
    assert.match(body, /^# ChillnGo/)
    assert.ok(body.length > 500)
    assert.match(body, new RegExp(`\\(${ORIGIN}/llms.txt\\)`), 'links are absolute, on the request origin')
    assert.match(body, new RegExp(`\\(${ORIGIN}/developers\\)`))
  })

  it('serves public inner pages and the developer pages as Markdown', async () => {
    for (const path of ['/discover', '/feed', '/live', '/feed/', '/developers', '/developers/cli']) {
      const response = await middleware(request(path, 'text/markdown'))
      assert.equal(response.status, 200, path)
      assert.match(await response.text(), /^# /, path)
    }
  })

  it('names the product and "API" in the developer portal heading, and the tool in the CLI heading', async () => {
    assert.match(await (await middleware(request('/developers', 'text/markdown'))).text(), /^# ChillnGo API/)
    assert.match(await (await middleware(request('/developers/cli', 'text/markdown'))).text(), /^# ChillnGo CLI/)
  })

  it('lets browsers through to the HTML app and pages', async () => {
    assertContinues(await middleware(request('/', BROWSER)), '/')
    assertContinues(await middleware(request('/', 'text/html')), '/ html')
    assertContinues(await middleware(request('/discover')), '/discover')
    assertContinues(await middleware(request('/developers', BROWSER)), '/developers')
    assertContinues(await middleware(request('/developers/cli', BROWSER)), '/developers/cli')
  })

  it('lets pages without a Markdown version through to the HTML app', async () => {
    assertContinues(await middleware(request('/posts/65a1b2c3d4e5f6a7b8c9d0e1', 'text/markdown')))
  })

  it('answers HEAD with headers only', async () => {
    const response = await middleware(request('/', 'text/markdown', 'HEAD'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(await response.text(), '')
  })
})

describe('middleware: 404s', () => {
  it('answers an unknown path with 404 Markdown for agents', async () => {
    const response = await middleware(request('/some-path-that-does-not-exist', 'text/markdown'))
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
    assert.equal(response.headers.get('vary'), 'Accept')
    const body = await response.text()
    assert.ok(body.length >= 20)
    assert.match(body, /some-path-that-does-not-exist/)
    assert.match(body, /llms\.txt/)
    assert.match(body, /openapi\.json/)
    assert.equal(fetchMock.mock.callCount(), 0)
  })

  it('answers an unknown path with the app shell and a 404 status for browsers', async () => {
    const response = await middleware(request('/some-path-that-does-not-exist', BROWSER))
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
    assert.equal(await response.text(), SHELL)
  })

  it('falls back to a plain HTML 404 when the shell cannot be fetched', async () => {
    fetchMock.mock.mockImplementation(async () => new Response('nope', { status: 401 }))
    const response = await middleware(request('/nope'))
    assert.equal(response.status, 404)
    assert.match(await response.text(), /<h1>404/)
  })

  it('lets files, well-known metadata, the API and non-GET requests through', async () => {
    for (const [path, accept, method] of [
      ['/llms.txt', 'text/markdown', 'GET'],
      ['/openapi.json', undefined, 'GET'],
      ['/favicon.svg', undefined, 'GET'],
      ['/developers.html', undefined, 'GET'],
      ['/.well-known/api-catalog', undefined, 'GET'],
      ['/api/nope', 'text/markdown', 'GET'],
      ['/api', undefined, 'GET'],
      ['/nope', BROWSER, 'POST'],
    ] as const) {
      assertContinues(await middleware(request(path, accept, method)), `${method} ${path}`)
    }
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
