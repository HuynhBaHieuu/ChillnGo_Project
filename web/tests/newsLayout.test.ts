import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { newsLayout, youtubeId } from '../src/lib/newsLayout.ts'

const kinds = (content: string[], images: string[]) =>
  newsLayout(content, images).blocks.map((block) => (block.kind === 'text' ? block.text : `[${block.url}]`))

describe('news post layout', () => {
  it('puts the first picture on the cover and the next between paragraphs', () => {
    const layout = newsLayout(['a', 'b', 'c'], ['cover', 'x', 'y'])
    assert.equal(layout.cover, 'cover')
    assert.deepEqual(kinds(['a', 'b', 'c'], ['cover', 'x', 'y']), ['a', '[x]', 'b', '[y]', 'c'])
    assert.deepEqual(layout.gallery, [])
  })

  it('spreads a few pictures evenly and never ends on one', () => {
    assert.deepEqual(kinds(['a', 'b', 'c', 'd', 'e', 'f'], ['cover', 'x', 'y']), ['a', 'b', '[x]', 'c', 'd', '[y]', 'e', 'f'])
    assert.deepEqual(kinds(['a', 'b'], ['cover', 'x']), ['a', '[x]', 'b'])
  })

  it('sends pictures that do not fit between paragraphs to the gallery', () => {
    const layout = newsLayout(['a', 'b'], ['cover', 'x', 'y', 'z'])
    assert.deepEqual(layout.blocks.filter((b) => b.kind === 'image').length, 1)
    assert.deepEqual(layout.gallery, ['y', 'z'])
    assert.deepEqual(newsLayout(['only'], ['cover', 'x']).gallery, ['x'])
  })

  it('copes with no pictures and no text', () => {
    assert.deepEqual(newsLayout(['a'], []), { cover: null, blocks: [{ kind: 'text', text: 'a' }], gallery: [] })
    assert.deepEqual(newsLayout([], ['cover', 'x']), { cover: 'cover', blocks: [], gallery: ['x'] })
  })

  it('finds the video in YouTube links only', () => {
    assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ')
    assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
    assert.equal(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
    assert.equal(youtubeId('https://vimeo.com/123'), null)
    assert.equal(youtubeId('https://youtube.com/watch?v=bad'), null)
    assert.equal(youtubeId('not a link'), null)
  })
})
