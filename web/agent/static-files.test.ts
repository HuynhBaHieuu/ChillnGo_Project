/**
 * The machine-readable files the web app ships: the no-JavaScript content in
 * index.html, public/llms.txt and the routing in vercel.json.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** Visible text of an HTML fragment: no tags, comments, scripts or styles. */
function textOf(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('index.html without JavaScript', () => {
  const html = read('index.html')
  const root = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script type="module"/)?.[1] ?? ''

  it('has at least 500 characters of text in the raw HTML', () => {
    assert.ok(textOf(root).length >= 500, `only ${textOf(root).length} characters`)
  })

  it('has exactly one h1, and heading levels never skip', () => {
    const levels = [...root.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
    assert.equal(levels.filter((l) => l === 1).length, 1)
    assert.equal(levels[0], 1)
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i - 1]} is followed by h${levels[i]}`)
    }
  })

  it('links to inner pages and the agent files', () => {
    for (const href of ['/discover', '/feed', '/live', '/llms.txt', '/openapi.json']) {
      assert.ok(root.includes(`href="${href}"`), href)
    }
  })

  it('stays hidden while JavaScript runs, and React mounts into the same #root', () => {
    assert.match(html, /setAttribute\('data-js', ''\)/)
    assert.match(html, /\[data-js\] #prerender \{ display: none; \}/)
    assert.equal(html.match(/id="root"/g)?.length, 1)
  })
})

describe('public/llms.txt', () => {
  // Git may check the file out with CRLF line endings on Windows.
  const lines = read('public/llms.txt').split(/\r?\n/)

  it('follows the llms.txt layout: H1, blockquote summary, H2 sections of links', () => {
    assert.match(lines[0], /^# \S/)
    assert.equal(lines.filter((l) => l.startsWith('# ')).length, 1)
    assert.match(lines.find((l) => l.trim() !== '' && !l.startsWith('# ')) ?? '', /^> \S/)
    const sections = lines.filter((l) => l.startsWith('## '))
    assert.ok(sections.length >= 2)
    for (const line of lines.filter((l) => l.startsWith('- '))) {
      assert.match(line, /^- \[[^\]]+\]\(https:\/\/[^)]+\)(: .+)?$/, line)
    }
  })

  it('points to the OpenAPI description', () => {
    assert.ok(lines.some((l) => l.includes('/openapi.json')))
  })
})

describe('vercel.json', () => {
  const config = JSON.parse(read('vercel.json')) as {
    rewrites: { source: string; destination: string }[]
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
  const sources = config.rewrites.map((r) => r.source)

  it('proxies the API and its OpenAPI description before the app fallback', () => {
    const fallback = sources.indexOf('/(.*)')
    assert.ok(fallback >= 0)
    assert.ok(sources.indexOf('/api/:path*') >= 0 && sources.indexOf('/api/:path*') < fallback)
    assert.ok(sources.indexOf('/openapi.json') >= 0 && sources.indexOf('/openapi.json') < fallback)
    const api = config.rewrites.find((r) => r.source === '/api/:path*')
    assert.match(api!.destination, /^https:\/\/[^/]+\/api\/:path\*$/)
  })

  it('sends Vary: Accept on pages, which have a Markdown version', () => {
    const vary = config.headers.flatMap((h) => h.headers).find((h) => h.key === 'Vary')
    assert.equal(vary?.value, 'Accept')
  })
})
