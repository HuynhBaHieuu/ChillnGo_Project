import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { APP_ROUTES, isKnownPage } from '../middleware.ts'

describe('isKnownPage', () => {
  it('knows the static pages', () => {
    for (const path of ['/', '/feed', '/discover', '/live', '/login', '/register', '/verify-email', '/profile/edit']) {
      assert.equal(isKnownPage(path), true, path)
    }
  })

  it('matches one segment per parameter', () => {
    assert.equal(isKnownPage('/posts/65a1b2c3d4e5f6a7b8c9d0e1'), true)
    assert.equal(isKnownPage('/posts/65a1b2c3d4e5f6a7b8c9d0e1/edit'), true)
    assert.equal(isKnownPage('/posts/abc/edit/more'), false)
    assert.equal(isKnownPage('/users/abc'), true)
    assert.equal(isKnownPage('/users'), false)
    assert.equal(isKnownPage('/discover/interest/bien'), true)
  })

  it('treats a `?` parameter as optional', () => {
    assert.equal(isKnownPage('/activity'), true)
    assert.equal(isKnownPage('/activity/search'), true)
    assert.equal(isKnownPage('/activity/search/extra'), false)
  })

  it('sends anything under /admin to the admin console', () => {
    assert.equal(isKnownPage('/admin'), true)
    assert.equal(isKnownPage('/admin/users/42'), true)
  })

  it('tolerates a trailing slash, as react-router does', () => {
    assert.equal(isKnownPage('/feed/'), true)
  })

  it('knows the plain HTML developer pages', () => {
    assert.equal(isKnownPage('/developers'), true)
    assert.equal(isKnownPage('/developers/cli'), true)
    assert.equal(isKnownPage('/developers/nope'), false)
  })

  it('rejects paths the app has no page for', () => {
    for (const path of ['/some-path-that-does-not-exist', '/feeds', '/wp-admin', '/posts', '/live/a/b']) {
      assert.equal(isKnownPage(path), false, path)
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
      assert.ok(listed, `${path} is in router.tsx but not in APP_ROUTES (middleware.ts)`)
    }
    for (const path of APP_ROUTES) {
      if (path === '/admin/*') continue
      assert.ok(declared.includes(path), `${path} is in APP_ROUTES (middleware.ts) but not in router.tsx`)
    }
  })
})
