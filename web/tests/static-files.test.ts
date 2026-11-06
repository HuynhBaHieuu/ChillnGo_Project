/**
 * The machine-readable files the web app ships: the no-JavaScript content in
 * index.html, public/llms.txt and the routing in vercel.json.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { isKnownPage } from '../middleware.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const SITE = 'https://chillgo-project-web.vercel.app'
const GITHUB = 'https://github.com/HuynhBaHieuu/ChillnGo_Project'

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
    for (const href of ['/discover', '/feed', '/live', '/llms.txt', '/openapi.json', '/developers', '/developers/cli', GITHUB]) {
      assert.ok(root.includes(`href="${href}"`), href)
    }
  })

  it('describes the site in valid JSON-LD whose keywords all appear in the page text', () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0]['@context'], 'https://schema.org')
    const graph = blocks[0]['@graph'] as Record<string, unknown>[]
    const site = graph.find((n) => n['@type'] === 'WebSite')!
    const org = graph.find((n) => n['@type'] === 'Organization')!
    assert.deepEqual(org.sameAs, [GITHUB])
    const text = textOf(root).toLowerCase()
    const terms = [...String(site.keywords).split(','), ...(org.knowsAbout as string[])].map((t) => t.trim().toLowerCase())
    for (const term of terms) assert.ok(text.includes(term), `keyword "${term}" is not in the page text`)
    const meta = html.match(/<meta name="keywords" content="([^"]+)"/)?.[1]
    assert.equal(meta, site.keywords, 'meta keywords match the JSON-LD keywords')
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
    // The API index at /api itself, without relying on `:path*` matching an empty rest.
    assert.ok(sources.indexOf('/api') >= 0 && sources.indexOf('/api') < fallback)
    assert.equal(config.rewrites[sources.indexOf('/api')].destination, 'https://chillgo-project.vercel.app/api')
    assert.ok(sources.indexOf('/openapi.json') >= 0 && sources.indexOf('/openapi.json') < fallback)
    const api = config.rewrites.find((r) => r.source === '/api/:path*')
    assert.match(api!.destination, /^https:\/\/[^/]+\/api\/:path\*$/)
  })

  it('maps the developer pages to their HTML files before the app fallback', () => {
    const fallback = sources.indexOf('/(.*)')
    for (const [source, destination] of [
      ['/developers', '/developers.html'],
      ['/developers/cli', '/developers-cli.html'],
    ]) {
      const index = sources.indexOf(source)
      assert.ok(index >= 0 && index < fallback, source)
      assert.equal(config.rewrites[index].destination, destination)
    }
  })

  it('serves the API catalog as an RFC 9727 linkset, and links it from the home page', () => {
    const catalog = config.headers.find((h) => h.source === '/.well-known/api-catalog')
    assert.equal(
      catalog?.headers.find((h) => h.key === 'Content-Type')?.value,
      'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    )
    const home = config.headers.find((h) => h.source === '/')
    assert.equal(home?.headers.find((h) => h.key === 'Link')?.value, '</.well-known/api-catalog>; rel="api-catalog"')
  })

  it('sends Vary: Accept on pages, which have a Markdown version', () => {
    const vary = config.headers.flatMap((h) => h.headers).find((h) => h.key === 'Vary')
    assert.equal(vary?.value, 'Accept')
  })
})

describe('developer pages', () => {
  for (const [file, path, title, h1] of [
    ['public/developers.html', '/developers', /^ChillnGo API — Developer Portal$/, 'ChillnGo API'],
    ['public/developers-cli.html', '/developers/cli', /^ChillnGo CLI\b/, 'ChillnGo CLI'],
  ] as const) {
    describe(file, () => {
      const html = read(file)
      const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? ''

      it('names the product and tool in the title and the only h1', () => {
        assert.match(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '', title)
        const h1s = [...body.matchAll(/<h1>([^<]+)<\/h1>/g)].map((m) => m[1])
        assert.deepEqual(h1s, [h1])
      })

      it('is readable without JavaScript and has sequential headings', () => {
        assert.ok(textOf(body).length >= 1000, `only ${textOf(body).length} characters`)
        assert.doesNotMatch(body, /<script\b/)
        const levels = [...body.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
        for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i - 1]} -> h${levels[i]}`)
      })

      it('declares its canonical clean URL, valid JSON-LD and the GitHub link', () => {
        assert.ok(html.includes(`<link rel="canonical" href="${SITE}${path}" />`))
        const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
        assert.ok(ld)
        assert.equal(JSON.parse(ld)['@context'], 'https://schema.org')
        assert.ok(body.includes(`href="${GITHUB}"`))
      })
    })
  }

  it('the portal covers keys, docs, quickstart and sandbox, and links the CLI page', () => {
    const html = read('public/developers.html')
    for (const id of ['quickstart', 'authentication', 'endpoints', 'errors', 'rate-limits', 'sandbox']) {
      assert.ok(html.includes(`id="${id}"`), id)
    }
    assert.ok(html.includes('href="/developers/cli"'))
  })
})

describe('crawler and discovery files', () => {
  it('robots.txt allows the public site and names the sitemap', () => {
    const lines = read('public/robots.txt').split(/\r?\n/)
    assert.equal(lines[0], 'User-agent: *')
    assert.ok(lines.includes('Allow: /'))
    assert.ok(lines.includes(`Sitemap: ${SITE}/sitemap.xml`))
    assert.ok(!lines.some((l) => l.startsWith('Disallow: /developers')))
  })

  it('sitemap.xml is a sitemaps.org urlset of absolute, known pages', () => {
    const xml = read('public/sitemap.xml')
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    assert.ok(locs.length >= 5)
    for (const loc of locs) {
      assert.ok(loc.startsWith(`${SITE}/`), loc)
      assert.ok(isKnownPage(new URL(loc).pathname), `${loc} would be a 404`)
    }
    assert.ok(locs.includes(`${SITE}/developers`))
  })

  it('/.well-known/api-catalog is an RFC 9264 linkset with the API description and docs', () => {
    const catalog = JSON.parse(read('public/.well-known/api-catalog')) as {
      linkset: { anchor: string; [rel: string]: unknown }[]
    }
    assert.equal(catalog.linkset.length, 1)
    const [api] = catalog.linkset
    assert.equal(api.anchor, `${SITE}/api`)
    const desc = api['service-desc'] as { href: string; type: string }[]
    const doc = api['service-doc'] as { href: string; type: string }[]
    assert.deepEqual(desc, [{ href: `${SITE}/openapi.json`, type: 'application/vnd.oai.openapi+json' }])
    assert.equal(doc[0].href, `${SITE}/developers`)
  })
})
