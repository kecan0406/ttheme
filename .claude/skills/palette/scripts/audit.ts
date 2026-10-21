import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { argbFromHex, Hct } from '@material/material-color-utilities'
import { type Departure, departures } from '../../../../src/core/harmonize.ts'
import { lookalikes } from '../../../../src/core/mirror.ts'
import { type Catalog, MARKETPLACE_FILE, readCatalogs } from '../../../../src/core/theme.ts'
import { deltaE, tripletDelta } from './delta.ts'

interface Colors {
  background: string
  foreground: string
  cursor: string
  selection_background: string
  ansi: string[]
}

export interface ThemeDoc {
  catalog: string
  meta: { name: string; ansi_source: string; signature: string[] }
  colors: Colors & { light?: Colors; dark?: Colors }
}

export type Anchor = [string, string]

export interface AnchorEntry {
  slots: Record<string, Anchor>
  unused: Anchor[]
  source: string
  note?: string
}

const CATALOG_MIN = 13
const CURSOR_MIN = 3
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

export const width = (s: string) => [...s].reduce((n, c) => n + (WIDE.test(c) ? 2 : 1), 0)
export const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - width(s)))

export function catalogOf(file: string): string {
  return basename(dirname(resolve(file)))
}

export function themesOf(file: string): string {
  let dir = resolve(dirname(file))
  while (!existsSync(join(dir, MARKETPLACE_FILE))) {
    const up = dirname(dir)
    if (up === dir) return 'themes'
    dir = up
  }
  return dir
}

export async function readTheme(file: string): Promise<ThemeDoc> {
  return { ...(Bun.TOML.parse(await Bun.file(file).text()) as Omit<ThemeDoc, 'catalog'>), catalog: catalogOf(file) }
}

export async function loadPalettes(themes: string): Promise<ThemeDoc[]> {
  const docs: ThemeDoc[] = []
  for await (const file of new Bun.Glob('palettes/*/*.toml').scan(themes)) {
    docs.push(await readTheme(join(themes, file)))
  }
  return docs.sort((a, b) => a.meta.name.localeCompare(b.meta.name))
}

export async function loadCatalogs(themes: string): Promise<Catalog[]> {
  const path = join(themes, MARKETPLACE_FILE)
  return readCatalogs(MARKETPLACE_FILE, (Bun.TOML.parse(await Bun.file(path).text()) as { catalog?: unknown }).catalog)
}

export async function loadAnchors(file: string): Promise<Record<string, AnchorEntry>> {
  return (await Bun.file(file).json()) as Record<string, AnchorEntry>
}

export function otherSide(doc: ThemeDoc): ThemeDoc | undefined {
  const other = doc.colors.light ?? doc.colors.dark

  return other === undefined ? undefined : { ...doc, colors: other }
}

const sideOf = (doc: ThemeDoc) => (doc.colors.light === undefined ? 'dark' : 'light')

export function slotColor(doc: ThemeDoc, slot: string): string {
  const c = doc.colors
  if (slot === 'background') return c.background
  if (slot === 'foreground') return c.foreground
  if (slot === 'cursor') return c.cursor
  if (slot === 'selection') return c.selection_background
  const color = /^ansi\d+$/.test(slot) ? c.ansi[Number(slot.slice(4))] : undefined
  if (color === undefined) throw new Error(`${doc.meta.name}: unknown slot ${slot}`)
  return color
}

