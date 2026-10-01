import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { backdropTone } from './backdrop.ts'
import { isHex } from './color.ts'
import { measure } from './contrast.ts'
import { writeAtomic } from './edits.ts'
import { type PaletteEntry, toTheme } from './manifest.ts'

export const TONE_SLOTS = [
  'background',
  'foreground',
  'cursor',
  'selection',
  ...Array.from({ length: 16 }, (_, i) => `ansi${i}`),
] as const

export type ToneSlot = (typeof TONE_SLOTS)[number]
export type Override = Partial<Record<ToneSlot, string>>
export type Tone = Record<string, Override>

const VERSION = 1

export function tonePath(configHome: string): string {
  return join(configHome, 'ttheme', 'tone.json')
}

function isSlot(slot: string): slot is ToneSlot {
  return (TONE_SLOTS as readonly string[]).includes(slot)
}

export function readTone(configHome: string): Tone {
  const path = tonePath(configHome)
  if (!existsSync(path)) {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
  const palettes = (parsed as { palettes?: unknown } | null)?.palettes
  if (typeof palettes !== 'object' || palettes === null) {
    return {}
  }
  const tone: Tone = {}
  for (const [name, slots] of Object.entries(palettes)) {
    if (typeof slots !== 'object' || slots === null) {
      continue
    }
    const kept: Override = {}
    for (const [slot, color] of Object.entries(slots)) {
      if (isSlot(slot) && typeof color === 'string' && isHex(color.toLowerCase())) {
        kept[slot] = color.toLowerCase()
      }
    }
    if (Object.keys(kept).length > 0) {
      tone[name] = kept
    }
  }
  return tone
}

export function writeTone(configHome: string, tone: Tone): void {
  const path = tonePath(configHome)
  const palettes = Object.fromEntries(Object.entries(tone).filter(([, slots]) => Object.keys(slots).length > 0))
  if (Object.keys(palettes).length === 0) {
    rmSync(path, { force: true })
    return
  }
  writeAtomic(path, `${JSON.stringify({ version: VERSION, palettes }, null, 2)}\n`)
}

export function colorOf(
  entry: Pick<PaletteEntry, 'background' | 'foreground' | 'cursor' | 'selection' | 'ansi'>,
  slot: string,
): string {
  if (slot === 'background' || slot === 'foreground' || slot === 'cursor' || slot === 'selection') {
    return entry[slot]
  }
  return entry.ansi[Number(slot.slice(4))] as string
}

export function slotColors(
  entry: Pick<PaletteEntry, 'background' | 'foreground' | 'cursor' | 'selection' | 'ansi'>,
): string[] {
  return TONE_SLOTS.map((slot) => colorOf(entry, slot))
}

export function overrideOf(entry: PaletteEntry, colors: readonly string[]): Override {
  const over: Override = {}
  TONE_SLOTS.forEach((slot, i) => {
    const color = (colors[i] as string).toLowerCase()
    if (color !== colorOf(entry, slot).toLowerCase()) {
      over[slot] = color
    }
  })
  return over
}

export function tonedEntry(entry: PaletteEntry, over: Override | undefined): PaletteEntry {
  if (!over) {
    return entry
  }
  const same = (slot: ToneSlot) => over[slot] === undefined || over[slot] === colorOf(entry, slot).toLowerCase()
  if (TONE_SLOTS.every(same)) {
    return entry
  }
  const pick = (slot: ToneSlot) => over[slot] ?? colorOf(entry, slot)
  const colors = {
    background: pick('background'),
    foreground: pick('foreground'),
    cursor: pick('cursor'),
    selection: pick('selection'),
    ansi: TONE_SLOTS.slice(4).map(pick),
  }
  const signature = entry.signatureSlots.map((slot) => (isSlot(slot) ? pick(slot) : colorOf(colors, slot)))
  const patched = { ...entry, ...colors, signature }
  const theme = toTheme(patched)
  const backdrop = backdropTone(
    {
      name: patched.name,
      background: colors.background,
      foreground: colors.foreground,
      cursor: colors.cursor,
      selection: colors.selection,
      ansi: colors.ansi,
      waived: theme.waive,
    },
    patched.signatureSlots,
  )
  return { ...patched, gate: measure(theme), backdrop }
}

export function tuned(entries: PaletteEntry[], tone: Tone): PaletteEntry[] {
  return Object.keys(tone).length === 0 ? entries : entries.map((entry) => tonedEntry(entry, tone[entry.name]))
}

export function withTone(tone: Tone, name: string, over: Override): Tone {
  const next = { ...tone }
  if (Object.keys(over).length === 0) {
    delete next[name]
  } else {
    next[name] = over
  }
  return next
}
