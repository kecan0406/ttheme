import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import { check } from '../../../../src/contrast.ts'
import { fixRoles } from '../../../../src/fix.ts'
import type { Theme } from '../../../../src/theme.ts'
import { deltaE } from './delta.ts'
import {
  CONTAINER_TONE,
  CURSOR_TONE,
  SELECTION_CHROMA,
  SELECTION_TONE,
  SURFACE_CHROMA,
  TEXT_CHROMA,
  TONES,
} from './harmonize.ts'

interface ThemeDoc {
  meta: { name: string; signature: string[] }
  colors: Palette
}

interface Palette {
  background: string
  foreground: string
  cursor: string
  selection_background: string
  ansi: string[]
}

type Mode = 'dark' | 'light'

const SIGNATURE_TEXT_CHROMA = 24
const SURFACE = { dark: 8, light: 98 }
const TEXT = { dark: 90, light: 12 }
const NEUTRALS = new Set([0, 7, 8])

const hct = (hex: string) => Hct.fromInt(argbFromHex(hex))
const hex = (h: Hct) => hexFromArgb(h.toInt()).toLowerCase()
const make = (hue: number, chroma: number, tone: number) => hex(Hct.from(hue, chroma, tone))
const clamp = (v: number, band: { min: number; max: number }) => Math.max(band.min, Math.min(band.max, v))

function slotColor(c: Palette, slot: string): string {
  if (slot === 'background') return c.background
  if (slot === 'foreground') return c.foreground
  if (slot === 'cursor') return c.cursor
  if (slot === 'selection') return c.selection_background
  return c.ansi[Number(slot.slice(4))] as string
}

export function modeOf(c: Palette): Mode {
  return hct(c.background).tone > hct(c.foreground).tone ? 'light' : 'dark'
}

export function mirror(doc: ThemeDoc): Palette {
  const c = doc.colors
  const to: Mode = modeOf(c) === 'dark' ? 'light' : 'dark'
  const signature = doc.meta.signature
  const seed = hct(slotColor(c, signature[0] as string))
  const surface = (tone: number) => make(seed.hue, Math.min(seed.chroma, SURFACE_CHROMA), tone)
  const text = (tone: number) => make(seed.hue, Math.min(seed.chroma, TEXT_CHROMA), tone)
  const own = (value: string, tone: number, chroma = Number.POSITIVE_INFINITY) => {
    const o = hct(value)
    return make(o.hue, Math.min(o.chroma, chroma), tone)
  }
  const flipped = (value: string) => 100 - hct(value).tone
  return {
    background: surface(SURFACE[to]),
    foreground: signature.includes('foreground') ? own(c.foreground, TEXT[to], SIGNATURE_TEXT_CHROMA) : text(TEXT[to]),
    cursor: own(c.cursor, clamp(flipped(c.cursor), CURSOR_TONE[to])),
    selection_background: signature.includes('selection')
      ? own(c.selection_background, clamp(flipped(c.selection_background), CONTAINER_TONE[to]))
      : own(c.selection_background, SELECTION_TONE[to], SELECTION_CHROMA),
    ansi: c.ansi.map((value, i) => {
      const tone = TONES[to][i] as number
      if (NEUTRALS.has(i)) return surface(tone)
      if (i === 15) return text(tone)
      return own(value, tone)
    }),
  }
}

function gated(doc: ThemeDoc, p: Palette): Theme {
  return {
    name: doc.meta.name,
    background: p.background,
    foreground: p.foreground,
    selectionBackground: p.selection_background,
    ansi: p.ansi,
    signatureSlots: doc.meta.signature,
    waive: [],
  } as unknown as Theme
}

export function settle(doc: ThemeDoc, p: Palette): { palette: Palette; turns: string[]; left: string[] } {
  if (check(gated(doc, p)).length === 0) return { palette: p, turns: [], left: [] }
  const { theme, moves } = fixRoles(gated(doc, p))
  const palette = { ...p, ansi: theme.ansi }
  return {
    palette,
    turns: moves.map((m) => `${m.slot} ${m.from} → ${m.to} (${m.rule}, ΔE ${deltaE(m.from, m.to).toFixed(1)})`),
    left: check(gated(doc, palette)).map((v) => `${v.rule} — ${v.detail}`),
  }
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: { variants: { type: 'string' } },
  })
  if (positionals.length === 0) {
    console.error('usage: bun light.ts [--variants <variants.json>] <theme.toml> [...]')
    process.exit(1)
  }
  const out: Record<string, Record<string, { label: string; colors: Palette }>> = {}
  let failed = 0
  for (const file of positionals) {
    const doc = Bun.TOML.parse(await Bun.file(file).text()) as unknown as ThemeDoc
    const to: Mode = modeOf(doc.colors) === 'dark' ? 'light' : 'dark'
    const made = settle(doc, mirror(doc))
    console.log(`${doc.meta.name}: ${to}`)
    for (const line of made.turns) console.log(`  turned  ${line}`)
    for (const line of made.left) console.log(`  gate    ${line}`)
    if (made.left.length > 0) failed++
    out[doc.meta.name] = { [to]: { label: to === 'light' ? '라이트 (거울)' : '다크 (거울)', colors: made.palette } }
  }
  if (values.variants) writeFileSync(values.variants, `${JSON.stringify(out, null, 2)}\n`)
  console.log(failed === 0 ? `gate clean (${positionals.length} themes)` : `${failed} theme(s) violate the gate`)
  process.exit(failed === 0 ? 0 : 1)
}
