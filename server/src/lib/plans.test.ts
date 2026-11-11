import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { env } from '../env.js'
import {
  DAY_MS,
  FREE_REPLAY_DAYS,
  PREMIUM_REPLAY_DAYS,
  PRODUCTS,
  aiDailyLimitFor,
  extendUntil,
  isPremium,
  liveQualityFor,
  replayDaysFor,
} from './plans.js'

const NOW = Date.UTC(2026, 10, 10, 12)
const later = (days: number) => new Date(NOW + days * DAY_MS)

describe('plans', () => {
  it('is Premium only while premiumUntil is in the future', () => {
    assert.equal(isPremium({ premiumUntil: later(1) }, NOW), true)
    assert.equal(isPremium({ premiumUntil: later(-1) }, NOW), false)
    assert.equal(isPremium({ premiumUntil: new Date(NOW) }, NOW), false)
    assert.equal(isPremium({ premiumUntil: null }, NOW), false)
    assert.equal(isPremium(null, NOW), false)
  })

  it('gives Premium more AI requests, 1080p and a year of replays', () => {
    const premium = { premiumUntil: later(10) }
    const free = { premiumUntil: later(-10) }
    assert.equal(aiDailyLimitFor(premium, NOW), env.aiDailyLimitPremium)
    assert.equal(aiDailyLimitFor(free, NOW), env.aiDailyLimit)
    assert.ok(env.aiDailyLimitPremium > env.aiDailyLimit)
    assert.equal(liveQualityFor(premium, NOW), '1080p')
    assert.equal(liveQualityFor(free, NOW), '720p')
    assert.equal(replayDaysFor(premium, NOW), PREMIUM_REPLAY_DAYS)
    assert.equal(replayDaysFor(free, NOW), FREE_REPLAY_DAYS)
  })

  it('adds bought days to the time left', () => {
    assert.equal(extendUntil(later(5), 30, NOW).getTime(), later(35).getTime())
  })

  it('counts from now when the plan ran out or never started', () => {
    assert.equal(extendUntil(later(-5), 30, NOW).getTime(), later(30).getTime())
    assert.equal(extendUntil(null, 365, NOW).getTime(), later(365).getTime())
  })

  it('prices every product in whole VND and gives it days', () => {
    for (const product of Object.values(PRODUCTS)) {
      assert.ok(Number.isInteger(product.amount) && product.amount >= 2000, product.id)
      assert.ok(product.days > 0, product.id)
    }
    assert.equal(PRODUCTS.premium_month.amount, 49_000)
    assert.equal(PRODUCTS.premium_year.amount, 490_000)
    assert.equal(PRODUCTS.business_boost_month.amount, 199_000)
  })
})
