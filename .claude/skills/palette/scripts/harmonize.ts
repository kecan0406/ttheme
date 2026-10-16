import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import { check, ROLE_HUES } from '../../../../src/contrast.ts'
import {
  CONTAINER_TONE,
  CURSOR_TONE,
  SELECTION_CHROMA,
  SELECTION_TONE,
  SIGNATURE_TEXT_CHROMA,
  SURFACE_CHROMA,
  SURFACE_TONE,
  TEXT_CHROMA,
  TEXT_TONE,
  TONES,
} from '../../../../src/mirror.ts'
import { colorsToml, withTable } from '../../../../src/own.ts'
import type { Theme } from '../../../../src/theme.ts'
import { deltaE } from './delta.ts'
import { mirrorInto } from './light.ts'

interface ThemeDoc {
  meta: { name: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
}

interface Palette {
  background: string
  foreground: string
  cursor: string
  selection: string
  ansi: string[]
}

const HARMONY = 0.4
const THRESHOLD = 60
const CHROMA_MIN = 32
const CHROMA_MAX = 64
const GREY_CHROMA = 10
const OWN_CHROMA = 16
const DARK_ANCHOR_TONE = 53.5

const hct = (hex: string) => Hct.fromInt(argbFromHex(hex))
const hex = (h: Hct) => hexFromArgb(h.toInt()).toLowerCase()
const make = (hue: number, chroma: number, tone: number) => hex(Hct.from(hue, chroma, tone))
const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}
const hueDir = (from: number, to: number) => ((to - from + 360) % 360 <= 180 ? 1 : -1)

function harmonize(hue: number, seedHue: number): number {
  const rotation = Math.min(hueDiff(hue, seedHue) * HARMONY, THRESHOLD)
  return (hue + rotation * hueDir(hue, seedHue) + 360) % 360
}

function slotColor(doc: ThemeDoc, slot: string): string {
  const c = doc.colors
  if (slot === 'background') return c.background
  if (slot === 'foreground') return c.foreground
  if (slot === 'cursor') return c.cursor
  if (slot === 'selection') return c.selection_background
  const color = c.ansi[Number(slot.slice(4))]
  if (color === undefined) throw new Error(`${doc.meta.name}: unknown slot ${slot}`)
  return color
}

function selection(own: string, light: boolean): string {
  const o = hct(own)
  return make(o.hue, Math.min(o.chroma, SELECTION_CHROMA), SELECTION_TONE[light ? 'light' : 'dark'])
}

function accent(own: string, index: number, seedHue: number, light: boolean, rotate = true): string {
  const o = hct(own)
  const base = index % 8
  const hue = o.chroma < GREY_CHROMA ? (ROLE_HUES.get(base)?.center as number) : o.hue
  const chroma = Math.max(CHROMA_MIN, Math.min(CHROMA_MAX, o.chroma))
  const tone = TONES[light ? 'light' : 'dark'][index] as number
  return make(rotate ? harmonize(hue, seedHue) : hue, chroma, tone)
}

function cursor(own: string, light: boolean): string {
  const o = hct(own)
  const band = CURSOR_TONE[light ? 'light' : 'dark']
  return make(
    o.hue,
    o.chroma < OWN_CHROMA ? o.chroma : Math.max(CHROMA_MIN, Math.min(CHROMA_MAX, o.chroma)),
    Math.max(band.min, Math.min(band.max, o.tone)),
  )
}

function container(own: string, light: boolean): string {
  const o = hct(own)
  const band = CONTAINER_TONE[light ? 'light' : 'dark']
  return make(o.hue, o.chroma, Math.max(band.min, Math.min(band.max, o.tone)))
}

function signatureText(own: string, light: boolean): string {
  const o = hct(own)
  return make(o.hue, Math.min(o.chroma, SIGNATURE_TEXT_CHROMA), TEXT_TONE[light ? 'light' : 'dark'])
}

export function signatureColors(doc: ThemeDoc): Record<string, string> {
  const seedSlot = doc.meta.signature[0]
  if (seedSlot === undefined) throw new Error(`${doc.meta.name}: signature is empty`)
  const seed = hct(slotColor(doc, seedSlot))
  const light = hct(doc.colors.background).tone > 50
  const surfaceChroma = Math.min(seed.chroma, SURFACE_CHROMA)
  const out: Record<string, string> = {}
  for (const slot of doc.meta.signature) {
    const value = slotColor(doc, slot)
    if (slot === 'background') out[slot] = make(hct(value).hue, surfaceChroma, SURFACE_TONE[light ? 'light' : 'dark'])
    else if (slot === 'foreground') out[slot] = signatureText(value, light)
    else if (slot === 'cursor') out[slot] = cursor(value, light)
    else if (slot === 'selection') out[slot] = container(value, light)
    else out[slot] = accent(value, Number(slot.slice(4)), seed.hue, light, false)
  }
  return out
}

function darkTextAnchors(doc: ThemeDoc): string[] {
  if (doc.meta.signature.includes('selection')) return []
  return doc.meta.signature.filter(
    (slot) => slot.startsWith('ansi') && hct(slotColor(doc, slot)).tone < DARK_ANCHOR_TONE,
  )
}

