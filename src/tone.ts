import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isHex } from './color.ts'
import { writeAtomic } from './edits.ts'
import { inMode, type PaletteEntry, slotColor, withColors } from './manifest.ts'
import { MODES, type Mode, modeOf, otherOf } from './mode.ts'

const TONE_SLOTS = [
  'background',
  'foreground',
  'cursor',
  'selection',
  ...Array.from({ length: 16 }, (_, i) => `ansi${i}`),
] as const

type ToneSlot = (typeof TONE_SLOTS)[number]

type Override = Partial<Record<ToneSlot, string>>

type Moded = Partial<Record<Mode, Override>>

interface Tone {
  [palette: string]: Moded
}

const VERSION = 2

export function tonePath(configHome: string): string {
  return join(configHome, 'ttheme', 'tone.json')
}

function isSlot(slot: string): slot is ToneSlot {
  return (TONE_SLOTS as readonly string[]).includes(slot)
}

function readOverride(slots: unknown): Override {
  const kept: Override = {}

  if (typeof slots !== 'object' || slots === null) {
    return kept
  }

  for (const [slot, color] of Object.entries(slots)) {
    if (isSlot(slot) && typeof color === 'string' && isHex(color.toLowerCase())) {
      kept[slot] = color.toLowerCase()
    }
  }

  return kept
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

  const file = parsed as { version?: unknown; palettes?: unknown } | null

  if (file?.version !== VERSION || typeof file.palettes !== 'object' || file.palettes === null) {
    return {}
  }

  const tone: Tone = {}

  for (const [name, modes] of Object.entries(file.palettes)) {
    if (typeof modes !== 'object' || modes === null) {
      continue
    }

    const kept: Moded = {}

    for (const mode of MODES) {
      const over = readOverride((modes as Record<string, unknown>)[mode])

      if (Object.keys(over).length > 0) {
        kept[mode] = over
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
  const palettes = Object.fromEntries(Object.entries(tone).filter(([, modes]) => Object.keys(modes).length > 0))

  if (Object.keys(palettes).length === 0) {
    rmSync(path, { force: true })

    return
  }

  writeAtomic(path, `${JSON.stringify({ version: VERSION, palettes }, null, 2)}\n`)
}

export function slotColors(
  entry: Pick<PaletteEntry, 'background' | 'foreground' | 'cursor' | 'selection' | 'ansi'>,
): string[] {
  return TONE_SLOTS.map((slot) => slotColor(entry, slot))
}

export function overrideOf(entry: PaletteEntry, colors: readonly string[]): Override {
  return Object.fromEntries(
    TONE_SLOTS.flatMap((slot, i) => {
      const color = (colors[i] as string).toLowerCase()

      return color === slotColor(entry, slot).toLowerCase() ? [] : [[slot, color]]
    }),
  )
}

export function toneOf(tone: Tone, entry: PaletteEntry): Override | undefined {
  return tone[entry.name]?.[modeOf(entry)]
}

export function tonedEntry(entry: PaletteEntry, over: Override | undefined): PaletteEntry {
  if (!over) {
    return entry
  }

  const same = (slot: ToneSlot) => over[slot] === undefined || over[slot] === slotColor(entry, slot).toLowerCase()

  if (TONE_SLOTS.every(same)) {
    return entry
  }

  const pick = (slot: ToneSlot) => over[slot] ?? slotColor(entry, slot)

  return withColors(entry, {
    background: pick('background'),
    foreground: pick('foreground'),
    cursor: pick('cursor'),
    selection: pick('selection'),
    ansi: TONE_SLOTS.slice(4).map(pick),
  })
}

export function tonedModes(entry: PaletteEntry, tone: Tone): PaletteEntry {
  const primary = tonedEntry(entry, toneOf(tone, entry))
  const other = otherOf(modeOf(entry))
  const over = tone[entry.name]?.[other]

  if (!over) {
    return primary
  }

  const { background, foreground, cursor, selection, ansi } = tonedEntry(inMode(entry, other), over)

  return { ...primary, other: { background, foreground, cursor, selection, ansi } }
}

export function tuned(entries: PaletteEntry[], tone: Tone): PaletteEntry[] {
  return Object.keys(tone).length === 0 ? entries : entries.map((entry) => tonedEntry(entry, toneOf(tone, entry)))
}

export function tunedNames(tone: Tone, entries: readonly PaletteEntry[]): string[] {
  return entries.flatMap((entry) => (toneOf(tone, entry) === undefined ? [] : [entry.name]))
}

export function withTone(tone: Tone, name: string, mode: Mode, over: Override): Tone {
  const modes: Moded = { ...tone[name] }

  if (Object.keys(over).length === 0) {
    delete modes[mode]
  } else {
    modes[mode] = over
  }

  const next = { ...tone }

  if (Object.keys(modes).length === 0) {
    delete next[name]
  } else {
    next[name] = modes
  }

  return next
}

export function moveTone(configHome: string, renamed: ReadonlyMap<string, string>, removed: readonly string[]): void {
  const tone = readTone(configHome)
  const names = Object.keys(tone)

  if (!names.some((name) => renamed.has(name) || removed.includes(name))) {
    return
  }

  writeTone(
    configHome,
    Object.fromEntries(
      Object.entries(tone)
        .filter(([name]) => !removed.includes(name))
        .map(([name, modes]) => [renamed.get(name) ?? name, modes]),
    ),
  )
}
