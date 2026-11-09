import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AUTO_HIDE_THRESHOLD,
  allowedActions,
  countReasons,
  createReportSchema,
  hasModules,
  isDuplicateReport,
  isSelfReport,
  outcomeOf,
  requiredModules,
  resolveSchema,
  shouldAutoHide,
} from './reports.js'
import { effectivePermissions } from './permissions.js'

const ID = '0123456789abcdef01234567'

describe('createReportSchema (the target and reason checks)', () => {
  it('accepts a report with a known target type and reason', () => {
    const parsed = createReportSchema.parse({ targetType: 'post', targetId: ID, reason: 'spam' })
    assert.equal(parsed.note, '')
  })

  it('refuses an unknown target type or a malformed id', () => {
    assert.equal(createReportSchema.safeParse({ targetType: 'livestream', targetId: ID, reason: 'spam' }).success, false)
    assert.equal(createReportSchema.safeParse({ targetType: 'post', targetId: 'p_001', reason: 'spam' }).success, false)
  })

  it('needs a note for "other", and no more than 500 characters', () => {
    assert.equal(createReportSchema.safeParse({ targetType: 'user', targetId: ID, reason: 'other' }).success, false)
    assert.equal(createReportSchema.safeParse({ targetType: 'user', targetId: ID, reason: 'other', note: '   ' }).success, false)
    assert.equal(createReportSchema.safeParse({ targetType: 'user', targetId: ID, reason: 'other', note: 'lừa đảo' }).success, true)
    assert.equal(createReportSchema.safeParse({ targetType: 'user', targetId: ID, reason: 'spam', note: 'x'.repeat(501) }).success, false)
  })
})

describe('self reports and duplicates', () => {
  it('spots reporting yourself', () => {
    assert.equal(isSelfReport('a', 'a'), true)
    assert.equal(isSelfReport('a', 'b'), false)
  })

  it('treats a duplicate-key error as "already reported", nothing else', () => {
    assert.equal(isDuplicateReport({ code: 11000 }), true)
    assert.equal(isDuplicateReport(new Error('boom')), false)
    assert.equal(isDuplicateReport(null), false)
  })
})

describe('shouldAutoHide', () => {
  it('hides content once the threshold of different reporters is reached', () => {
    assert.equal(shouldAutoHide('post', AUTO_HIDE_THRESHOLD - 1, false), false)
    assert.equal(shouldAutoHide('post', AUTO_HIDE_THRESHOLD, false), true)
    assert.equal(shouldAutoHide('comment', AUTO_HIDE_THRESHOLD + 3, false), true)
  })

  it('leaves hidden content and accounts alone', () => {
    assert.equal(shouldAutoHide('checkin', AUTO_HIDE_THRESHOLD, true), false)
    assert.equal(shouldAutoHide('user', 100, false), false)
  })

  it('takes another threshold', () => {
    assert.equal(shouldAutoHide('post', 2, false, 2), true)
  })
})

describe('decisions and permissions', () => {
  it('only lets an account be dismissed or locked', () => {
    assert.deepEqual(allowedActions('user'), ['dismiss', 'lock'])
    assert.deepEqual(allowedActions('post'), ['dismiss', 'hide', 'remove', 'lock'])
  })

  it('needs the Users module to lock, Reports for the rest', () => {
    const reportsOnly = effectivePermissions({ role: 'admin', adminPermissions: ['reports'] })
    assert.equal(hasModules(reportsOnly, requiredModules('hide')), true)
    assert.equal(hasModules(reportsOnly, requiredModules('lock')), false)

    const both = effectivePermissions({ role: 'admin', adminPermissions: ['reports', 'users'] })
    assert.equal(hasModules(both, requiredModules('lock')), true)

    assert.equal(hasModules(effectivePermissions({ role: 'superadmin' }), requiredModules('lock')), true)
    assert.equal(hasModules(effectivePermissions({ role: 'user', adminPermissions: ['reports'] }), requiredModules('dismiss')), false)
  })

  it('maps each decision to what the reports record', () => {
    assert.deepEqual(outcomeOf('dismiss'), { status: 'dismissed', action: 'none' })
    assert.deepEqual(outcomeOf('remove'), { status: 'resolved', action: 'remove' })
  })

  it('refuses an unknown decision', () => {
    assert.equal(resolveSchema.safeParse({ action: 'ban' }).success, false)
    assert.equal(resolveSchema.safeParse({ action: 'hide' }).success, true)
  })
})

describe('countReasons', () => {
  it('counts every reason, zeros included', () => {
    const counts = countReasons(['spam', 'spam', 'scam', 'nonsense'])
    assert.equal(counts.spam, 2)
    assert.equal(counts.scam, 1)
    assert.equal(counts.other, 0)
    assert.equal(Object.keys(counts).length, 6)
  })
})