export function harmonizePalette(doc: ThemeDoc): Palette {
  const seedSlot = doc.meta.signature[0]
  if (seedSlot === undefined) throw new Error(`${doc.meta.name}: signature is empty`)
  const seed = hct(slotColor(doc, seedSlot))
  const light = hct(doc.colors.background).tone > 50
  const dark = light ? [] : darkTextAnchors(doc)
  if (dark.length > 0) {
    throw new Error(
      `${doc.meta.name}: ${dark.join(', ')} hold${dark.length === 1 ? 's' : ''} an anchor darker than T${DARK_ANCHOR_TONE}, which a text slot can only show as a pastel — put the darkest identity color in selection_background and name selection in meta.signature`,
    )
  }
  const rotate = seed.chroma >= GREY_CHROMA
  const surfaceChroma = Math.min(seed.chroma, SURFACE_CHROMA)
  const textChroma = Math.min(seed.chroma, TEXT_CHROMA)
  const surface = (tone: number) => make(seed.hue, surfaceChroma, tone)
  const text = (tone: number) => make(seed.hue, textChroma, tone)
  const palette: Palette = light
    ? {
        background: surface(SURFACE_TONE.light),
        foreground: text(TEXT_TONE.light),
        cursor: cursor(doc.colors.cursor, true),
        selection: selection(doc.colors.selection_background, true),
        ansi: doc.colors.ansi.map((own, i) => accent(own, i, seed.hue, true, rotate)),
      }
    : {
        background: surface(SURFACE_TONE.dark),
        foreground: text(TEXT_TONE.dark),
        cursor: cursor(doc.colors.cursor, false),
        selection: selection(doc.colors.selection_background, false),
        ansi: doc.colors.ansi.map((own, i) => accent(own, i, seed.hue, false, rotate)),
      }
  const tones = TONES[light ? 'light' : 'dark']
  palette.ansi[0] = surface(tones[0] as number)
  palette.ansi[7] = surface(tones[7] as number)
  palette.ansi[8] = surface(tones[8] as number)
  palette.ansi[15] = text(tones[15] as number)
  for (const [slot, value] of Object.entries(signatureColors(doc))) {
    if (slot === 'background') palette.background = value
    else if (slot === 'foreground') palette.foreground = value
    else if (slot === 'cursor') palette.cursor = value
    else if (slot === 'selection') palette.selection = value
    else palette.ansi[Number(slot.slice(4))] = value
  }
  return palette
}

export function violations(name: string, signature: string[], p: Palette): string[] {
  const theme = {
    name,
    background: p.background,
    foreground: p.foreground,
    selectionBackground: p.selection,
    ansi: p.ansi,
    signatureSlots: signature,
    waive: [],
  } as unknown as Theme
  return check(theme).map((v) => `${v.rule} — ${v.detail}`)
}

function departures(doc: ThemeDoc, p: Palette): string[] {
  const out = (slot: string) =>
    slot === 'background'
      ? p.background
      : slot === 'foreground'
        ? p.foreground
        : slot === 'cursor'
          ? p.cursor
          : slot === 'selection'
            ? p.selection
            : (p.ansi[Number(slot.slice(4))] as string)
  const fmt = (h: Hct) => `H${Math.round(h.hue)} C${Math.round(h.chroma)} T${Math.round(h.tone)}`
  return doc.meta.signature.map((slot) => {
    const from = slotColor(doc, slot)
    const to = out(slot)
    return `  ${slot.padEnd(10)} ${from} ${fmt(hct(from)).padEnd(15)} → ${to} ${fmt(hct(to)).padEnd(15)} ΔE ${deltaE(from, to).toFixed(1)}`
  })
}

export function colorsBlock(p: Palette): string {
  return `${colorsToml(p, 'colors').join('\n')}\n`
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  const write = args.includes('--write')
  const files = args.filter((a) => a !== '--write')
  if (files.length === 0) {
    console.error('usage: bun harmonize.ts [--write] <theme.toml> [...]')
    process.exit(1)
  }
  let failed = 0
  for (const file of files) {
    const source = await Bun.file(file).text()
    const doc = Bun.TOML.parse(source) as unknown as ThemeDoc
    const palette = harmonizePalette(doc)
    console.log(`${doc.meta.name}: signature, measured → written`)
    for (const line of departures(doc, palette)) console.log(line)
    const problems = violations(doc.meta.name, doc.meta.signature, palette)
    if (problems.length > 0) {
      failed++
      for (const p of problems) console.log(`${doc.meta.name}: ${p}`)
    }
    if (write) await Bun.write(file, mirrorInto(withTable(source, 'colors', colorsBlock(palette), 'colors')).text)
  }
  console.log(
    failed === 0
      ? `gate clean (${files.length} themes${write ? ', written' : ''})`
      : `${failed} theme(s) violate the gate`,
  )
  process.exit(failed === 0 ? 0 : 1)
}
