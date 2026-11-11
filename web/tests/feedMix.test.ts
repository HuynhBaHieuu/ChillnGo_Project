import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { interleave } from '../src/lib/feedMix.ts'

const kinds = (list: { kind: string }[]) => list.map((m) => (m.kind === 'main' ? 'P' : 'N')).join('')

describe('interleave', () => {
  it('puts one news item after every three posts', () => {
    assert.equal(kinds(interleave([1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c'])), 'PPPNPPPNPN')
  })

  it('shows only news when there are no posts', () => {
    assert.equal(kinds(interleave([], ['a', 'b'])), 'NN')
  })

  it('shows only posts when there is no news', () => {
    assert.equal(kinds(interleave([1, 2, 3, 4], [])), 'PPPP')
  })

  it('keeps both orders', () => {
    const mixed = interleave([1, 2, 3, 4, 5, 6], ['a', 'b'], 3)
    assert.deepEqual(mixed.filter((m) => m.kind === 'main').map((m) => m.value), [1, 2, 3, 4, 5, 6])
    assert.deepEqual(mixed.filter((m) => m.kind === 'news').map((m) => m.value), ['a', 'b'])
  })
})
