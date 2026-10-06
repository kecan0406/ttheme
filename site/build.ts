import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, parse } from 'node:path'
import tailwind from '@tailwindcss/postcss'
import postcss from 'postcss'
import subsetFont from 'subset-font'
import { ASSETS } from './app/shipped'

export const SITE = import.meta.dirname

const FACES = ['@fontsource-variable/inter/index.css', '@fontsource/nunito/800.css', '@fontsource/nunito/900.css']

const CJK = ['@fontsource/biz-udgothic/400.css', '@fontsource/biz-udgothic/700.css']

const MONO = [
  ['JetBrainsMono-Regular', 400],
  ['JetBrainsMono-Bold', 700],
] as const

const BLOCKS = [
  [
    'core',
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+2600-27BF,U+FEFF,U+FFFD',
  ],
  ['arrows', 'U+2190-21FF'],
  ['math', 'U+2200-22FF'],
  ['technical', 'U+2300-23FF'],
  ['shapes', 'U+2500-25FF'],
] as const

const MONO_SUBSETS = [...BLOCKS, ['rest', outside(BLOCKS.map(([, ranges]) => ranges).join(','))]] as const

const PRELOAD = ['inter-latin-wght-normal', 'nunito-latin-900-normal', 'JetBrainsMono-Regular-core']

const subsets = new Map<string, Promise<Uint8Array>>()

class Shelf {
  readonly #production: boolean
  readonly #names = new Map<string, string>()

  constructor(production: boolean) {
    this.#production = production
  }

  put(file: string, data: Uint8Array | string): string {
    const { name, ext } = parse(file)
    const shipped = this.#production ? `${name}-${Bun.hash(data).toString(36)}${ext}` : file
    writeFileSync(join(ASSETS, shipped), data)
    this.#names.set(name, shipped)
    return shipped
  }

  url(name: string): string {
    const shipped = this.#names.get(name)
    if (!shipped) throw new Error(`${name} was never shipped`)
    return `/assets/${shipped}`
  }
}

function spans(ranges: string): [from: number, to: number][] {
  return ranges.split(',').map((range) => {
    const [from = '', to = from] = range.slice(2).split('-')
    return [Number.parseInt(from, 16), Number.parseInt(to, 16)]
  })
}

function outside(ranges: string): string {
  const hex = (point: number) => point.toString(16).toUpperCase().padStart(4, '0')
  const span = (from: number, to: number) => (from === to ? `U+${hex(from)}` : `U+${hex(from)}-${hex(to)}`)
  const gaps: string[] = []
  let next = 0
  for (const [from, to] of spans(ranges).sort(([a], [b]) => a - b)) {
    if (from > next) gaps.push(span(next, from - 1))
    next = Math.max(next, to + 1)
  }
  if (next <= 0x10ffff) gaps.push(span(next, 0x10ffff))
  return gaps.join(',')
}

function characters(ranges: string): string {
  let text = ''
  for (const [from, to] of spans(ranges))
    for (let point = from; point <= to; point++) text += String.fromCodePoint(point)
  return text
}

function subset(file: string, font: Uint8Array, ranges: string): Promise<Uint8Array> {
  const key = `${file} ${ranges}`
  const held = subsets.get(key)
  if (held) return held
  const part: Promise<Uint8Array> = subsetFont(Buffer.from(font), characters(ranges), { targetFormat: 'woff2' })
  subsets.set(key, part)
  return part
}

async function mono(shelf: Shelf): Promise<string> {
  const faces: string[] = []
  for (const [file, weight] of MONO) {
    const font = readFileSync(join(SITE, 'app', 'fonts', `${file}.woff2`))
    for (const [name, ranges] of MONO_SUBSETS) {
      const src = shelf.put(`${file}-${name}.woff2`, await subset(file, font, ranges))
      faces.push(
        `@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:${weight};font-display:swap;src:url(${src}) format('woff2');unicode-range:${ranges}}`,
      )
    }
  }
  return faces.join('\n')
}

function fontsource(shelf: Shelf, specs: string[]): string {
  return specs
    .map((spec) => {
      const css = Bun.resolveSync(spec, SITE)
      return readFileSync(css, 'utf8')
        .replace(/,\s*url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, '')
        .replace(
          /url\(\.\/files\/([^)]+\.woff2)\)/g,
          (_, file: string) => `url(${shelf.put(file, readFileSync(join(dirname(css), 'files', file)))})`,
        )
    })
    .join('\n')
}

async function styles(production: boolean, faces: string): Promise<string> {
  const from = join(SITE, 'app', 'globals.css')
  const result = await postcss([tailwind({ base: SITE, optimize: production })]).process(
    `${readFileSync(from, 'utf8')}\n${faces}`,
    { from },
  )
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
  rmSync(ASSETS, { recursive: true, force: true })
  mkdirSync(ASSETS, { recursive: true })
  const shelf = new Shelf(production)
  shelf.put('site.css', await styles(production, `${await mono(shelf)}\n${fontsource(shelf, FACES)}`))
  shelf.put('cjk.css', fontsource(shelf, CJK))
  const manifest = {
    css: shelf.url('site'),
    cjk: shelf.url('cjk'),
    js: await client(production),
    fonts: PRELOAD.map((name) => shelf.url(name)),
    reload: production ? '' : '/__reload',
  }
  const path = join(SITE, 'assets.json')
  const text = `${JSON.stringify(manifest, null, 2)}\n`
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text)
}

async function server(): Promise<void> {
  rmSync(join(SITE, 'dist'), { recursive: true, force: true })
  const result = await Bun.build({
    entrypoints: [join(SITE, 'server.ts')],
    outdir: join(SITE, 'dist'),
    target: 'bun',
    external: ['elysia'],
  })
  if (!result.success) throw new AggregateError(result.logs, 'the server bundle did not build')
}

if (import.meta.main) {
  await buildAssets(true)
  await server()
}
