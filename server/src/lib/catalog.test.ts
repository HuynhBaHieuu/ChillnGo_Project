import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CHECKLIST_TAGS, catalogMeta, checklistSchema, destinationSchema, placeSchema } from './catalog.js'

const ID = '0123456789abcdef01234567'

describe('destinationSchema', () => {
  const valid = { slug: 'Da-Lat', name: 'Đà Lạt', region: 'Lâm Đồng', lat: 11.94, lng: 108.44, radiusKm: 25 }

  it('normalises the slug and sorts and dedupes months', () => {
    const parsed = destinationSchema.parse({ ...valid, rainyMonths: [9, 5, 9, 6] })
    assert.equal(parsed.slug, 'da-lat')
    assert.deepEqual(parsed.rainyMonths, [5, 6, 9])
    assert.deepEqual(parsed.festivals, [])
  })

  it('refuses a slug with spaces or accents, and months outside 1–12', () => {
    assert.equal(destinationSchema.safeParse({ ...valid, slug: 'đà lạt' }).success, false)
    assert.equal(destinationSchema.safeParse({ ...valid, peakMonths: [13] }).success, false)
    assert.equal(destinationSchema.safeParse({ ...valid, radiusKm: 0 }).success, false)
  })
})

describe('placeSchema', () => {
  it('keeps unknown facts null instead of guessing them', () => {
    const parsed = placeSchema.parse({ destinationId: ID, name: 'Hồ Xuân Hương' })
    assert.equal(parsed.avgCost, null)
    assert.equal(parsed.category, null)
    assert.equal(parsed.openingHours, null)
    assert.equal(parsed.photoUrl, null)
    assert.deepEqual(parsed.tags, [])
  })

  it('needs both coordinates or neither', () => {
    assert.equal(placeSchema.safeParse({ destinationId: ID, name: 'A', lat: 11.9 }).success, false)
    assert.equal(placeSchema.safeParse({ destinationId: ID, name: 'A', lat: 11.9, lng: 108.4 }).success, true)
  })

  it('refuses unknown categories and tags, bad hours and non-http photos', () => {
    assert.equal(placeSchema.safeParse({ destinationId: ID, name: 'A', category: 'bar' }).success, false)
    assert.equal(placeSchema.safeParse({ destinationId: ID, name: 'A', tags: ['forest'] }).success, false)
    assert.equal(placeSchema.safeParse({ destinationId: ID, name: 'A', openingHours: { open: '7:00', close: '22:00' } }).success, false)
    assert.equal(placeSchema.safeParse({ destinationId: ID, name: 'A', photoUrl: 'javascript:alert(1)' }).success, false)
  })

  it('treats an empty photo URL as no photo', () => {
    assert.equal(placeSchema.parse({ destinationId: ID, name: 'A', photoUrl: '' }).photoUrl, null)
  })
})

describe('checklistSchema', () => {
  it('needs at least one known tag', () => {
    assert.equal(checklistSchema.safeParse({ text: 'Áo mưa', group: 'Quần áo', tags: [] }).success, false)
    assert.equal(checklistSchema.safeParse({ text: 'Áo mưa', group: 'Quần áo', tags: ['monsoon'] }).success, false)
    assert.deepEqual(checklistSchema.parse({ text: 'Áo mưa', group: 'Quần áo', tags: ['rainy', 'rainy'] }).tags, ['rainy'])
  })
})

describe('catalogMeta', () => {
  it('offers every tag ai/checklist.ts can produce', () => {
    const meta = catalogMeta()
    for (const tag of ['all', 'outdoor', 'rainy', 'peak', 'kids', 'elderly', 'beach', 'food']) {
      assert.ok(meta.checklistTags.includes(tag as (typeof CHECKLIST_TAGS)[number]), tag)
    }
    assert.ok(meta.categories.some((c) => c.key === 'cafe' && c.label === 'Cà phê'))
  })
})
