import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { DEFAULT_BASE_URL } from './client.js'
import { HELP, VERSION, run } from './cli.js'

const POST = {
  _id: 'p1',
  title: 'Hội An 2 ngày',
  summary: 'Lịch nhẹ nhàng.',
  region: 'central',
  season: 'summer',
  startDate: '2026-06-20',
  endDate: '2026-06-21',
  tags: ['family'],
  totalEstCost: 6340000,
  likeCount: 129,
  cloneCount: 22,
  days: [{ dayNumber: 1, date: '2026-06-20', title: 'Phố cổ', locations: [{ name: 'Phố cổ Hội An', note: 'Vé cho cả nhà.', estCost: 480000 }] }],
}

/** A fake API: answers by "METHOD /path", records every request. */
function fakeApi(routes) {
  const calls = []
  const fetch = async (url, init = {}) => {
    const u = new URL(url)
    calls.push({ url: u, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined })
    const route = routes[`${init.method} ${u.pathname}`]
    if (!route) {
      return Response.json({ message: 'Không tìm thấy', code: 'NOT_FOUND', status: 404, hint: 'Check the path.', docs: '/api/openapi.json' }, { status: 404 })
    }
    const [status, body] = typeof route === 'function' ? route(u, init) : Array.isArray(route) ? route : [200, route]
    return Response.json(body, { status })
  }
  return { fetch, calls }
}

let dir
let out
let err

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chillngo-test-'))
  out = []
  err = []
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function io(api, env = {}, extra = {}) {
  return {
    stdout: (t) => out.push(t),
    stderr: (t) => err.push(t),
    env: { CHILLNGO_CONFIG_DIR: dir, ...env },
    fetch: api.fetch,
    ...extra,
  }
}

describe('help and version', () => {
  it('prints help with no command, help, or --help', async () => {
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      out = []
      assert.equal(await run(argv, io(fakeApi({}))), 0)
      assert.equal(out[0], HELP)
    }
  })

  it('prints the version', async () => {
    assert.equal(await run(['--version'], io(fakeApi({}))), 0)
    assert.deepEqual(out, [VERSION])
  })

  it('rejects unknown commands and options with exit code 2', async () => {
    assert.equal(await run(['fly'], io(fakeApi({}))), 2)
    assert.match(err[0], /Unknown command "fly"/)
    assert.equal(await run(['posts', '--nope'], io(fakeApi({}))), 2)
  })
})

describe('reading public data', () => {
  it('lists journeys from the default server, passing --author', async () => {
    const api = fakeApi({ 'GET /api/posts': { items: [POST], authors: [] } })
    assert.equal(await run(['posts', '--author', 'u1'], io(api)), 0)
    assert.equal(api.calls[0].url.origin, DEFAULT_BASE_URL)
    assert.equal(api.calls[0].url.searchParams.get('author'), 'u1')
    assert.equal(api.calls[0].headers.Authorization, undefined)
    assert.match(out[0], /p1 {2}Hội An 2 ngày/)
    assert.match(out[0], /central · summer · 1 days · 6\.340\.000 ₫ · ♥ 129 · 22 clones/)
  })

  it('prints raw JSON with --json', async () => {
    const body = { items: [POST], authors: [] }
    assert.equal(await run(['posts', '--json'], io(fakeApi({ 'GET /api/posts': body }))), 0)
    assert.deepEqual(JSON.parse(out[0]), body)
  })

  it('shows one journey day by day', async () => {
    const api = fakeApi({ 'GET /api/posts/p1': { post: POST, authors: [] } })
    assert.equal(await run(['post', 'p1'], io(api)), 0)
    assert.match(out[0], /^Hội An 2 ngày\nLịch nhẹ nhàng\./)
    assert.match(out[0], /Day 1 \(2026-06-20\) — Phố cổ\n {2}• Phố cổ Hội An {2}480\.000 ₫\n {6}Vé cho cả nhà\./)
  })

  it('requires an id for post and user', async () => {
    assert.equal(await run(['post'], io(fakeApi({}))), 2)
    assert.match(err[0], /Usage: chillngo post <id>/)
  })

  it('lists check-ins, livestreams and a profile', async () => {
    const api = fakeApi({
      'GET /api/checkins': { items: [{ _id: 'c1', caption: 'Bình minh', createdAt: '2026-11-01', location: { name: 'Đà Lạt' }, author: { username: 'hieu' } }] },
      'GET /api/livestreams': { items: [] },
      'GET /api/users/u1': { user: { _id: 'u1', username: 'hieu', displayName: 'Hiếu', postCount: 3, followerCount: 10, followingCount: 2 } },
    })
    assert.equal(await run(['checkins', '--authors', 'a,b'], io(api)), 0)
    assert.equal(api.calls[0].url.searchParams.get('authors'), 'a,b')
    assert.match(out[0], /c1 {2}hieu @ Đà Lạt/)
    assert.equal(await run(['live'], io(api)), 0)
    assert.equal(out[1], 'Nobody is live right now.')
    assert.equal(await run(['user', 'u1'], io(api)), 0)
    assert.match(out[2], /Hiếu \(@hieu\) {2}u1\n3 journeys · 10 followers · 2 following/)
  })

  it('honours --base-url and CHILLNGO_API_URL', async () => {
    const api = fakeApi({ 'GET /api/livestreams': { items: [] } })
    await run(['live'], io(api, { CHILLNGO_API_URL: 'http://localhost:4000/' }))
    assert.equal(api.calls[0].url.origin, 'http://localhost:4000')
    await run(['live', '--base-url', 'http://127.0.0.1:9'], io(api, { CHILLNGO_API_URL: 'http://localhost:4000' }))
    assert.equal(api.calls[1].url.origin, 'http://127.0.0.1:9')
  })
})

