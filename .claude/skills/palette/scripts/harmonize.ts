import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import { check, ROLE_HUES } from '../../../../src/contrast.ts'
import type { Theme } from '../../../../src/theme.ts'
import { deltaE } from './delta.ts'

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
const SURFACE_CHROMA = 8
const TEXT_CHROMA = 12
const GREY_CHROMA = 10
const BRIGHT_LIFT = 12
const SELECTION_CHROMA = 24
const SELECTION_TONE = { dark: 26, light: 86 }
const SIGNATURE_TEXT_CHROMA = 24
const CURSOR_TONE = { dark: { min: 43, max: 84 }, light: { min: 36, max: 56 } }
const CONTAINER_TONE = { dark: { min: 16, max: 30 }, light: { min: 70, max: 90 } }
const OWN_CHROMA = 16
const DARK_ANCHOR_TONE = 42.6
const NORMAL_TONE: Record<number, number> = { 1: 66, 2: 70, 3: 76, 4: 66, 5: 68, 6: 72 }
const LIGHT_TONE: Record<number, number> = { 1: 46, 2: 44, 3: 50, 4: 46, 5: 46, 6: 44 }

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
  return make(o.hue, Math.min(o.chroma, SELECTION_CHROMA), light ? SELECTION_TONE.light : SELECTION_TONE.dark)
}

function accent(own: string, index: number, seedHue: number, light: boolean, rotate = true): string {
  const o = hct(own)
  const base = index % 8
  const hue = o.chroma < GREY_CHROMA ? (ROLE_HUES[base]?.center as number) : o.hue
  const chroma = Math.max(CHROMA_MIN, Math.min(CHROMA_MAX, o.chroma))
  const tone = light
    ? (LIGHT_TONE[base] as number) - (index > 8 ? BRIGHT_LIFT / 2 : 0)
    : (NORMAL_TONE[base] as number) + (index > 8 ? BRIGHT_LIFT : 0)
  return make(rotate ? harmonize(hue, seedHue) : hue, chroma, tone)
}

function cursor(own: string, light: boolean): string {
  const o = hct(own)
  const band = light ? CURSOR_TONE.light : CURSOR_TONE.dark
  return make(
    o.hue,
    o.chroma < OWN_CHROMA ? o.chroma : Math.max(CHROMA_MIN, Math.min(CHROMA_MAX, o.chroma)),
    Math.max(band.min, Math.min(band.max, o.tone)),
  )
}

function container(own: string, light: boolean): string {
  const o = hct(own)
  const band = light ? CONTAINER_TONE.light : CONTAINER_TONE.dark
  return make(o.hue, o.chroma, Math.max(band.min, Math.min(band.max, o.tone)))
}

function signatureText(own: string, light: boolean): string {
  const o = hct(own)
  return make(o.hue, Math.min(o.chroma, SIGNATURE_TEXT_CHROMA), light ? 12 : 90)
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
    if (slot === 'background') out[slot] = make(hct(value).hue, surfaceChroma, light ? 98 : 8)
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
        background: surface(98),
        foreground: text(12),
        cursor: cursor(doc.colors.cursor, true),
        selection: selection(doc.colors.selection_background, true),
        ansi: doc.colors.ansi.map((own, i) => accent(own, i, seed.hue, true, rotate)),
      }
    : {
        background: surface(8),
        foreground: text(90),
        cursor: cursor(doc.colors.cursor, false),
        selection: selection(doc.colors.selection_background, false),
        ansi: doc.colors.ansi.map((own, i) => accent(own, i, seed.hue, false, rotate)),
      }
  palette.ansi[0] = light ? surface(18) : surface(14)
  palette.ansi[7] = light ? surface(30) : surface(80)
  palette.ansi[8] = surface(light ? 55 : 50)
  palette.ansi[15] = light ? text(12) : text(94)
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

function colorsBlock(p: Palette): string {
  const quote = (s: string) => `  "${s}",`
  return [
    '[colors]',
    `background = "${p.background}"`,
    `foreground = "${p.foreground}"`,
    `cursor = "${p.cursor}"`,
    `selection_background = "${p.selection}"`,
    'ansi = [',
    ...p.ansi.slice(0, 8).map(quote),
    '',
    ...p.ansi.slice(8).map(quote),
    ']',
    '',
  ].join('\n')
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
    if (write) {
      const start = source.indexOf('[colors]')
      if (start === -1) throw new Error(`${file}: no [colors] section`)
      await Bun.write(file, source.slice(0, start) + colorsBlock(palette))
    }
  }
  console.log(
    failed === 0
      ? `gate clean (${files.length} themes${write ? ', written' : ''})`
      : `${failed} theme(s) violate the gate`,
  )
  process.exit(failed === 0 ? 0 : 1)
}
