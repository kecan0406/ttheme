import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { check } from '../../../../src/contrast.ts'
import type { Move } from '../../../../src/fix.ts'
import { colorsOfTheme } from '../../../../src/manifest.ts'
import { mirrored } from '../../../../src/mirror.ts'
import { type Mode, modeOf, otherOf } from '../../../../src/mode.ts'
import { colorsToml, withTable } from '../../../../src/own.ts'
import type { Shade } from '../../../../src/theme.ts'
import { deltaE } from './delta.ts'

interface ThemeDoc {
  meta: { name: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
  contrast?: { waive?: string[] }
}

export interface Mirrored {
  name: string
  to: Mode
  shade: Shade
  moves: Move[]
  text: string
}

export function mirrorInto(source: string): Mirrored {
  const doc = Bun.TOML.parse(source) as unknown as ThemeDoc
  const c = doc.colors
  const own = {
    background: c.background,
    foreground: c.foreground,
    cursor: c.cursor,
    selectionBackground: c.selection_background,
    ansi: c.ansi,
  }
  const to = otherOf(modeOf(own))
  const { shade, moves } = mirrored({
    ...own,
    name: doc.meta.name,
    signatureSlots: doc.meta.signature,
    waive: doc.contrast?.waive ?? [],
  })
  const table = `colors.${to}`
  const cleared = withTable(source, `colors.${otherOf(to)}`, undefined, 'colors')
  const text = withTable(cleared, table, colorsToml(colorsOfTheme(shade), table).join('\n'), 'colors')

  return { name: doc.meta.name, to, shade, moves, text }
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: { variants: { type: 'string' }, write: { type: 'boolean' } },
  })
  if (positionals.length === 0) {
    console.error('usage: bun light.ts [--write] [--variants <variants.json>] <theme.toml> [...]')
    process.exit(1)
  }
  const out: Record<string, Partial<Record<Mode, { label: string; colors: Record<string, unknown> }>>> = {}
  let failed = 0
  for (const file of positionals) {
    const source = await Bun.file(file).text()
    const doc = Bun.TOML.parse(source) as unknown as ThemeDoc
    const made = mirrorInto(source)
    const left = check({
      ...made.shade,
      name: made.name,
      signatureSlots: doc.meta.signature,
      waive: doc.contrast?.waive ?? [],
    })
    console.log(`${made.name}: ${made.to}`)
    for (const m of made.moves)
      console.log(`  turned  ${m.slot} ${m.from} → ${m.to} (${m.rule}, ΔE ${deltaE(m.from, m.to).toFixed(1)})`)
    for (const v of left) console.log(`  gate    ${v.rule} — ${v.detail}`)
    if (left.length > 0) failed++
    out[made.name] = {
      [made.to]: {
        label: made.to === 'light' ? '라이트 (거울)' : '다크 (거울)',
        colors: {
          background: made.shade.background,
          foreground: made.shade.foreground,
          cursor: made.shade.cursor,
          selection_background: made.shade.selectionBackground,
          ansi: made.shade.ansi,
        },
      },
    }
    if (values.write) await Bun.write(file, made.text)
  }
  if (values.variants) writeFileSync(values.variants, `${JSON.stringify(out, null, 2)}\n`)
  console.log(
    failed === 0
      ? `gate clean (${positionals.length} themes${values.write ? ', written' : ''})`
      : `${failed} theme(s) violate the gate`,
  )
  process.exit(failed === 0 ? 0 : 1)
}
