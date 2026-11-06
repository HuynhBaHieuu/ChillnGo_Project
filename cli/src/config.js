/**
 * Where `chillngo login` keeps the token: $XDG_CONFIG_HOME/chillngo, or
 * ~/.config/chillngo, or %APPDATA%\chillngo on Windows. The file is written
 * readable by its owner only.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** @param {NodeJS.ProcessEnv} env */
export function configDir(env) {
  if (env.CHILLNGO_CONFIG_DIR) return env.CHILLNGO_CONFIG_DIR
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, 'chillngo')
  if (process.platform === 'win32' && env.APPDATA) return join(env.APPDATA, 'chillngo')
  return join(homedir(), '.config', 'chillngo')
}

/**
 * @param {string} dir
 * @returns {Promise<{ token?: string, baseUrl?: string }>}
 */
export async function loadConfig(dir) {
  try {
    return JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'))
  } catch {
    return {}
  }
}

/**
 * @param {string} dir
 * @param {{ token?: string, baseUrl?: string }} config
 */
export async function saveConfig(dir, config) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

/** @param {string} dir */
export async function clearConfig(dir) {
  await rm(join(dir, 'config.json'), { force: true })
}
