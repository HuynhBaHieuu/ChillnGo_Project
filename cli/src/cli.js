/**
 * The `chillngo` command. Everything it touches (output, environment, network,
 * config directory, password prompt) comes in through `io`, so tests can run
 * it without a terminal or a server.
 */

import { parseArgs } from 'node:util'

import { ApiError, DEFAULT_BASE_URL, createClient } from './client.js'
import { clearConfig, configDir, loadConfig, saveConfig } from './config.js'
import { formatCheckins, formatLivestreams, formatPost, formatPosts, formatUser } from './format.js'

export const VERSION = '0.1.0'

export const HELP = `chillngo ${VERSION} — the official CLI for the ChillnGo API

Usage: chillngo <command> [options]

Commands
  posts [--author <userId>]        Published journeys, newest first
  post <id>                        One journey, day by day and stop by stop
  checkins [--authors <id,id>]     Recent check-ins
  live                             Streams live now
  user <id>                        A public profile
  login --email <email>            Sign in; the password comes from CHILLNGO_PASSWORD,
                                   a hidden prompt, or standard input
  me                               The signed-in account
  logout                           Forget the saved token
  api <METHOD> <path> [--data <json>]
                                   Call any endpoint, e.g. chillngo api GET /api/posts
  openapi                          Print the OpenAPI description

Options
  --json                 Print the raw JSON response
  --base-url <url>       API server (default ${DEFAULT_BASE_URL}, or CHILLNGO_API_URL)
  -h, --help             Show this help
  -v, --version          Show the version

Environment
  CHILLNGO_TOKEN         Use this token instead of the saved one
  CHILLNGO_API_URL       Default for --base-url
  CHILLNGO_PASSWORD      Password for login

Docs: https://chillgo-project-web.vercel.app/developers/cli`

/**
 * @typedef {object} Io
 * @property {(text: string) => void} stdout
 * @property {(text: string) => void} stderr
 * @property {NodeJS.ProcessEnv} env
 * @property {typeof fetch} [fetch]
 * @property {(question: string) => Promise<string>} [promptPassword]
 */

/** Usage problems: exit code 2, no API call made. */
class UsageError extends Error {}

const OPTIONS = /** @type {const} */ ({
  json: { type: 'boolean', default: false },
  'base-url': { type: 'string' },
  author: { type: 'string' },
  authors: { type: 'string' },
  email: { type: 'string' },
  data: { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
})

/**
 * @param {string[]} argv  Arguments after `chillngo`.
 * @param {Io} io
 * @returns {Promise<number>} The exit code.
 */
export async function run(argv, io) {
  let parsed
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true })
  } catch (error) {
    io.stderr(`${/** @type {Error} */ (error).message}\nRun "chillngo --help" for usage.`)
    return 2
  }
  const { values, positionals } = parsed
  const [command, ...rest] = positionals

  if (values.version) {
    io.stdout(VERSION)
    return 0
  }
  if (values.help || !command || command === 'help') {
    io.stdout(HELP)
    return 0
  }

  const dir = configDir(io.env)
  const saved = await loadConfig(dir)
  const baseUrl = values['base-url'] || io.env.CHILLNGO_API_URL || saved.baseUrl || DEFAULT_BASE_URL
  const token = io.env.CHILLNGO_TOKEN || saved.token || null
  const client = createClient({ baseUrl, token, fetch: io.fetch, userAgent: `chillngo-cli/${VERSION}` })

  /** Prints `data` as JSON with --json, otherwise as `format(data)`. */
  const print = (/** @type {unknown} */ data, /** @type {() => string} */ format) => {
    io.stdout(values.json ? JSON.stringify(data, null, 2) : format())
  }
  const need = (/** @type {string | undefined} */ value, /** @type {string} */ usage) => {
    if (!value) throw new UsageError(`Usage: chillngo ${usage}`)
    return value
  }

  try {
    switch (command) {
      case 'posts': {
        const data = await client.request('GET', '/api/posts', { query: { author: values.author } })
        print(data, () => formatPosts(data.items ?? []))
        return 0
      }
      case 'post': {
        const id = need(rest[0], 'post <id>')
        const data = await client.request('GET', `/api/posts/${encodeURIComponent(id)}`)
        print(data, () => formatPost(data.post ?? data))
        return 0
      }
      case 'checkins': {
        const data = await client.request('GET', '/api/checkins', { query: { authors: values.authors } })
        print(data, () => formatCheckins(data.items ?? []))
        return 0
      }
      case 'live': {
        const data = await client.request('GET', '/api/livestreams')
        print(data, () => formatLivestreams(data.items ?? []))
        return 0
      }
      case 'user': {
        const id = need(rest[0], 'user <id>')
        const data = await client.request('GET', `/api/users/${encodeURIComponent(id)}`)
        print(data, () => formatUser(data.user ?? data))
        return 0
      }
      case 'me': {
        if (!token) throw new UsageError('Not signed in. Run "chillngo login --email <email>" or set CHILLNGO_TOKEN.')
        const data = await client.request('GET', '/api/auth/me')
        print(data, () => formatUser(data.user ?? data))
        return 0
      }
      case 'login': {
        const email = need(values.email, 'login --email <email>')
        const password = io.env.CHILLNGO_PASSWORD || (io.promptPassword ? await io.promptPassword('Password: ') : '')
        if (!password) throw new UsageError('No password: set CHILLNGO_PASSWORD or run login in a terminal.')
        const data = await client.request('POST', '/api/auth/login', { body: { email, password } })
        await saveConfig(dir, { ...saved, token: data.token, baseUrl: values['base-url'] || saved.baseUrl })
        print(data.user, () => `Signed in as @${data.user?.username ?? email}. Token saved in ${dir}.`)
        return 0
      }
      case 'logout': {
        await clearConfig(dir)
        io.stdout('Signed out.')
        return 0
      }
      case 'api': {
        const method = need(rest[0], 'api <METHOD> <path> [--data <json>]').toUpperCase()
        const path = need(rest[1], 'api <METHOD> <path> [--data <json>]')
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          throw new UsageError(`Unknown method ${method}. Use GET, POST, PUT, PATCH or DELETE.`)
        }
        let body
        if (values.data !== undefined) {
          try {
            body = JSON.parse(values.data)
          } catch {
            throw new UsageError('--data must be valid JSON.')
          }
        }
        const data = await client.request(method, path, { body })
        io.stdout(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
        return 0
      }
      case 'openapi': {
        const data = await client.request('GET', '/api/openapi.json')
        io.stdout(JSON.stringify(data, null, 2))
        return 0
      }
      default:
        throw new UsageError(`Unknown command "${command}". Run "chillngo --help" for the list.`)
    }
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(error.message)
      return 2
    }
    if (error instanceof ApiError) {
      if (values.json) {
        io.stderr(JSON.stringify({ status: error.status, code: error.code, message: error.message, hint: error.hint }, null, 2))
      } else {
        const label = ['Error', error.status || null, error.code].filter(Boolean).join(' ')
        const lines = [`${label}: ${error.message}`]
        for (const issue of error.issues ?? []) lines.push(`  ${issue.path}: ${issue.message}`)
        if (error.hint) lines.push(`Hint: ${error.hint}`)
        io.stderr(lines.join('\n'))
      }
      return 1
    }
    throw error
  }
}
