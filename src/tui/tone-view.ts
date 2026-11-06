import type { Hex } from '../core/color.ts'
import { oklch } from '../core/color.ts'
import { missedRules } from '../core/contrast.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import type { Colors } from '../core/seeds.ts'
import { gatedOf, lchTight, listOf, misses } from '../core/slots.ts'
import { slotColors } from '../store/tone.ts'
import { contrastOf, SEP } from './parts.ts'

export const TONE_RULE: readonly [number, string][] = [
  [2, ' ANSI '],
  [12, ' Normal 0–7 '],
  [29, ' Bright 8–15 '],
]

function colorsOfEntry(entry: PaletteEntry): Colors {
  return {
    background: entry.background as Hex,
    foreground: entry.foreground as Hex,
    cursor: entry.cursor as Hex,
    selection: entry.selection as Hex,
    ansi: entry.ansi as Hex[],
  }
}

export function toneLine(base: PaletteEntry, worn: PaletteEntry): string {
  const list = listOf(colorsOfEntry(worn))
  const given = slotColors(base).map((hex) => hex.toLowerCase())
  const bad = misses(list)
  const off = (slot: number) => list[slot]?.toLowerCase() !== given[slot]
  const tuned = list.filter((_, slot) => off(slot)).length
  const gate = contrastOf(missedRules(gatedOf(list)).length)
  const notes = tuned > 0 ? [`${tuned} tuned${SEP}${gate.toLowerCase()}`, gate] : ['', gate]
  const cells = list.map((hex, slot) => `${lchTight(oklch(hex))}${bad.has(slot) ? 'x' : off(slot) ? 't' : '-'}`)

  return [...notes, ...cells].join('|')
}
