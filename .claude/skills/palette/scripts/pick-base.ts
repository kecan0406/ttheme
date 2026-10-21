import { basename, dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { argbFromHex, Hct } from '@material/material-color-utilities'
import {
  COLLISION_WEIGHT,
  FUNCTION_HUE,
  parseScheme,
  type Ranked,
  rankBases,
  seeded,
} from '../../../../src/core/base.ts'
import { slotOf } from '../../../../src/core/mirror.ts'
import { readSchemes, schemesDir, syncSchemes } from '../../../../src/store/schemes.ts'
import { anchoredOf, colorsBlock, type ThemeDoc } from './harmonize.ts'

interface Source extends ThemeDoc {
  meta: ThemeDoc['meta'] & { ansi_source?: string }
}

const SLOTS = ['cursor', 'foreground', 'background', 'selection', ...Array.from({ length: 16 }, (_, i) => `ansi${i}`)]
const USAGE =
  'usage: bun pick-base.ts themes/palettes/<catalog>/<name>.toml [--top N] [--schemes <dir>] [--include <name> ...] [--apply <scheme> [--codename <name>]]'

const fixed = (n: number, digits = 0) => n.toFixed(digits)

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function sync(dir: string): Promise<string[]> {
  const corpus = await syncSchemes(dir)
  for (const note of corpus.notes) console.error(note)
  if (corpus.missing > 0) console.error(`fetched ${corpus.fetched}/${corpus.missing} missing schemes into ${dir}`)
  if (corpus.names.length === 0) fail(`no schemes in ${dir}`)
  return corpus.names
}

async function codename(file: string, theme: Source): Promise<string> {
  const own = theme.meta.ansi_source?.split(' + ')[1]
  if (own) return own
  const dir = dirname(file)
  for (const sibling of new Bun.Glob('*.toml').scanSync(dir)) {
    const other = Bun.TOML.parse(await Bun.file(join(dir, sibling)).text()) as Partial<Source>
    const code = other.meta?.ansi_source?.split(' + ')[1]
    if (code) return code
  }
  return '<codename>'
}

const { values, positionals } = (() => {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      allowPositionals: true,
      options: {
        top: { type: 'string', default: '10' },
        schemes: { type: 'string', default: schemesDir() },
        include: { type: 'string', multiple: true, default: [] },
        apply: { type: 'string' },
        codename: { type: 'string' },
      },
    })
  } catch (e) {
    return fail(`${(e as Error).message}\n${USAGE}`)
  }
})()
const file = positionals[0]
const top = Number(values.top)
if (positionals.length !== 1 || file === undefined || !Number.isInteger(top) || top < 1) fail(USAGE)

const source = Bun.TOML.parse(await Bun.file(file).text()) as unknown as Source
const signature = source.meta?.signature ?? []
if (signature.length !== 3 || signature.some((s) => !SLOTS.includes(s)))
  fail(`${file}: meta.signature must name 3 of ${SLOTS.join(', ')}`)
const theme = anchoredOf(source)
const seed = Hct.fromInt(argbFromHex(slotOf(theme, signature[0] as string)))
const code = values.codename ?? (await codename(file, source))
const current = source.meta.ansi_source?.split(' + ')[0]

if (values.apply !== undefined) {
  if (code === '<codename>')
    fail(`${theme.name}: no sibling names a codename for ${basename(dirname(file))}; pass --codename`)
  const path = join(values.schemes, values.apply)
  if (!(await Bun.file(path).exists())) await sync(values.schemes)
  if (!(await Bun.file(path).exists())) fail(`${values.apply}: not in ${values.schemes}`)
  const scheme = parseScheme(await Bun.file(path).text())
  if (!scheme) fail(`${values.apply}: fewer than 16 palette entries`)
  const text = await Bun.file(file).text()
  const start = text.indexOf('[colors]')
  if (start === -1) fail(`${file}: no [colors] section`)
  const line = `ansi_source = "${values.apply} + ${code}"`
  const head = text.slice(0, start)
  const meta = /^ansi_source = .*$/m.test(head)
    ? head.replace(/^ansi_source = .*$/m, line)
    : head.replace(/^order = .*$/m, (order) => `${order}\n${line}`)
  if (!meta.includes(line)) fail(`${file}: no ansi_source or order line to place ${line}`)
  await Bun.write(file, meta + colorsBlock(seeded(theme, scheme)))
  console.log(`${theme.name}: ${line}, signature kept, rest from the scheme; harmonize it next`)
  process.exit(0)
}

const corpus = await sync(values.schemes)
const { ranked, dropped, dark } = rankBases(
  theme,
  (await readSchemes(values.schemes, corpus)).map(([name, text]) => [name, parseScheme(text)] as const),
)
if (ranked.length === 0) {
  const reasons = new Set([...dropped.values()].filter((r) => r.startsWith('harmonizer') || r.startsWith('gate')))
  fail(`${theme.name}: no dark scheme survives\n${[...reasons].slice(0, 5).join('\n')}`)
}

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
const hues = [...FUNCTION_HUE]
  .map(([i, h]) => `${['', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan'][i]} ${h}`)
  .join(', ')

console.log(`${theme.name}: signature ${signature.join(', ')} held fixed; seed ${signature[0]} hue ${fixed(seed.hue)}`)
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
