import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Request, Response } from 'express'
import { z } from 'zod'

import { API_DOCS_PATH, HttpError, errorBody, errorHandler, rateLimitBody } from './errors.js'

/** Just enough of an Express response to capture what errorHandler sends. */
function fakeResponse() {
  const sent: { status?: number; body?: Record<string, unknown> } = {}
  const res = {
    status(code: number) {
      sent.status = code
      return res
    },
    json(body: Record<string, unknown>) {
      sent.body = body
      return res
    },
  }
  return { res: res as unknown as Response, sent }
}

function handle(error: unknown) {
  const { res, sent } = fakeResponse()
  errorHandler(error, {} as Request, res, () => {})
  return sent
}

const REQUIRED_FIELDS = ['message', 'code', 'status', 'hint', 'docs']

describe('errorBody', () => {
  it('fills a default code, the status, a hint and the docs link', () => {
    const body = errorBody(404, 'Không tìm thấy')
    assert.equal(body.code, 'NOT_FOUND')
    assert.equal(body.status, 404)
    assert.equal(body.docs, API_DOCS_PATH)
    assert.ok(body.hint.length > 20)
  })

  it('keeps a code the route chose', () => {
    assert.equal(errorBody(403, 'x', 'EMAIL_NOT_VERIFIED').code, 'EMAIL_NOT_VERIFIED')
  })

  it('falls back by status class for statuses without their own entry', () => {
    assert.equal(errorBody(418, 'x').code, 'BAD_REQUEST')
    assert.equal(errorBody(504, 'x').code, 'INTERNAL_ERROR')
  })

  it('omits issues when there are none', () => {
    assert.equal('issues' in errorBody(400, 'x', undefined, []), false)
  })
})

describe('rateLimitBody', () => {
  it('is a 429 RATE_LIMITED body unless the limiter names its own code', () => {
    assert.equal(rateLimitBody('chậm lại').code, 'RATE_LIMITED')
    assert.equal(rateLimitBody('chậm lại').status, 429)
    assert.equal(rateLimitBody('chậm lại', 'REACTION_RATE_LIMIT').code, 'REACTION_RATE_LIMIT')
  })
})

describe('errorHandler', () => {
  it('sends an HttpError with its status, message and code', () => {
    const sent = handle(new HttpError(403, 'Chưa xác nhận email', 'EMAIL_NOT_VERIFIED'))
    assert.equal(sent.status, 403)
    assert.equal(sent.body?.message, 'Chưa xác nhận email')
    assert.equal(sent.body?.code, 'EMAIL_NOT_VERIFIED')
    for (const field of REQUIRED_FIELDS) assert.ok(field in (sent.body ?? {}), field)
  })

  it('gives an HttpError without a code the default for its status', () => {
    assert.equal(handle(new HttpError(401, 'Hết phiên')).body?.code, 'UNAUTHORIZED')
  })

  it('turns a ZodError into a 400 with every field issue', () => {
    const result = z.object({ email: z.string('Vui lòng nhập email') }).safeParse({})
    assert.equal(result.success, false)
    const sent = handle(result.error)
    assert.equal(sent.status, 400)
    assert.equal(sent.body?.code, 'VALIDATION_FAILED')
    assert.equal(sent.body?.message, 'Vui lòng nhập email')
    assert.deepEqual(sent.body?.issues, [{ path: 'email', message: 'Vui lòng nhập email' }])
  })

  it('answers malformed JSON with 400 INVALID_JSON', () => {
    const sent = handle(Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed' }))
    assert.equal(sent.status, 400)
    assert.equal(sent.body?.code, 'INVALID_JSON')
  })

  it('answers an oversized body with 413', () => {
    const sent = handle(Object.assign(new Error('big'), { type: 'entity.too.large' }))
    assert.equal(sent.status, 413)
    assert.equal(sent.body?.code, 'PAYLOAD_TOO_LARGE')
  })

  it('hides unexpected errors behind a 500 INTERNAL_ERROR', (t) => {
    t.mock.method(console, 'error', () => {})
    const sent = handle(new Error('secret stack detail'))
    assert.equal(sent.status, 500)
    assert.equal(sent.body?.code, 'INTERNAL_ERROR')
    assert.doesNotMatch(JSON.stringify(sent.body), /secret stack detail/)
  })
})
