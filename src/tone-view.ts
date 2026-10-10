import type { Hex } from './color.ts'
import { oklch } from './color.ts'
import { check } from './contrast.ts'
import { lchTight } from './editor-paint.ts'
import type { PaletteEntry } from './manifest.ts'
import { BASE, gatedOf, listOf, misses, PAIRS, SLOT_NAMES } from './palette-editor.ts'
import type { Colors } from './seeds.ts'
import { slotColors } from './tone.ts'
import { boxEdge, boxed } from './tui/parts.ts'
import { FG_RESET, MARKS, painter } from './tui/style.ts'

const WIDTH = 50

function colorsOfEntry(entry: PaletteEntry): Colors {
  return {
    background: entry.background as Hex,
    foreground: entry.foreground as Hex,
    cursor: entry.cursor as Hex,
    selection: entry.selection as Hex,
    ansi: entry.ansi as Hex[],
  }
}

function headOf(width: number, title: string, notes: string[]): [number, string][] {
  for (const note of notes) {
    const at = width - 4 - note.length
    if (at > title.length + 2) {
      return [
        [2, title],
        [at, ` ${note} `],
      ]
    }
  }
  return [[2, title]]
}

export function toneRows(base: PaletteEntry, worn: PaletteEntry, color: boolean, width = WIDTH): string[] {
  const p = painter(color)
  const list = listOf(colorsOfEntry(worn))
  const given = slotColors(base).map((hex) => hex.toLowerCase())
  const bad = misses(list, worn.signatureSlots, worn.waived ?? [])
  const failing = check(gatedOf(list, worn.signatureSlots, worn.waived ?? [])).length
  const off = (slot: number) => list[slot]?.toLowerCase() !== given[slot]
  const tuned = list.filter((_, slot) => off(slot)).length
  const cell = (slot: number) => {
    const hex = list[slot] as Hex
    const glyph = worn.signatureSlots.includes(SLOT_NAMES[slot] as string)
      ? MARKS.signature
      : color
        ? MARKS.swatch
        : ' '
    const swatch = color ? `${p.fg(hex)}${glyph}${FG_RESET}` : glyph
    const mark = bad.has(slot) ? p.bold(MARKS.miss) : off(slot) ? p.warn(MARKS.on) : ' '
    return ` ${swatch} ${lchTight(oklch(hex))}${mark}`
  }
  const gate = failing === 0 ? 'passes the gate' : `${failing} ${failing === 1 ? 'miss' : 'misses'} in the gate`
  const notes = tuned > 0 ? [`${tuned} tuned · ${gate}`, gate] : [gate]
  return [
    p.dim(boxEdge(width, 'top', headOf(width, ' Palette ', notes))),
    ...BASE.map((name, row) => boxed(p, ` ${name.padEnd(10)}${cell(row)}`, width)),
    p.dim(
      boxEdge(width, 'mid', [
        [2, ' ANSI '],
        [12, ' Normal 0–7 '],
        [29, ' Bright 8–15 '],
      ]),
    ),
    ...PAIRS.map((name, k) =>
      boxed(p, ` ${name.padEnd(10)}${cell(BASE.length + k)}${cell(BASE.length + 8 + k)}`, width),
    ),
    p.dim(boxEdge(width, 'bottom')),
  ]
}
