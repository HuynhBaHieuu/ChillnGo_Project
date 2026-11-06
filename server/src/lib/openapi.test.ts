import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'

import { buildOpenApi, documentedRoutes } from './openapi.js'

const SRC = new URL('../', import.meta.url)

/**
 * Every route the server declares, read from the source: each router's
 * `xRouter.get('/path'…)` joined to the prefix app.ts mounts it at, plus the
 * routes app.ts declares itself.
 */
function declaredRoutes(): string[] {
  const appSource = readFileSync(new URL('app.ts', SRC), 'utf8')

  const mounts = new Map<string, string[]>()
  for (const [, prefix, router] of appSource.matchAll(/app\.use\('(\/api[^']*)', (\w+Router)\)/g)) {
    mounts.set(router, [...(mounts.get(router) ?? []), prefix])
  }

  const routes: string[] = []
  for (const [, method, path] of appSource.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)) {
    routes.push(`${method.toUpperCase()} ${path}`)
  }
  // app.get(API_DOCS_PATH, …)
  if (/app\.get\(API_DOCS_PATH,/.test(appSource)) routes.push('GET /api/openapi.json')

  const routesDir = new URL('routes/', SRC)
  for (const file of readdirSync(routesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const source = readFileSync(new URL(file, routesDir), 'utf8')
    for (const [, router, method, path] of source.matchAll(/(\w+Router)\.(get|post|put|patch|delete)\('([^']*)'/g)) {
      const prefixes = mounts.get(router)
      assert.ok(prefixes, `${router} (${file}) is not mounted in app.ts`)
      for (const prefix of prefixes) {
        const full = path === '/' ? prefix : `${prefix}${path}`
        routes.push(`${method.toUpperCase()} ${full}`)
      }
    }
  }
  return routes
}

type Schema = {
  $ref?: string
  type?: string | string[]
  required?: string[]
  properties?: Record<string, Schema>
  items?: Schema
  allOf?: Schema[]
  enum?: unknown[]
  const?: unknown
}

/** Problems with `value` against the JSON Schema subset the description uses (type, required, properties, items, enum, $ref, allOf). */
function conformance(value: unknown, schema: Schema, schemas: Record<string, Schema>, at = '$'): string[] {
  if (schema.$ref) return conformance(value, schemas[schema.$ref.split('/').pop()!], schemas, at)
  const problems = (schema.allOf ?? []).flatMap((s) => conformance(value, s, schemas, at))
  if (schema.type) {
    const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value
    const allowed = [schema.type].flat()
    if (!allowed.includes(kind) && !(kind === 'integer' && allowed.includes('number'))) return [...problems, `${at}: ${kind}, expected ${allowed}`]
  }
  if (schema.enum && !schema.enum.includes(value)) problems.push(`${at}: ${String(value)} not in ${schema.enum}`)
  if ('const' in schema && schema.const !== value) problems.push(`${at}: expected ${String(schema.const)}`)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>
    for (const key of schema.required ?? []) if (!(key in object)) problems.push(`${at}.${key}: missing`)
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in object) problems.push(...conformance(object[key], sub, schemas, `${at}.${key}`))
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => problems.push(...conformance(v, schema.items!, schemas, `${at}[${i}]`)))
  return problems
}

