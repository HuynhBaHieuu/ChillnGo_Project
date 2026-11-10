import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { businessInputSchema, isPublic, isSponsored, reviewSchema, shuffled, slugify } from './businesses.js'

const NOW = Date.UTC(2026, 10, 10)
const day = 24 * 60 * 60 * 1000

const valid = {
  name: 'Homestay Mây Đà Lạt',
  type: 'homestay',
  address: '12 Trần Hưng Đạo, Phường 3, Đà Lạt',
  phone: '0912 345 678',
}

describe('business pages', () => {
  it('makes an address from the name, without diacritics', () => {
    assert.equal(slugify('Homestay Mây Đà Lạt'), 'homestay-may-da-lat')
    assert.equal(slugify('  Quán Ốc   Đêm!! '), 'quan-oc-dem')
    assert.equal(slugify('!!!'), 'co-so')
  })

  it('accepts a minimal page and fills in the rest', () => {
    const parsed = businessInputSchema.parse(valid)
    assert.equal(parsed.priceFrom, null)
    assert.deepEqual(parsed.photos, [])
  })

  it('rejects a bad phone, an unknown type, http photos and a reversed price range', () => {
    assert.equal(businessInputSchema.safeParse({ ...valid, phone: 'abc' }).success, false)
    assert.equal(businessInputSchema.safeParse({ ...valid, type: 'bar' }).success, false)
    assert.equal(businessInputSchema.safeParse({ ...valid, photos: ['http://x.test/a.jpg'] }).success, false)
    assert.equal(businessInputSchema.safeParse({ ...valid, priceFrom: 500_000, priceTo: 100_000 }).success, false)
  })

  it('is public once approved and not hidden by moderators', () => {
    assert.equal(isPublic({ status: 'approved' }), true)
    assert.equal(isPublic({ status: 'pending' }), false)
    assert.equal(isPublic({ status: 'hidden' }), false)
    assert.equal(isPublic({ status: 'approved', moderation: { hidden: true } }), false)
  })

  it('is sponsored only while public and paid up', () => {
    const future = new Date(NOW + day)
    const past = new Date(NOW - day)
    assert.equal(isSponsored({ status: 'approved', promotedUntil: future }, NOW), true)
    assert.equal(isSponsored({ status: 'approved', promotedUntil: past }, NOW), false)
    assert.equal(isSponsored({ status: 'pending', promotedUntil: future }, NOW), false)
    assert.equal(isSponsored({ status: 'approved', promotedUntil: null }, NOW), false)
  })

  it('needs a reason to reject or hide, not to approve', () => {
    assert.equal(reviewSchema.safeParse({ action: 'reject' }).success, false)
    assert.equal(reviewSchema.safeParse({ action: 'hide', reason: '' }).success, false)
    assert.equal(reviewSchema.safeParse({ action: 'approve' }).success, true)
    assert.equal(reviewSchema.safeParse({ action: 'reject', reason: 'Thiếu ảnh' }).success, true)
  })

  it('shuffles without losing or adding anything', () => {
    const items = [1, 2, 3, 4, 5]
    const out = shuffled(items, () => 0)
    assert.deepEqual([...out].sort(), items)
    assert.deepEqual(items, [1, 2, 3, 4, 5])
  })
})
