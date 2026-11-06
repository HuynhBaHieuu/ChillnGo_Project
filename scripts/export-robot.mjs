// Builds the web's assistant robot (web/src/features/assistant/RobotEmbed.tsx)
// into one HTML file, model included, for the phone app's WebView:
// mobile/assets/robot/robot.html. Run again when the robot changes:
//   node scripts/export-robot.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const web = join(root, 'web')
const require = createRequire(join(web, 'package.json'))
const load = (name) => import(pathToFileURL(require.resolve(name)).href)
const { build } = await load('vite')
const { default: react } = await load('@vitejs/plugin-react')

// The robot follows a chat held by the app: the site's chat service, session
// and translations stay out of the bundle.
const STUBS = {
  '@/services': 'export const assistantService = {}',
  '@/store/auth.store': 'export const useAuthStore = { subscribe() {} }',
  '@/i18n': 'export const t = (key) => key',
}
const stubs = {
  name: 'robot-stubs',
  enforce: 'pre',
  resolveId: (id) => (id in STUBS ? `\0stub:${id}` : null),
  load: (id) => (id.startsWith('\0stub:') ? STUBS[id.slice(6)] : null),
}

const [output] = await build({
  root: web,
  configFile: false,
  logLevel: 'warn',
  plugins: [stubs, react()],
  resolve: { alias: { '@': join(web, 'src') } },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    write: false,
    lib: { entry: join(web, 'src/features/assistant/RobotEmbed.tsx'), formats: ['iife'], name: 'ChillnGoRobot', fileName: () => 'robot.js' },
  },
})
const code = output.output.find((chunk) => chunk.type === 'chunk').code.replaceAll('</script', '<\\/script')
const model = readFileSync(join(web, 'public/models/assistant-robot.glb')).toString('base64')

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;height:100%;overflow:hidden;background:transparent;touch-action:none;-webkit-tap-highlight-color:transparent}</style>
</head>
<body>
<div id="root"></div>
<script>window.ROBOT_MODEL = "data:model/gltf-binary;base64,${model}";</script>
<script>${code}</script>
</body>
</html>
`
const out = join(root, 'mobile/assets/robot/robot.html')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, html)
console.log(`robot → mobile/assets/robot/robot.html (${Math.round(html.length / 1024)} KB)`)
