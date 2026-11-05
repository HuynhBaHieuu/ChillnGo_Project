import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RESET_TTL_MINUTES, createResetToken, hashToken, issuedBeforePasswordChange } from './verification.js'

describe('createResetToken', () => {
  it('stores only the hash of the emailed token', () => {
    const { token, hash } = createResetToken()
    assert.equal(hash, hashToken(token))
    assert.notEqual(hash, token)
  })

  it('expires after the reset lifetime', () => {
    const before = Date.now()
    const { expiresAt } = createResetToken()
    assert.ok(expiresAt.getTime() >= before + RESET_TTL_MINUTES * 60 * 1000)
    assert.ok(expiresAt.getTime() <= Date.now() + RESET_TTL_MINUTES * 60 * 1000)
  })
})

describe('issuedBeforePasswordChange', () => {
  const changedAt = new Date('2026-01-01T00:00:10.500Z')
  const seconds = (iso: string) => new Date(iso).getTime() / 1000

  it('keeps tokens when the password never changed', () => {
    assert.equal(issuedBeforePasswordChange(seconds('2026-01-01T00:00:00Z'), undefined), false)
  })

  it('rejects a token issued before the change', () => {
    assert.equal(issuedBeforePasswordChange(seconds('2026-01-01T00:00:09Z'), changedAt), true)
  })

  it('keeps a sign-in from the same second as the change', () => {
    assert.equal(issuedBeforePasswordChange(seconds('2026-01-01T00:00:10Z'), changedAt), false)
  })

  it('keeps a token issued after the change', () => {
    assert.equal(issuedBeforePasswordChange(seconds('2026-01-01T00:00:11Z'), changedAt), false)
  })
})