const signatureColors = (doc: ThemeDoc) => doc.meta.signature.map((slot) => slotColor(doc, slot))
const fixed = (n: number) => n.toFixed(1)
const signed = (n: number) => {
  const r = Math.round(n * 10) / 10
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(1)}°`
}

function hct(hex: string) {
  const h = Hct.fromInt(argbFromHex(hex))
  return { hue: h.hue, chroma: h.chroma, tone: h.tone }
}

const hctLabel = (hex: string) => {
  const h = hct(hex)
  return `H${Math.round(h.hue).toString().padStart(3)} C${Math.round(h.chroma).toString().padStart(2)} T${Math.round(h.tone).toString().padStart(3)}`
}

const shadeOf = (doc: ThemeDoc) => ({
  background: doc.colors.background,
  foreground: doc.colors.foreground,
  cursor: doc.colors.cursor,
  selectionBackground: doc.colors.selection_background,
  ansi: doc.colors.ansi,
})

const reasonsOf = (d: Departure) => [
  ...(d.far ? [`ΔE ${fixed(d.delta)}`] : []),
  ...(d.turned ? [`hue ${signed(d.shift as number)}`] : []),
]

function audit(
  doc: ThemeDoc,
  palettes: ThemeDoc[],
  entry: AnchorEntry | undefined,
  anchored: boolean,
  side = '',
): string[] {
  const { meta, catalog } = doc
  const { name, signature } = meta
  const reasons: string[] = []
  console.log(`\n── ${name} · ${catalog} · signature ${signature.join('/')}${side && ` · ${side} mode`}`)

  const alike = lookalikes({ name, signatureSlots: signature, waive: [] }, shadeOf(doc)).map(([a, b]) => `${a}/${b}`)
  console.log(`  signature  ${alike.length === 0 ? 'every slot reads apart' : `reads as one: ${alike.join(', ')} !`}`)
  if (alike.length > 0) reasons.push(`signature look-alike: ${alike.join(', ')}`)

  const own = signatureColors(doc)
  const siblings = palettes
    .filter((t) => t.catalog === catalog && t.meta.name !== name)
    .map((t) => ({ name: t.meta.name, d: tripletDelta(own, signatureColors(t)) }))
    .sort((a, b) => a.d - b.d)
  const crowded = siblings.filter((s) => s.d < CATALOG_MIN)
  console.log(
    `  catalog    ${siblings.length === 0 ? 'no other theme' : siblings.map((s) => `${s.name} ${fixed(s.d)}${s.d < CATALOG_MIN ? ' !' : ''}`).join('   ')}`,
  )
  if (crowded.length > 0) reasons.push(`catalog collision: ${crowded.map((s) => `${s.name} ${fixed(s.d)}`).join(', ')}`)

  const cursors = palettes
    .filter((t) => t.catalog !== catalog)
    .map((t) => ({ label: `${t.meta.name} (${t.catalog})`, d: deltaE(doc.colors.cursor, t.colors.cursor) }))
    .sort((a, b) => a.d - b.d)
  const dupes = cursors.filter((c) => c.d < CURSOR_MIN)
  const shown = dupes.length > 0 ? dupes : cursors.slice(0, 1)
  console.log(
    `  cursor     ${doc.colors.cursor}  ${dupes.length > 0 ? 'duplicates' : 'nearest outside the catalog:'} ${shown.map((c) => `${c.label} ${fixed(c.d)}${c.d < CURSOR_MIN ? ' !' : ''}`).join('   ')}`,
  )
  if (dupes.length > 0) reasons.push(`cursor duplicate: ${dupes.map((c) => `${c.label} ${fixed(c.d)}`).join(', ')}`)

  if (!anchored) return reasons
  if (entry === undefined) {
    console.log('  departure  no anchors entry')
    return reasons
  }
  console.log(`  departure  ${entry.source}`)
  const measured = departures(entry.slots, signature, shadeOf(doc))
  const partWidth = Math.max(0, ...Object.values(entry.slots).map(([part]) => width(part)))
  for (const slot of signature) {
    const d = measured.find((m) => m.slot === slot)
    if (d === undefined) {
      console.log(`    ${pad(slot, 10)} unmeasured`)
      continue
    }
    console.log(
      `    ${pad(slot, 10)} ${pad(d.part, partWidth)}  ${d.measured} ${hctLabel(d.measured)} → ${d.final} ${hctLabel(d.final)}   ΔE ${fixed(d.delta).padStart(4)}   hue ${(d.shift === undefined ? 'grey' : signed(d.shift)).padStart(7)}${reasonsOf(d).length > 0 ? ' !' : ''}`,
    )
  }
  for (const [slot, [part, hex]] of Object.entries(entry.slots)) {
    if (!signature.includes(slot))
      console.log(`    ${pad(slot, 10)} ${pad(part, partWidth)}  ${hex.toLowerCase()}  not in signature`)
  }
  const moved = measured.filter((d) => reasonsOf(d).length > 0)
  if (moved.length > 0)
    reasons.push(`departure: ${moved.map((d) => `${d.slot} ${reasonsOf(d).join(', ')}`).join('; ')}`)
  if (entry.note) {
    console.log(`  note       ${entry.note}`)
    reasons.push(`note: ${entry.note}`)
  }
  return reasons
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: { anchors: { type: 'string' } },
    allowPositionals: true,
  })
  if (positionals.length === 0) {
    console.error('usage: bun audit.ts themes/palettes/<catalog>/<name>.toml [...] [--anchors <file>]')
    process.exit(1)
  }
  const palettes = await loadPalettes(themesOf(positionals[0] as string))
  const others = palettes.flatMap((doc) => otherSide(doc) ?? [])
  const anchors = values.anchors === undefined ? {} : await loadAnchors(values.anchors)
  const review: [string, string[]][] = []
  for (const file of positionals) {
    const doc = await readTheme(file)
    const reasons = audit(doc, palettes, anchors[doc.meta.name], values.anchors !== undefined)
    const other = otherSide(doc)
    if (other !== undefined)
      reasons.push(...audit(other, others, undefined, false, sideOf(doc)).map((r) => `${sideOf(doc)}: ${r}`))
    if (reasons.length > 0) review.push([doc.meta.name, reasons])
  }
  const nameWidth = Math.max(0, ...review.map(([name]) => name.length))
  console.log(`\nowner review — ${review.length} of ${positionals.length} themes`)
  for (const [name, reasons] of review) {
    reasons.forEach((r, i) => {
      console.log(`  ${(i === 0 ? name : '').padEnd(nameWidth)}  ${r}`)
    })
  }
}
