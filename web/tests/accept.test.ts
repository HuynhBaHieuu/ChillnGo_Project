import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { prefersMarkdown } from '../middleware.ts'

describe('prefersMarkdown', () => {
  it('is true when the client asks for Markdown', () => {
    assert.equal(prefersMarkdown('text/markdown'), true)
    assert.equal(prefersMarkdown('text/markdown, */*;q=0.1'), true)
    assert.equal(prefersMarkdown('text/markdown;q=0.9, text/html;q=0.5'), true)
    assert.equal(prefersMarkdown('TEXT/MARKDOWN'), true)
  })

  it('lets Markdown win a tie, since only agents name it', () => {
    assert.equal(prefersMarkdown('text/markdown, text/html'), true)
    assert.equal(prefersMarkdown('text/markdown, */*'), true)
  })

  it('is false for browsers and HTML-first clients', () => {
    assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false)
    assert.equal(prefersMarkdown('text/html'), false)
    assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false)
    assert.equal(prefersMarkdown('*/*'), false)
    assert.equal(prefersMarkdown('text/*'), false)
  })

  it('is false without a usable header', () => {
    assert.equal(prefersMarkdown(null), false)
    assert.equal(prefersMarkdown(''), false)
    assert.equal(prefersMarkdown('text/markdown;q=0'), false)
  })
})
