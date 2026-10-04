import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import tailwind from '@tailwindcss/postcss'
import postcss from 'postcss'

export const SITE = import.meta.dirname
export const PUBLIC = join(SITE, 'public')

const ASSETS = join(PUBLIC, 'assets')
const FONTS = join(PUBLIC, 'fonts')

const FACES = [
  '@fontsource-variable/inter/index.css',
  '@fontsource/nunito/800.css',
  '@fontsource/nunito/900.css',
  '@fontsource/biz-udgothic/400.css',
  '@fontsource/biz-udgothic/700.css',
]

const JETBRAINS = [
  ['JetBrainsMono-Regular.woff2', 400],
  ['JetBrainsMono-Bold.woff2', 700],
] as const

const PRELOAD = ['inter-latin-wght-normal.woff2', 'nunito-latin-900-normal.woff2', 'JetBrainsMono-Regular.woff2']

function fonts(): string {
  mkdirSync(FONTS, { recursive: true })
  const local = JETBRAINS.map(([file, weight]) => {
    copyFileSync(join(SITE, 'app', 'fonts', file), join(FONTS, file))
    return `@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:${weight};font-display:swap;src:url(../fonts/${file}) format('woff2')}`
  })
  const shipped = FACES.map((spec) => {
    const css = Bun.resolveSync(spec, SITE)
    return readFileSync(css, 'utf8')
      .replace(/,\s*url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, '')
      .replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, (_, file: string) => {
        copyFileSync(join(dirname(css), 'files', file), join(FONTS, file))
        return `url(../fonts/${file})`
      })
  })
  return [...local, ...shipped].join('\n')
}

async function styles(production: boolean): Promise<string> {
  const from = join(SITE, 'app', 'globals.css')
  const result = await postcss([tailwind({ base: SITE, optimize: production })]).process(readFileSync(from, 'utf8'), {
    from,
  })
  return result.css
}

async function client(production: boolean): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(SITE, 'client', 'main.ts')],
    outdir: ASSETS,
    naming: production ? '[name]-[hash].[ext]' : '[name].[ext]',
    target: 'browser',
    minify: production,
    sourcemap: production ? 'none' : 'inline',
  })
  const entry = result.outputs.find((output) => output.kind === 'entry-point')
  if (!result.success || !entry) throw new AggregateError(result.logs, 'the client bundle did not build')
  return `/assets/${basename(entry.path)}`
}

export async function buildAssets(production: boolean): Promise<void> {
  for (const dir of [ASSETS, FONTS]) rmSync(dir, { recursive: true, force: true })
  mkdirSync(ASSETS, { recursive: true })
  const css = `${fonts()}\n${await styles(production)}`
  const sheet = production ? `site-${Bun.hash(css).toString(36)}.css` : 'site.css'
  writeFileSync(join(ASSETS, sheet), css)
  const manifest = {
    css: `/assets/${sheet}`,
    js: await client(production),
    fonts: PRELOAD.map((file) => `/fonts/${file}`),
    reload: production ? '' : '/__reload',
  }
  const path = join(SITE, 'assets.json')
  const text = `${JSON.stringify(manifest, null, 2)}\n`
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text)
}

async function server(): Promise<void> {
  const files = Object.fromEntries(
    [...new Bun.Glob('{assets,fonts}/*').scanSync({ cwd: PUBLIC })].map((path) => [
      `/${path}`,
      { type: Bun.file(join(PUBLIC, path)).type, data: readFileSync(join(PUBLIC, path)).toString('base64') },
    ]),
  )
  rmSync(join(SITE, 'dist'), { recursive: true, force: true })
  const result = await Bun.build({
    entrypoints: [join(SITE, 'server.ts')],
    outdir: join(SITE, 'dist'),
    target: 'bun',
    external: ['elysia'],
    plugins: [
      {
        name: 'shipped',
        setup(build) {
          build.onResolve({ filter: /^virtual:shipped$/ }, () => ({ path: 'shipped', namespace: 'shipped' }))
          build.onLoad({ filter: /.*/, namespace: 'shipped' }, () => ({
            contents: `export default ${JSON.stringify(files)}`,
            loader: 'js',
          }))
        },
      },
    ],
  })
  if (!result.success) throw new AggregateError(result.logs, 'the server bundle did not build')
}

if (import.meta.main) {
  await buildAssets(true)
  await server()
}
