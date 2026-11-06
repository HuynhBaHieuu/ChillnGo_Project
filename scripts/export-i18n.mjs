// Copies the web's translation catalog (web/src/i18n/catalog.ts) to
// mobile/assets/i18n/web.json, so the app speaks the same five languages.
// Run again when the web's messages change: node scripts/export-i18n.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { build } = createRequire(join(root, 'web/package.json'))('rolldown')

const dir = mkdtempSync(join(tmpdir(), 'chillngo-i18n-'))
const file = join(dir, 'catalog.mjs')
try {
  await build({ input: join(root, 'web/src/i18n/catalog.ts'), output: { file, format: 'esm' }, logLevel: 'silent' })
  const { catalog } = await import(pathToFileURL(file).href)
  const out = join(root, 'mobile/assets/i18n/web.json')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(catalog))
  console.log(`${Object.keys(catalog).length} strings → mobile/assets/i18n/web.json`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
