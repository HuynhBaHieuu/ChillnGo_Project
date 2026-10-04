/**
 * mobile/ in the root commands. It is a Flutter app, not an npm one, so
 * scripts/run-all.mjs runs this file for it instead of an npm script:
 *
 *   node scripts/mobile.mjs dev        flutter run on an Android phone or emulator
 *   node scripts/mobile.mjs install    flutter pub get
 *   node scripts/mobile.mjs typecheck  flutter analyze
 *
 * "dev" uses a phone connected over USB, or an emulator that is already open.
 * Otherwise it opens the first emulator of Android Studio's Device Manager
 * (CHILLNGO_AVD picks another) and waits for it to start. The emulator stays
 * open after Ctrl+C, so the next start is quick. With several devices
 * connected, CHILLNGO_DEVICE picks one by its serial from `adb devices`.
 */

import { execFile, spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOBILE = path.join(ROOT, 'mobile')
const WINDOWS = process.platform === 'win32'

/** The API's port. A USB phone gets it forwarded, so the app's http://localhost:4000 reaches this computer. */
const API_PORT = 4000

/** How long a starting emulator gets before giving up. */
const BOOT_TIMEOUT_MS = 5 * 60_000

/** Below this much free memory, the emulator and the Gradle build struggle (16 GB computers). */
const LOW_MEMORY_BYTES = 3 * 1024 ** 3

/**
 * An emulator takes 2.5 to 5 GB (the Android 17 Play Store image the most).
 * With less free than this, opening one froze it, and once ran the whole
 * computer out of memory, so it is not opened.
 */
const EMULATOR_MIN_BYTES = 4 * 1024 ** 3

/** Free memory below this, for a few seconds, means the computer is about to freeze. */
const CRITICAL_MEMORY_BYTES = 0.7 * 1024 ** 3

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1)

const execFileAsync = promisify(execFile)

/**
 * Runs a tool and returns its output. Every call has a time limit: a frozen
 * emulator lists as "device" yet never answers `adb shell`, and waiting on it
 * would hang npm run dev without a word.
 */
async function exec(file, args, timeout = 15_000) {
  const { stdout } = await execFileAsync(file, args, { windowsHide: true, timeout })
  return stdout
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------ finding tools */

/** The paths Flutter and Android Studio wrote to mobile/android/local.properties. */
function localProperties() {
  const file = path.join(MOBILE, 'android', 'local.properties')
  if (!existsSync(file)) return {}
  const props = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([\w.]+)\s*=\s*(.*)$/.exec(line)
    // Java properties escape backslashes and colons: sdk.dir=D\:\\Android\\Sdk
    if (match) props[match[1]] = match[2].trim().replace(/\\(.)/g, '$1')
  }
  return props
}

/** A program on PATH, as the terminal would find it. */
function onPath(name) {
  const extensions = WINDOWS ? (process.env.PATHEXT ?? '.EXE;.BAT;.CMD').split(';') : ['']
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue
    for (const extension of extensions) {
      const candidate = path.join(dir, name + extension.toLowerCase())
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/** The flutter command: from PATH, FLUTTER_ROOT, or the SDK that last built the app. Null when none. */
export function findFlutter() {
  const fromPath = onPath('flutter')
  if (fromPath) return fromPath
  const exe = WINDOWS ? 'flutter.bat' : 'flutter'
  for (const root of [process.env.FLUTTER_ROOT, localProperties()['flutter.sdk']]) {
    if (root && existsSync(path.join(root, 'bin', exe))) return path.join(root, 'bin', exe)
  }
  return null
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    localProperties()['sdk.dir'],
    WINDOWS && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Android', 'sdk') : path.join(os.homedir(), 'Android', 'Sdk'),
  ]
  return candidates.find((dir) => dir && existsSync(path.join(dir, 'platform-tools'))) ?? null
}

function sdkTool(sdk, folder, name) {
  const file = sdk ? path.join(sdk, folder, WINDOWS ? `${name}.exe` : name) : null
  return file && existsSync(file) ? file : onPath(name)
}

/* --------------------------------------------------------- Android devices */

/** What `adb devices` lists: { serial, state }, where state is "device" once it is ready. */
async function androidDevices(adb) {
  const lines = (await exec(adb, ['devices'])).split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith('List of devices'))
  return lines
    .slice(start + 1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state)
    .map(([serial, state]) => ({ serial, state }))
}

