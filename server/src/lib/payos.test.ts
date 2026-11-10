import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'

import { isValidSignature, sign, signedString } from './payos.js'
import { newOrderCode } from './billing.js'

const KEY = 'test-checksum-key'

describe('PayOS signatures', () => {
  it('signs key=value pairs sorted by key', () => {
    const data = { returnUrl: 'https://a/r', amount: 49000, orderCode: 123, cancelUrl: 'https://a/c', description: 'ChillnGo' }
    assert.equal(
      signedString(data),
      'amount=49000&cancelUrl=https://a/c&description=ChillnGo&orderCode=123&returnUrl=https://a/r',
    )
    const expected = createHmac('sha256', KEY).update(signedString(data)).digest('hex')
    assert.equal(sign(data, KEY), expected)
  })

  it('writes null as empty and arrays as JSON with sorted keys', () => {
    assert.equal(signedString({ b: null, a: [{ y: 1, x: 'n' }] }), 'a=[{"x":"n","y":1}]&b=')
  })

  it('accepts its own signature and rejects a changed amount or a bad signature', () => {
    const data = { orderCode: 42, amount: 49000, code: '00', reference: 'FT1' }
    const signature = sign(data, KEY)
    assert.equal(isValidSignature(data, signature, KEY), true)
    assert.equal(isValidSignature({ ...data, amount: 1000 }, signature, KEY), false)
    assert.equal(isValidSignature(data, signature, 'other-key'), false)
    assert.equal(isValidSignature(data, 'not-hex', KEY), false)
    assert.equal(isValidSignature(data, '', KEY), false)
  })
})

describe('order codes', () => {
  it('are safe integers and differ from one call to the next', () => {
    const now = Date.UTC(2030, 0, 1)
    const codes = new Set(Array.from({ length: 50 }, () => newOrderCode(now)))
    for (const code of codes) assert.ok(Number.isSafeInteger(code))
    assert.ok(codes.size > 1)
  })
})
