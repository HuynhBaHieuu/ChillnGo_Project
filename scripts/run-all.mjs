/**
 * Runs an npm script in every app of the monorepo at once.
 *
 *   npm run dev        start every app that has a "dev" script
 *   npm run setup      npm install in every app
 *   npm run build      build every app that has a "build" script
 *   npm run typecheck  typecheck every app that has a "typecheck" script
 *
 * An app joins automatically as soon as its folder has a package.json with the
 * script in it, so mobile/ starts with everything else once it is set up.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import concurrently from 'concurrently'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Every app folder, in start order, with the colour of its log prefix. */
const APPS = [
  { name: 'server', color: 'yellow' },
  { name: 'web', color: 'cyan' },
  { name: 'mobile', color: 'magenta' },
]

const script = process.argv[2]
if (!script) {
  console.error('Usage: node scripts/run-all.mjs <script | install>')
  process.exit(1)
}

function readPackage(dir) {
  const file = path.join(dir, 'package.json')
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

const commands = []
const skipped = []

for (const app of APPS) {
  const dir = path.join(ROOT, app.name)
  const pkg = readPackage(dir)

  if (!pkg) {
    skipped.push(`${app.name} (no package.json yet)`)
    continue
  }

  let command
  if (script === 'install') {
    command = 'npm install'
  } else if (pkg.scripts?.[script]) {
    // A freshly cloned app has no node_modules: install it first rather than
    // failing with "command not found".
    const needsInstall = !existsSync(path.join(dir, 'node_modules'))
    command = needsInstall ? `npm install && npm run ${script}` : `npm run ${script}`
  } else {
    skipped.push(`${app.name} (no "${script}" script)`)
    continue
  }

  commands.push({ name: app.name, command, cwd: dir, prefixColor: app.color })
}

if (skipped.length > 0) console.log(`Skipping: ${skipped.join(', ')}`)

if (commands.length === 0) {
  console.log(`No app has a "${script}" script.`)
  process.exit(0)
}

const { result } = concurrently(commands, {
  prefix: 'name',
  // One app crashing (say, the server without its .env) must not take the
  // others down during development.
  killOthersOn: [],
})

result.then(
  () => {},
  () => {
    process.exitCode = 1
  },
)
