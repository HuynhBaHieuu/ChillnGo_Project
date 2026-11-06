import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'

import type { Server } from 'node:http'

/*
 * Over real HTTP, the routes that need no database: the OpenAPI description
 * and the JSON 404. env.ts insists on these two; neither is used here.
 */
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters'
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:1/unused'

let server: Server
let base: string

before(async () => {
  const { app } = await import('./app.js')
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => {
  server.close()
})

describe('GET /api/openapi.json', () => {
  it('serves the OpenAPI 3.1 description as JSON', async () => {
    const response = await fetch(`${base}/api/openapi.json`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/)
    const spec = (await response.json()) as { openapi: string; paths: Record<string, unknown> }
    assert.equal(spec.openapi, '3.1.0')
    assert.ok('/api/posts/{id}' in spec.paths)
  })
})

describe('unknown routes', () => {
  it('answer 404 with a structured JSON error', async () => {
    const response = await fetch(`${base}/no-such-route`)
    assert.equal(response.status, 404)
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/)
    const body = (await response.json()) as Record<string, unknown>
    assert.equal(body.code, 'NOT_FOUND')
    assert.equal(body.status, 404)
    assert.equal(body.docs, '/api/openapi.json')
    assert.equal(typeof body.message, 'string')
    assert.equal(typeof body.hint, 'string')
  })

  it('answer malformed JSON bodies with 400 INVALID_JSON', async () => {
    const response = await fetch(`${base}/no-such-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    assert.equal(response.status, 400)
    assert.equal(((await response.json()) as { code: string }).code, 'INVALID_JSON')
  })
})
