import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { APP_ROUTES, isAppRoute } from './routes.ts'

describe('isAppRoute', () => {
  it('knows the static pages', () => {
    for (const path of ['/', '/feed', '/discover', '/live', '/login', '/register', '/verify-email', '/profile/edit']) {
      assert.equal(isAppRoute(path), true, path)
    }
  })

  it('matches one segment per parameter', () => {
    assert.equal(isAppRoute('/posts/65a1b2c3d4e5f6a7b8c9d0e1'), true)
    assert.equal(isAppRoute('/posts/65a1b2c3d4e5f6a7b8c9d0e1/edit'), true)
    assert.equal(isAppRoute('/posts/abc/edit/more'), false)
    assert.equal(isAppRoute('/users/abc'), true)
    assert.equal(isAppRoute('/users'), false)
    assert.equal(isAppRoute('/discover/interest/bien'), true)
  })

  it('treats a `?` parameter as optional', () => {
    assert.equal(isAppRoute('/activity'), true)
    assert.equal(isAppRoute('/activity/search'), true)
    assert.equal(isAppRoute('/activity/search/extra'), false)
  })

  it('sends anything under /admin to the admin console', () => {
    assert.equal(isAppRoute('/admin'), true)
    assert.equal(isAppRoute('/admin/users/42'), true)
  })

  it('tolerates a trailing slash, as react-router does', () => {
    assert.equal(isAppRoute('/feed/'), true)
  })

  it('rejects paths the app has no page for', () => {
    for (const path of ['/some-path-that-does-not-exist', '/feeds', '/wp-admin', '/posts', '/live/a/b']) {
      assert.equal(isAppRoute(path), false, path)
    }
  })
})

describe('APP_ROUTES', () => {
  it('lists every page path declared in src/app/router.tsx', () => {
    const router = readFileSync(new URL('../src/app/router.tsx', import.meta.url), 'utf8')
    const declared = [...router.matchAll(/path: '([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '*')
    assert.ok(declared.length > 10, 'router.tsx paths were not found; did its syntax change?')
    for (const path of declared) {
      const listed = (APP_ROUTES as readonly string[]).includes(path) || (path.startsWith('/admin') && APP_ROUTES.includes('/admin/*'))
      assert.ok(listed, `${path} is in router.tsx but not in agent/routes.ts`)
    }
    for (const path of APP_ROUTES) {
      if (path === '/admin/*') continue
      assert.ok(declared.includes(path), `${path} is in agent/routes.ts but not in router.tsx`)
    }
  })
})