async function listAvds(emulator) {
  const output = await exec(emulator, ['-list-avds']).catch(() => '')
  // Keep the names only: some versions add "INFO | ..." lines.
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[\w.-]+$/.test(line))
}

/** How long a listed device may stay silent before it counts as frozen. */
const SILENT_LIMIT_MS = 90_000

/** "ready" once it has started, "starting" while it boots, "silent" when it does not answer. */
async function probe(adb, serial) {
  try {
    const answer = await exec(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], 10_000)
    return answer.trim() === '1' ? 'ready' : 'starting'
  } catch {
    return 'silent'
  }
}

/** Devices that answer and have finished starting, phones first: plugging one in is the clearer intent. */
async function readyDevices(adb) {
  const ready = []
  for (const device of await androidDevices(adb)) {
    if (device.state === 'device' && (await probe(adb, device.serial)) === 'ready') ready.push(device.serial)
  }
  return ready.sort((a, b) => Number(a.startsWith('emulator-')) - Number(b.startsWith('emulator-')))
}

/**
 * Waits for a device to be ready: { serial }. A device that stays silent for
 * SILENT_LIMIT_MS is frozen: { frozen: serial }. Nothing in BOOT_TIMEOUT_MS: {}.
 */
async function waitForBoot(adb) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS
  const silentSince = new Map()
  while (Date.now() < deadline) {
    for (const device of await androidDevices(adb)) {
      if (device.state !== 'device') continue
      const state = await probe(adb, device.serial)
      if (state === 'ready') return { serial: device.serial }
      if (state === 'starting') {
        silentSince.delete(device.serial)
        continue
      }
      if (!silentSince.has(device.serial)) silentSince.set(device.serial, Date.now())
      if (Date.now() - silentSince.get(device.serial) > SILENT_LIMIT_MS) return { frozen: device.serial }
    }
    await sleep(3000)
  }
  return {}
}

/**
 * Opens an emulator that outlives npm run dev. Ctrl+C there ends the whole
 * process tree, so the emulator is started by a short-lived helper process:
 * once the helper exits, the emulator is nobody's child and stays open for
 * the next run. (windowsHide is not used on it: Windows would also hide the
 * emulator's own window.)
 */