describe('OpenAPI description', () => {
  const spec = buildOpenApi(['https://api.example.test'])

  it('documents every route the server declares, and nothing else', () => {
    const declared = new Set(declaredRoutes())
    const documented = new Set(documentedRoutes())
    const missing = [...declared].filter((r) => !documented.has(r))
    const extra = [...documented].filter((r) => !declared.has(r))
    assert.deepEqual(missing, [], 'routes missing from OPERATIONS in lib/openapi.ts')
    assert.deepEqual(extra, [], 'OPERATIONS entries with no matching route')
  })

  it('is OpenAPI 3.1 with info, servers and the bearer scheme', () => {
    assert.equal(spec.openapi, '3.1.0')
    assert.ok(spec.info.title && spec.info.version)
    assert.deepEqual(spec.servers, [{ url: 'https://api.example.test' }])
    assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer')
  })

  it('declares every templated path parameter, and uses OpenAPI path syntax', () => {
    for (const [path, item] of Object.entries(spec.paths)) {
      assert.doesNotMatch(path, /:/, `${path} still uses Express syntax`)
      const expected = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      for (const [method, op] of Object.entries(item)) {
        const params = ((op as { parameters?: { name: string; in: string; required: boolean }[] }).parameters ?? [])
          .filter((p) => p.in === 'path')
        assert.deepEqual(params.map((p) => p.name).sort(), expected, `${method.toUpperCase()} ${path}`)
        assert.ok(params.every((p) => p.required), `${method.toUpperCase()} ${path}: path params must be required`)
      }
    }
  })

  it('gives every operation a unique operationId and an Error default response', () => {
    const ids = new Set<string>()
    for (const item of Object.values(spec.paths)) {
      for (const op of Object.values(item) as { operationId: string; responses: Record<string, unknown> }[]) {
        assert.ok(!ids.has(op.operationId), `duplicate operationId ${op.operationId}`)
        ids.add(op.operationId)
        assert.deepEqual(op.responses.default, {
          description: 'Any error. Every error body has the Error shape.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        })
      }
    }
  })

  type Op = {
    operationId: string
    summary: string
    description: string
    security: Record<string, unknown>[]
    parameters?: { name: string; in: string; description?: string; schema: { type?: unknown } }[]
    requestBody?: { content: Record<string, { schema: Record<string, unknown> }> }
    responses: Record<string, { content?: Record<string, { schema: Record<string, unknown> }> }>
  }
  const operations = () =>
    Object.entries(spec.paths).flatMap(([path, item]) =>
      Object.entries(item).map(([method, op]) => [`${method.toUpperCase()} ${path}`, op as Op] as const),
    )

  it('is self-describing for function calling: descriptions, typed parameters, typed success bodies', () => {
    for (const [name, op] of operations()) {
      assert.match(op.operationId, /^[a-z][A-Za-z0-9]*$/, name)
      assert.ok(op.summary.length > 5 && op.description.startsWith(op.summary), name)
      for (const p of op.parameters ?? []) {
        assert.ok(p.description, `${name}: parameter ${p.name} has no description`)
        assert.ok(p.schema.type, `${name}: parameter ${p.name} has no type`)
      }
      const success = Object.keys(op.responses).filter((code) => /^2\d\d$/.test(code))
      assert.equal(success.length, 1, `${name}: one numeric success status, got ${Object.keys(op.responses)}`)
      for (const media of Object.values(op.responses[success[0]].content ?? {})) {
        assert.ok(media.schema.$ref || media.schema.type, `${name}: success body has no schema`)
      }
      for (const media of Object.values(op.requestBody?.content ?? {})) {
        assert.ok(media.schema.$ref || media.schema.type, `${name}: request body has no schema`)
      }
    }
  })

  it('describes every public read with a named response schema', () => {
    for (const [name, op] of operations()) {
      const anonymous = op.security.length === 0 || op.security.some((s) => Object.keys(s).length === 0)
      if (!name.startsWith('GET ') || !anonymous || name.endsWith('.m3u8')) continue
      const [media] = Object.values(op.responses['200'].content!)
      assert.ok(media.schema.$ref, `${name} returns an untyped object`)
    }
  })

  it('answers 201 exactly where the route does', () => {
    const created = new Set<string>()
    const appSource = readFileSync(new URL('app.ts', SRC), 'utf8')
    const prefixOf = new Map(
      [...appSource.matchAll(/app\.use\('(\/api[^']*)', (\w+Router)\)/g)].map(([, prefix, router]) => [router, prefix]),
    )
    const routesDir = new URL('routes/', SRC)
    for (const file of readdirSync(routesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const source = readFileSync(new URL(file, routesDir), 'utf8')
      const starts = [...source.matchAll(/(\w+Router)\.(get|post|put|patch|delete)\('([^']*)'/g)]
      starts.forEach((m, i) => {
        const handler = source.slice(m.index, starts[i + 1]?.index ?? source.length)
        if (!handler.includes('status(201)')) return
        const prefix = prefixOf.get(m[1])!
        const path = (m[3] === '/' ? prefix : `${prefix}${m[3]}`).replace(/:([A-Za-z]+)/g, '{$1}')
        created.add(`${m[2].toUpperCase()} ${path}`)
      })
    }
    const documented = operations().filter(([, op]) => '201' in op.responses).map(([name]) => name)
    assert.deepEqual(documented.sort(), [...created].sort())
  })

  it('response schemas match the bodies the routes send', () => {
    const schemas = spec.components.schemas as Record<string, Schema>
    const author = { _id: 'u1', username: 'lan', displayName: 'Lan', avatarUrl: '' }
    const user = { ...author, email: '', coverUrl: '', bio: '', location: '', followerCount: 0, followingCount: 0, postCount: 1, role: 'user', createdAt: '2026-01-01T00:00:00.000Z' }
    const stop = { _id: 's1', name: 'Phố cổ', address: '', lat: 15.8, lng: 108.3, placeId: null, note: '', estCost: 480000, photoUrl: null }
    const journey = {
      _id: 'p1', authorId: 'u1', title: 'Hội An', summary: '', coverUrl: '', coverImages: [], region: 'central', season: 'summer',
      startDate: '2026-06-20', endDate: '2026-06-21', days: [{ _id: 'd1', dayNumber: 1, date: '2026-06-20', title: '', photos: [], locations: [stop] }],
      tags: [], budgetLevel: 'high', totalEstCost: 1, routeGeoJson: { type: 'FeatureCollection', features: [] }, likeCount: 0,
      commentCount: 0, bookmarkCount: 0, cloneCount: 0, companions: [], status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, purgeAt: null,
    }
    const stream = {
      _id: 'l1', title: 'Live', description: '', audience: 'public', status: 'ended', startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T01:00:00.000Z', durationSec: 3600, viewerCount: 0, peakViewers: 3, uniqueViewers: 4, commentCount: 0,
      reactions: { heart: 0, fire: 0, clap: 0, wow: 0, haha: 0 }, dvr: false, recording: { status: 'ready', url: null, durationSec: 3600 },
      thumbnailUrl: '', host: author,
    }
    const samples: Record<string, unknown> = {
      Health: { ok: true },
      PublicSettings: { settings: { registrationOpen: true, announcement: '' } },
      JourneyList: { items: [journey], authors: [user] },
      JourneyResponse: { post: journey, authors: [user], likedByMe: false },
      JourneyCommentList: { items: [{ _id: 'c1', postId: 'p1', authorId: 'u1', parentId: null, content: 'Hay', likeCount: 0, hidden: false, createdAt: '2026-01-01T00:00:00.000Z' }], authors: [user] },
      CheckInList: { items: [{ _id: 'k1', caption: '', feeling: null, photos: [{ url: 'x', width: 1, height: 1 }], location: null, createdAt: '2026-01-01T00:00:00.000Z', deletedAt: null, purgeAt: null, author }] },
      LivestreamList: { items: [stream] },
      LivestreamPage: { items: [stream], nextBefore: null },
      LivestreamResponse: { livestream: stream, blocked: false },
      ProfileResponse: { user, followedByMe: false },
      Session: { token: 't', user: { ...user, permissions: [] } },
    }
    for (const [name, sample] of Object.entries(samples)) {
      assert.deepEqual(conformance(sample, { $ref: `#/components/schemas/${name}` }, schemas), [], name)
    }
    // The checker itself catches a wrong body.
    assert.notDeepEqual(conformance({ items: [{ ...journey, title: 3 }] }, { $ref: '#/components/schemas/JourneyList' }, schemas), [])
  })

  it('only references schemas it defines', () => {
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1])
    for (const ref of refs) assert.ok(ref in spec.components.schemas, `undefined schema ${ref}`)
  })
})
