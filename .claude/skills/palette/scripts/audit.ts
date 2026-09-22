import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { argbFromHex, Hct } from '@material/material-color-utilities'
import { deltaE, tripletDelta } from './delta.ts'

export interface ThemeDoc {
  meta: { name: string; group: string; ansi_source: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
}

export type Anchor = [string, string]

export interface AnchorEntry {
  slots: Record<string, Anchor>
  unused: Anchor[]
  source: string
  note?: string
}

const SERIES_MIN = 13
const CURSOR_MIN = 3
const DEPARTURE_MAX = 10
const HUE_MAX = 12
const ACHROMATIC = 5
const DELTA_SLOTS = ['cursor', 'selection']
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

export const width = (s: string) => [...s].reduce((n, c) => n + (WIDE.test(c) ? 2 : 1), 0)
export const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - width(s)))

export async function readTheme(file: string): Promise<ThemeDoc> {
  return Bun.TOML.parse(await Bun.file(file).text()) as unknown as ThemeDoc
}

export async function loadCatalog(dir: string): Promise<ThemeDoc[]> {
  const docs: ThemeDoc[] = []
  for await (const file of new Bun.Glob('*.toml').scan(dir)) {
    if (!file.startsWith('_')) docs.push(await readTheme(join(dir, file)))
  }
  return docs.sort((a, b) => a.meta.name.localeCompare(b.meta.name))
}

export async function loadAnchors(file: string): Promise<Record<string, AnchorEntry>> {
  return (await Bun.file(file).json()) as Record<string, AnchorEntry>
}

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

function hueShift(from: string, to: string): number | undefined {
  const a = hct(from)
  const b = hct(to)
  if (a.chroma < ACHROMATIC && b.chroma < ACHROMATIC) return undefined
  return ((b.hue - a.hue + 540) % 360) - 180
}

interface Departure {
  slot: string
  part: string
  measured: string
  final: string
  delta: number
  shift: number | undefined
  reasons: string[]
}

function departures(doc: ThemeDoc, entry: AnchorEntry): Departure[] {
  return doc.meta.signature.flatMap((slot) => {
    const anchor = entry.slots[slot]
    if (anchor === undefined) return []
    const [part, measured] = anchor
    const final = slotColor(doc, slot)
    const delta = deltaE(measured, final)
    const shift = hueShift(measured, final)
    const reasons: string[] = []
    if (DELTA_SLOTS.includes(slot) && delta > DEPARTURE_MAX) reasons.push(`ΔE ${fixed(delta)}`)
    if (shift !== undefined && Math.abs(shift) > HUE_MAX) reasons.push(`hue ${signed(shift)}`)
    return [{ slot, part, measured: measured.toLowerCase(), final, delta, shift, reasons }]
  })
}

function audit(doc: ThemeDoc, catalog: ThemeDoc[], entry: AnchorEntry | undefined, anchored: boolean): string[] {
  const { name, group, signature } = doc.meta
  const reasons: string[] = []
  console.log(`\n── ${name} · ${group} · signature ${signature.join('/')}`)

  const own = signatureColors(doc)
  const series = catalog
    .filter((t) => t.meta.group === group && t.meta.name !== name)
    .map((t) => ({ name: t.meta.name, d: tripletDelta(own, signatureColors(t)) }))
    .sort((a, b) => a.d - b.d)
  const crowded = series.filter((s) => s.d < SERIES_MIN)
  console.log(
    `  series     ${series.length === 0 ? 'no other theme' : series.map((s) => `${s.name} ${fixed(s.d)}${s.d < SERIES_MIN ? ' !' : ''}`).join('   ')}`,
  )
  if (crowded.length > 0) reasons.push(`series collision: ${crowded.map((s) => `${s.name} ${fixed(s.d)}`).join(', ')}`)

  const cursors = catalog
    .filter((t) => t.meta.group !== group)
    .map((t) => ({ label: `${t.meta.name} (${t.meta.group})`, d: deltaE(doc.colors.cursor, t.colors.cursor) }))
    .sort((a, b) => a.d - b.d)
  const dupes = cursors.filter((c) => c.d < CURSOR_MIN)
  const shown = dupes.length > 0 ? dupes : cursors.slice(0, 1)
  console.log(
    `  cursor     ${doc.colors.cursor}  ${dupes.length > 0 ? 'duplicates' : 'nearest outside the series:'} ${shown.map((c) => `${c.label} ${fixed(c.d)}${c.d < CURSOR_MIN ? ' !' : ''}`).join('   ')}`,
  )
  if (dupes.length > 0) reasons.push(`cursor duplicate: ${dupes.map((c) => `${c.label} ${fixed(c.d)}`).join(', ')}`)

  if (!anchored) return reasons
  if (entry === undefined) {
    console.log('  departure  no anchors entry')
    return reasons
  }
  console.log(`  departure  ${entry.source}`)
  const measured = departures(doc, entry)
  const partWidth = Math.max(0, ...Object.values(entry.slots).map(([part]) => width(part)))
  for (const slot of signature) {
    const d = measured.find((m) => m.slot === slot)
    if (d === undefined) {
      console.log(`    ${pad(slot, 10)} unmeasured`)
      continue
    }
    console.log(
      `    ${pad(slot, 10)} ${pad(d.part, partWidth)}  ${d.measured} ${hctLabel(d.measured)} → ${d.final} ${hctLabel(d.final)}   ΔE ${fixed(d.delta).padStart(4)}   hue ${(d.shift === undefined ? 'grey' : signed(d.shift)).padStart(7)}${d.reasons.length > 0 ? ' !' : ''}`,
    )
  }
  for (const [slot, [part, hex]] of Object.entries(entry.slots)) {
    if (!signature.includes(slot))
      console.log(`    ${pad(slot, 10)} ${pad(part, partWidth)}  ${hex.toLowerCase()}  not in signature`)
  }
  const moved = measured.filter((d) => d.reasons.length > 0)
  if (moved.length > 0) reasons.push(`departure: ${moved.map((d) => `${d.slot} ${d.reasons.join(', ')}`).join('; ')}`)
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
    console.error('usage: bun audit.ts themes/<name>.toml [...] [--anchors <file>]')
    process.exit(1)
  }
  const catalog = await loadCatalog(dirname(positionals[0] as string))
  const anchors = values.anchors === undefined ? {} : await loadAnchors(values.anchors)
  const review: [string, string[]][] = []
  for (const file of positionals) {
    const doc = await readTheme(file)
    const reasons = audit(doc, catalog, anchors[doc.meta.name], values.anchors !== undefined)
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
