import { spread } from './ansi.ts'
import type { Hex } from './color.ts'
import { oklch } from './color.ts'
import { check } from './contrast.ts'
import { lchShort, painter } from './editor-paint.ts'
import type { PaletteEntry } from './manifest.ts'
import { BASE, gatedOf, listOf, misses, PAIRS, SLOT_NAMES } from './palette-editor.ts'
import type { Colors } from './seeds.ts'
import { slotColors } from './tone.ts'

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

export function toneRows(base: PaletteEntry, worn: PaletteEntry, color: boolean): string[] {
  const p = painter(color)
  const list = listOf(colorsOfEntry(worn))
  const given = slotColors(base).map((hex) => hex.toLowerCase())
  const bad = misses(list, worn.signatureSlots, worn.waived ?? [])
  const failing = check(gatedOf(list, worn.signatureSlots, worn.waived ?? [])).length
  const off = (slot: number) => list[slot]?.toLowerCase() !== given[slot]
  const tuned = list.filter((_, slot) => off(slot)).length
  const cell = (slot: number) => {
    const hex = list[slot] as Hex
    const glyph = worn.signatureSlots.includes(SLOT_NAMES[slot] as string) ? '◆' : color ? '■' : ' '
    const swatch = color ? `${p.fg(hex)}${glyph}\x1b[39m` : glyph
    const mark = bad.has(slot) ? p.bold('✗') : off(slot) ? (color ? '\x1b[33m●\x1b[39m' : '●') : ' '
    return ` ${swatch} ${lchShort(oklch(hex))}${mark}`
  }
  const gate = failing === 0 ? 'passes the gate' : `${failing} ${failing === 1 ? 'miss' : 'misses'} in the gate`
  const rows = [
    `  ${spread(`${p.dim('Palette')}${tuned > 0 ? p.dim(`  ${tuned} tuned`) : ''}`, p.dim(gate), WIDTH - 2)}`,
  ]
  for (let row = 0; row < BASE.length; row++) {
    rows.push(`  ${(BASE[row] as string).padEnd(10)}${cell(row)}`)
  }
  rows.push(`  ${p.dim(`${'ANSI'.padEnd(10)} ${'Normal'.padEnd(18)} Bright`)}`)
  PAIRS.forEach((name, k) => {
    rows.push(`  ${name.padEnd(10)}${cell(BASE.length + k)}${cell(BASE.length + 8 + k)}`)
  })
  return rows
}