describe('errors', () => {
  it('prints the API error with its code and hint, exit code 1', async () => {
    assert.equal(await run(['post', 'missing'], io(fakeApi({}))), 1)
    assert.equal(err[0], 'Error 404 NOT_FOUND: Không tìm thấy\nHint: Check the path.')
  })

  it('prints field issues for validation errors', async () => {
    const api = fakeApi({
      'POST /api/auth/login': [400, { message: 'Vui lòng nhập email', code: 'VALIDATION_FAILED', status: 400, hint: 'Fix it.', issues: [{ path: 'email', message: 'Vui lòng nhập email' }] }],
    })
    assert.equal(await run(['login', '--email', 'x'], io(api, { CHILLNGO_PASSWORD: 'pw' })), 1)
    assert.match(err[0], / {2}email: Vui lòng nhập email/)
  })

  it('prints errors as JSON with --json', async () => {
    assert.equal(await run(['post', 'missing', '--json'], io(fakeApi({}))), 1)
    assert.deepEqual(JSON.parse(err[0]), { status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy', hint: 'Check the path.' })
  })

  it('explains a network failure', async () => {
    const failing = { fetch: async () => { throw new Error('connect ECONNREFUSED') } }
    assert.equal(await run(['live'], io(failing)), 1)
    assert.match(err[0], /^Error NETWORK_ERROR: Could not reach .*ECONNREFUSED/)
  })
})

describe('signing in', () => {
  const loginApi = () =>
    fakeApi({
      'POST /api/auth/login': { token: 'tok-123', user: { _id: 'u1', username: 'hieu' } },
      'GET /api/auth/me': (_url, init) =>
        init.headers.Authorization === 'Bearer tok-123'
          ? [200, { user: { _id: 'u1', username: 'hieu', displayName: 'Hiếu' } }]
          : [401, { message: 'Hết phiên', code: 'UNAUTHORIZED', status: 401, hint: 'Sign in.' }],
    })

  it('logs in with CHILLNGO_PASSWORD, saves the token, and uses it', async () => {
    const api = loginApi()
    assert.equal(await run(['login', '--email', 'a@b.vn'], io(api, { CHILLNGO_PASSWORD: 'secret' })), 0)
    assert.deepEqual(api.calls[0].body, { email: 'a@b.vn', password: 'secret' })
    assert.match(out[0], /Signed in as @hieu/)

    const saved = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'))
    assert.equal(saved.token, 'tok-123')
    if (process.platform !== 'win32') assert.equal((await stat(join(dir, 'config.json'))).mode & 0o777, 0o600)

    assert.equal(await run(['me'], io(api)), 0)
    assert.match(out[1], /Hiếu \(@hieu\)/)
  })

  it('asks for the password when CHILLNGO_PASSWORD is unset', async () => {
    const api = loginApi()
    let asked = ''
    const promptPassword = async (q) => {
      asked = q
      return 'typed'
    }
    assert.equal(await run(['login', '--email', 'a@b.vn'], io(api, {}, { promptPassword })), 0)
    assert.equal(asked, 'Password: ')
    assert.equal(api.calls[0].body.password, 'typed')
  })

  it('prefers CHILLNGO_TOKEN over the saved token', async () => {
    const api = loginApi()
    assert.equal(await run(['me'], io(api, { CHILLNGO_TOKEN: 'tok-123' })), 0)
  })

  it('refuses `me` without a token, and forgets it on logout', async () => {
    const api = loginApi()
    assert.equal(await run(['me'], io(api)), 2)
    await run(['login', '--email', 'a@b.vn'], io(api, { CHILLNGO_PASSWORD: 'x' }))
    assert.equal(await run(['logout'], io(api)), 0)
    assert.equal(await run(['me'], io(api)), 2)
  })
})

describe('api and openapi', () => {
  it('calls any endpoint with a JSON body', async () => {
    const api = fakeApi({ 'POST /api/activity/search-history': { ok: true } })
    const code = await run(['api', 'post', '/api/activity/search-history', '--data', '{"type":"place","query":"Huế"}'], io(api, { CHILLNGO_TOKEN: 't' }))
    assert.equal(code, 0)
    assert.equal(api.calls[0].method, 'POST')
    assert.deepEqual(api.calls[0].body, { type: 'place', query: 'Huế' })
    assert.equal(api.calls[0].headers.Authorization, 'Bearer t')
    assert.deepEqual(JSON.parse(out[0]), { ok: true })
  })

  it('rejects bad methods and invalid JSON before calling the API', async () => {
    const api = fakeApi({})
    assert.equal(await run(['api', 'FETCH', '/api/posts'], io(api)), 2)
    assert.equal(await run(['api', 'POST', '/api/posts', '--data', '{nope'], io(api)), 2)
    assert.equal(api.calls.length, 0)
  })

  it('prints the OpenAPI description', async () => {
    const api = fakeApi({ 'GET /api/openapi.json': { openapi: '3.1.0' } })
    assert.equal(await run(['openapi'], io(api)), 0)
    assert.equal(JSON.parse(out[0]).openapi, '3.1.0')
  })
})
