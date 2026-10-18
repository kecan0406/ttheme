import type { Shade, Theme } from '@/lib/themes'
import { inMode, type PaletteEntry } from '../../src/core/manifest.ts'
import { modeOf, otherOf } from '../../src/core/mode.ts'

function shadeOf(entry: PaletteEntry): Shade {
  return {
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selectionBackground: entry.selection,
    signature: entry.signature,
    ansi: entry.ansi,
    gate: entry.gate,
  }
}

export function toTheme(entry: PaletteEntry, marketplace: string | null = null): Theme {
  const mode = modeOf(entry)

  return {
    id: marketplace ? `${marketplace}/${entry.name}` : entry.name,
    marketplace,
    name: entry.name,
    catalog: entry.catalog ?? null,
    native: entry.native ?? null,
    lead: entry.lead ?? false,
    from: entry.from ?? null,
    ansiSource: entry.ansiSource,
    signatureSlots: entry.signatureSlots,
    ...shadeOf(entry),
    mode,
    other: shadeOf(inMode(entry, otherOf(mode))),
  }
}
