import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { visibleCompanions } from './companions.js'
import type { Companion } from './companions.js'

const companions: Companion[] = [
  { userId: 'b', status: 'accepted' },
  { userId: 'c', status: 'pending' },
  { userId: 'd', status: 'pending' },
]

describe('visibleCompanions', () => {
  it('shows the author every invite', () => {
    assert.deepEqual(visibleCompanions(companions, 'a', 'a'), companions)
  })

  it('shows an invitee those who accepted and their own invite', () => {
    assert.deepEqual(visibleCompanions(companions, 'a', 'c').map((c) => c.userId), ['b', 'c'])
  })

  it('shows everyone else only those who accepted', () => {
    assert.deepEqual(visibleCompanions(companions, 'a', 'x').map((c) => c.userId), ['b'])
    assert.deepEqual(visibleCompanions(companions, 'a', undefined).map((c) => c.userId), ['b'])
  })
})
