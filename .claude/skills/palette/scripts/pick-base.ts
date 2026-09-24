import { mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { argbFromHex, Hct } from '@material/material-color-utilities'
import { deltaE } from './delta.ts'
import { harmonizePalette, violations } from './harmonize.ts'

type ThemeDoc = Parameters<typeof harmonizePalette>[0]
type Palette = ReturnType<typeof harmonizePalette>
type Colors = ThemeDoc['colors']

interface Source {
  meta: ThemeDoc['meta'] & { group?: string; ansi_source?: string }
  colors: Colors
}

interface Scheme {
  background: string
  foreground: string
  cursor: string
  selection: string
  ansi: string[]
}

interface Ranked {
  name: string
  score: number
  worst: number
  worstSlot: number
  mean: number
  collision: number
  pair: [number, number]
}

const REPO = 'mbadolato/iTerm2-Color-Schemes'
const LIST_URL = `https://api.github.com/repos/${REPO}/contents/ghostty`
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/master/ghostty/`
const INDEX = '.index'
const INDEX_TTL = 24 * 60 * 60 * 1000
const CONCURRENCY = 16
const FUNCTION_HUE: Record<number, number> = { 1: 22, 2: 143, 3: 90, 4: 253, 5: 332, 6: 200 }
const GROUPS = [
  [1, 2, 3, 4, 5, 6],
  [9, 10, 11, 12, 13, 14],
]
const COLLISION_WEIGHT = 4
const SLOTS = ['cursor', 'foreground', 'background', 'selection', ...Array.from({ length: 16 }, (_, i) => `ansi${i}`)]
const USAGE = 'usage: bun pick-base.ts themes/<name>.toml [--top N] [--schemes <dir>] [--include <name> ...]'

const hct = (hex: string) => Hct.fromInt(argbFromHex(hex))
const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}
const fixed = (n: number, digits = 0) => n.toFixed(digits)

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function read(colors: Colors, slot: string): string {
  if (slot === 'background') return colors.background
  if (slot === 'foreground') return colors.foreground
  if (slot === 'cursor') return colors.cursor
  if (slot === 'selection') return colors.selection_background
  return colors.ansi[Number(slot.slice(4))] as string
}

function assign(colors: Colors, slot: string, value: string) {
  if (slot === 'background') colors.background = value
  else if (slot === 'foreground') colors.foreground = value
  else if (slot === 'cursor') colors.cursor = value
  else if (slot === 'selection') colors.selection_background = value
  else colors.ansi[Number(slot.slice(4))] = value
}

function parseScheme(text: string): Scheme | undefined {
  const values: Record<string, string> = {}
  const ansi: string[] = []
  for (const line of text.split('\n')) {
    const entry = line.match(/^palette\s*=\s*(\d+)\s*=\s*#?([0-9a-f]{6})\s*$/i)
    if (entry) ansi[Number(entry[1])] = `#${(entry[2] as string).toLowerCase()}`
    const pair = line.match(/^([a-z-]+)\s*=\s*#?([0-9a-f]{6})\s*$/i)
    if (pair) values[pair[1] as string] = `#${(pair[2] as string).toLowerCase()}`
  }
  const { background, foreground } = values
  const ramp = Array.from({ length: 16 }, (_, i) => ansi[i])
  if (!background || !foreground || ramp.some((c) => c === undefined)) return undefined
  return {
    background,
    foreground,
    cursor: values['cursor-color'] ?? foreground,
    selection: values['selection-background'] ?? background,
    ansi: ramp as string[],
  }
}

async function listing(dir: string): Promise<string[]> {
  const index = Bun.file(join(dir, INDEX))
  const cached = (await index.exists()) ? (await index.text()).split('\n').filter(Boolean) : []
  if (cached.length > 0 && Date.now() - index.lastModified < INDEX_TTL) return cached
  const res = await fetch(LIST_URL, { headers: { accept: 'application/vnd.github+json' } }).catch(() => undefined)
  if (!res?.ok) {
    console.error(`scheme listing unavailable (${res?.status ?? 'network error'}), using what ${dir} holds`)
    return cached
  }
  const entries = (await res.json()) as { name: string; type: string }[]
  const names = entries.filter((e) => e.type === 'file').map((e) => e.name)
  await Bun.write(index, names.join('\n'))
  return names
}

