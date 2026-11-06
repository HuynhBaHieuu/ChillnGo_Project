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

  it('only references schemas it defines', () => {
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1])
    for (const ref of refs) assert.ok(ref in spec.components.schemas, `undefined schema ${ref}`)
  })
})
