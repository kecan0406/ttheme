import { argbFromHex, Hct } from '@material/material-color-utilities'
import { gateOf } from '../../../../src/core/base.ts'
import { deltaE } from '../../../../src/core/color.ts'
import { colorsToml } from '../../../../src/core/draft.ts'
import { type Anchored, harmonized } from '../../../../src/core/harmonize.ts'
import { colorsOfTheme } from '../../../../src/core/manifest.ts'
import { slotOf } from '../../../../src/core/mirror.ts'
import { withTable } from '../../../../src/core/own.ts'
import type { Shade } from '../../../../src/core/theme.ts'
import { writeMirrors } from './light.ts'

export interface ThemeDoc {
  meta: { name: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
}

export function anchoredOf(doc: ThemeDoc): Anchored {
  const c = doc.colors

  return {
    name: doc.meta.name,
    signatureSlots: doc.meta.signature,
    background: c.background,
    foreground: c.foreground,
    cursor: c.cursor,
    selectionBackground: c.selection_background,
    ansi: [...c.ansi],
  }
}

export function colorsBlock(shade: Shade): string {
  return `${colorsToml(colorsOfTheme(shade), 'colors').join('\n')}\n`
}

function departures(theme: Anchored, shade: Shade): string[] {
  const fmt = (hex: string) => {
    const h = Hct.fromInt(argbFromHex(hex))

    return `H${Math.round(h.hue)} C${Math.round(h.chroma)} T${Math.round(h.tone)}`
  }

  return theme.signatureSlots.map((slot) => {
    const from = slotOf(theme, slot)
    const to = slotOf(shade, slot)

    return `  ${slot.padEnd(10)} ${from} ${fmt(from).padEnd(15)} → ${to} ${fmt(to).padEnd(15)} ΔE ${deltaE(from, to).toFixed(1)}`
  })
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
  const written = new Map<string, string>()
  for (const file of files) {
    const source = await Bun.file(file).text()
    const theme = anchoredOf(Bun.TOML.parse(source) as unknown as ThemeDoc)
    const shade = harmonized(theme)
    console.log(`${theme.name}: signature, measured → written`)
    for (const line of departures(theme, shade)) console.log(line)
    const problems = gateOf(theme, shade)
    if (problems.length > 0) {
      failed++
      for (const p of problems) console.log(`${theme.name}: ${p}`)
    }
    written.set(file, withTable(source, 'colors', colorsBlock(shade), 'colors'))
  }
  if (write) await writeMirrors(files, written)
  console.log(
    failed === 0
      ? `gate clean (${files.length} themes${write ? ', written' : ''})`
      : `${failed} theme(s) violate the gate`,
  )
  process.exit(failed === 0 ? 0 : 1)
}