async function download(dir: string, names: string[]): Promise<number> {
  const queue = [...names]
  let fetched = 0
  const worker = async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      const res = await fetch(RAW_URL + encodeURIComponent(name)).catch(() => undefined)
      if (!res?.ok) {
        console.error(`skipped ${name}: ${res?.status ?? 'network error'}`)
        continue
      }
      await Bun.write(join(dir, name), await res.text())
      fetched++
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return fetched
}

async function sync(dir: string): Promise<string[]> {
  await mkdir(dir, { recursive: true })
  const names = await listing(dir)
  const present = new Set(await readdir(dir))
  const missing = names.filter((n) => !present.has(n))
  if (missing.length > 0) {
    const fetched = await download(dir, missing)
    console.error(`fetched ${fetched}/${missing.length} missing schemes into ${dir}`)
  }
  const corpus = (await readdir(dir)).filter((n) => !n.startsWith('.')).sort()
  if (corpus.length === 0) fail(`no schemes in ${dir}`)
  return corpus
}

async function codename(file: string, theme: Source): Promise<string> {
  const own = theme.meta.ansi_source?.split(' + ')[1]
  if (own) return own
  const dir = dirname(file)
  if (theme.meta.group)
    for (const sibling of new Bun.Glob('*.toml').scanSync(dir)) {
      const other = Bun.TOML.parse(await Bun.file(join(dir, sibling)).text()) as Partial<Source>
      const code = other.meta?.ansi_source?.split(' + ')[1]
      if (other.meta?.group === theme.meta.group && code) return code
    }
  return '<codename>'
}

function candidate(theme: Source, scheme: Scheme): ThemeDoc {
  const colors: Colors = {
    background: scheme.background,
    foreground: scheme.foreground,
    cursor: scheme.cursor,
    selection_background: scheme.selection,
    ansi: [...scheme.ansi],
  }
  for (const slot of theme.meta.signature) assign(colors, slot, read(theme.colors, slot))
  return { meta: { name: theme.meta.name, signature: theme.meta.signature }, colors }
}

function score(name: string, signature: Set<number>, palette: Palette): Ranked {
  const drifts = GROUPS.flat()
    .filter((i) => !signature.has(i))
    .map((i) => ({ slot: i, drift: hueDiff(hct(palette.ansi[i] as string).hue, FUNCTION_HUE[i % 8] as number) }))
  const worst = drifts.reduce((a, b) => (b.drift > a.drift ? b : a))
  const mean = drifts.reduce((sum, d) => sum + d.drift, 0) / drifts.length
  let collision = Number.POSITIVE_INFINITY
  let pair: [number, number] = [0, 0]
  for (const group of GROUPS)
    for (const a of group)
      for (const b of group) {
        if (a >= b) continue
        const delta = deltaE(palette.ansi[a] as string, palette.ansi[b] as string)
        if (delta < collision) {
          collision = delta
          pair = [a, b]
        }
      }
  const total = worst.drift + mean - COLLISION_WEIGHT * collision
  return { name, score: total, worst: worst.drift, worstSlot: worst.slot, mean, collision, pair }
}

const { values, positionals } = (() => {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      allowPositionals: true,
      options: {
        top: { type: 'string', default: '10' },
        schemes: { type: 'string', default: join(tmpdir(), 'ttheme-schemes') },
        include: { type: 'string', multiple: true, default: [] },
      },
    })
  } catch (e) {
    return fail(`${(e as Error).message}\n${USAGE}`)
  }
})()
const file = positionals[0]
const top = Number(values.top)
if (positionals.length !== 1 || file === undefined || !Number.isInteger(top) || top < 1) fail(USAGE)