function openEmulator(emulator, avd) {
  const launch = "require('node:child_process').spawn(process.argv[1], ['-avd', process.argv[2]], { detached: true, stdio: 'ignore' }).unref()"
  spawn(process.execPath, ['-e', launch, emulator, avd], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

/** The device to run on: a ready one, or an emulator opened (and waited for) here. */
async function pickDevice(adb, emulator) {
  // Started on its own first: the adb server keeps running, and must not hold
  // on to the output of the `adb devices` calls below (it would never finish).
  spawnSync(adb, ['start-server'], { stdio: 'ignore', windowsHide: true })

  const ready = await readyDevices(adb)
  const wanted = process.env.CHILLNGO_DEVICE
  if (wanted && ready.includes(wanted)) return wanted
  if (wanted) console.log(`CHILLNGO_DEVICE=${wanted} is not ready, so another device is used.`)
  if (ready.length > 0) return ready[0]

  const devices = await androidDevices(adb)
  if (devices.some((device) => device.state === 'unauthorized')) {
    console.log('A phone is connected but has not allowed USB debugging yet: accept the prompt on its screen.')
  }

  // Listed but not ready: still starting, or frozen (waitForBoot tells which).
  const listed = devices.find((device) => device.serial.startsWith('emulator-'))
  if (listed) {
    console.log(`Waiting for ${listed.serial} to finish starting...`)
  } else {
    const avds = emulator ? await listAvds(emulator) : []
    if (avds.length === 0) {
      console.log('No Android phone or emulator found. Plug in a phone with USB debugging on: waiting 5 minutes for it...')
    } else if (os.freemem() < EMULATOR_MIN_BYTES) {
      console.log(
        `Only ${gb(os.freemem())} GB of memory is free, too little to open an emulator safely. ` +
          'Plug in a phone with USB debugging on (or close apps and run npm run dev again): waiting 5 minutes for a phone...',
      )
    } else {
      const avd = avds.includes(process.env.CHILLNGO_AVD) ? process.env.CHILLNGO_AVD : avds[0]
      console.log(`Opening the ${avd} emulator. The first start can take a minute or two...`)
      openEmulator(emulator, avd)
    }
  }

  const { serial, frozen } = await waitForBoot(adb)
  if (frozen) {
    console.log(
      `${frozen} is not responding. Close it, or use Cold Boot Now in Android Studio's Device Manager, ` +
        'then run npm run dev again.',
    )
  } else if (!serial) {
    console.log('No phone or emulator became ready. Connect one, then run npm run dev again.')
  }
  return serial ?? null
}

/* ----------------------------------------------------------------- commands */

function quote(value) {
  return /[\s"&()]/.test(value) ? `"${value}"` : value
}

/** Ends flutter and everything it started (the Gradle build included). */
function stopTree(child) {
  if (WINDOWS) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  else child.kill('SIGTERM')
}

/**
 * Runs flutter in mobile/ and resolves to its exit code. With `guardMemory`,
 * flutter is stopped when free memory stays below CRITICAL_MEMORY_BYTES: an
 * emulator and an Android build on a full 16 GB computer once froze the whole
 * machine, and a stopped build is the better outcome.
 */
function runFlutter(flutter, args, { guardMemory = false } = {}) {
  return new Promise((resolve) => {
    // flutter is a .bat file on Windows, which Node only starts through a shell.
    const child = spawn([quote(flutter), ...args].join(' '), { cwd: MOBILE, stdio: 'inherit', shell: true })
    let lowChecks = 0
    const watchdog = guardMemory
      ? setInterval(() => {
          lowChecks = os.freemem() < CRITICAL_MEMORY_BYTES ? lowChecks + 1 : 0
          if (lowChecks < 3) return
          clearInterval(watchdog)
          console.log(
            `Stopped the mobile app: only ${gb(os.freemem())} GB of memory was left and the computer was about to ` +
              'freeze. Close the apps you are not using (or connect a phone instead of the emulator), then run npm run dev again.',
          )
          stopTree(child)
        }, 2000)
      : null
    child.on('error', (error) => {
      console.error(error.message)
      resolve(1)
    })
    child.on('exit', (code) => {
      if (watchdog) clearInterval(watchdog)
      resolve(code ?? 1)
    })
  })
}

function runArgs(serial) {
  const args = ['run']
  if (serial) args.push('-d', serial)
  if (existsSync(path.join(MOBILE, '.env'))) {
    args.push('--dart-define-from-file=.env')
  } else {
    console.log('No mobile/.env yet: maps use OpenStreetMap and Google sign-in is hidden. Copy mobile/.env.example to set them.')
  }
  return args
}

async function dev(flutter) {
  if (os.freemem() < LOW_MEMORY_BYTES) {
    console.log(
      `Only ${gb(os.freemem())} GB of memory is free. The emulator and the Android build need ` +
        'several GB: if this is slow or fails, close the apps you are not using.',
    )
  }
  const sdk = findAndroidSdk()
  const adb = sdkTool(sdk, 'platform-tools', 'adb')
  if (!adb) {
    console.log('Android SDK not found, so Flutter picks the device itself.')
    return runFlutter(flutter, runArgs(null))
  }

  const serial = await pickDevice(adb, sdkTool(sdk, 'emulator', 'emulator'))
  if (!serial) return 1

  let keepForwarding = null
  if (!serial.startsWith('emulator-')) {
    const forward = () => exec(adb, ['-s', serial, 'reverse', `tcp:${API_PORT}`, `tcp:${API_PORT}`]).catch(() => '')
    await forward()
    // A phone that reconnects (a loose cable, a USB mode change) loses the
    // forwarding, and the app then cannot reach the API: keep setting it again.
    keepForwarding = setInterval(forward, 5000)
    console.log(`Phone ${serial}: localhost:${API_PORT} on the phone now reaches the API on this computer.`)
  }
  console.log(`Running on ${serial}. Hot reload: type r then Enter here. Restart: R then Enter.`)
  const code = await runFlutter(flutter, runArgs(serial), { guardMemory: true })
  if (keepForwarding) clearInterval(keepForwarding)
  return code
}

async function main(script) {
  const flutter = findFlutter()
  if (!flutter) {
    console.log('Flutter is not installed or not on PATH, so the mobile app is skipped. See mobile/README.md.')
    return 0
  }
  switch (script) {
    case 'dev':
      return dev(flutter)
    case 'install':
      return runFlutter(flutter, ['pub', 'get'])
    case 'typecheck':
      return runFlutter(flutter, ['analyze'])
    default:
      console.error('Usage: node scripts/mobile.mjs <dev | install | typecheck>')
      return 1
  }
}

// Run as a command (run-all.mjs only imports findFlutter).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv[2])
}