const theme = Bun.TOML.parse(await Bun.file(file).text()) as unknown as Source
const signature = theme.meta?.signature ?? []
if (signature.length !== 3 || signature.some((s) => !SLOTS.includes(s)))
  fail(`${file}: meta.signature must name 3 of ${SLOTS.join(', ')}`)
const seed = hct(read(theme.colors, signature[0] as string))
const signatureAnsi = new Set(signature.filter((s) => s.startsWith('ansi')).map((s) => Number(s.slice(4))))
const code = await codename(file, theme)
const current = theme.meta.ansi_source?.split(' + ')[0]

const corpus = await sync(values.schemes)
const ranked: Ranked[] = []
const dropped = new Map<string, string>()
let dark = 0
for (const name of corpus) {
  const scheme = parseScheme(await Bun.file(join(values.schemes, name)).text())
  if (!scheme) {
    dropped.set(name, 'fewer than 16 palette entries')
    continue
  }
  if (hct(scheme.background).tone >= 50) {
    dropped.set(name, 'light background')
    continue
  }
  dark++
  let palette: Palette
  try {
    palette = harmonizePalette(candidate(theme, scheme))
  } catch (e) {
    dropped.set(name, `harmonizer: ${(e as Error).message}`)
    continue
  }
  const problems = violations(theme.meta.name, theme.meta.signature, palette)
  if (problems.length > 0) dropped.set(name, `gate: ${problems.join('; ')}`)
  else ranked.push(score(name, signatureAnsi, palette))
}
if (ranked.length === 0) {
  const reasons = new Set([...dropped.values()].filter((r) => r.startsWith('harmonizer') || r.startsWith('gate')))
  fail(`${theme.meta.name}: no dark scheme survives\n${[...reasons].slice(0, 5).join('\n')}`)
}
ranked.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))

const header = `${'rank'.padStart(4)}  ${'score'.padStart(5)}  worst (slot)  ${'mean'.padStart(4)}  min ΔE (pair)   ansi_source`
const row = (r: Ranked, rank: string) =>
  [
    rank.padStart(4),
    fixed(r.score, 1).padStart(5),
    `${fixed(r.worst).padStart(5)} (${r.worstSlot})`.padEnd(12),
    fixed(r.mean, 1).padStart(4),
    `${fixed(r.collision, 1).padStart(6)} (${r.pair.join('/')})`.padEnd(14),
    `${r.name} + ${code}`,
  ].join('  ')
const hues = Object.entries(FUNCTION_HUE)
  .map(([i, h]) => `${['', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan'][Number(i)]} ${h}`)
  .join(', ')

console.log(
  `${theme.meta.name}: signature ${signature.join(', ')} held fixed; seed ${signature[0]} hue ${fixed(seed.hue)}`,
)
console.log(`${corpus.length} schemes → ${dark} dark with 16 colors → ${ranked.length} gate-clean`)
console.log(`drift  = HCT hue distance of the harmonized slot from its function hue (${hues})`)
console.log(`         over the non-signature slots of ANSI 1-6 and 9-14; worst and mean, in degrees`)
console.log('min ΔE = smallest CIEDE2000 between two slots of ANSI 1-6, or two of 9-14')
console.log(`score  = worst + mean − ${COLLISION_WEIGHT} × min ΔE, lower is better`)
console.log('')
console.log(header)
for (const [i, r] of ranked.slice(0, top).entries()) console.log(row(r, String(i + 1)))

const included = [...new Set([...(current ? [current] : []), ...values.include])]
if (included.length > 0) {
  console.log('')
  for (const name of included) {
    const at = ranked.findIndex((r) => r.name === name)
    const tag = name === current ? '  (current base)' : ''
    const found = ranked[at]
    if (found) console.log(`${row(found, String(at + 1))}  of ${ranked.length}${tag}`)
    else if (dropped.has(name)) console.log(`   -  ${name}: ${dropped.get(name)}${tag}`)
    else console.log(`   -  ${name}: not in ${values.schemes}${tag}`)
  }
}
