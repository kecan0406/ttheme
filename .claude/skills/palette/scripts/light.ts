import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { check } from '../../../../src/contrast.ts'
import { type Mode, mirrored, modeOf, otherOf, type Shade } from '../../../../src/mirror.ts'
import { deltaE } from './delta.ts'
import { colorsBlock } from './harmonize.ts'

interface ThemeDoc {
  meta: { name: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
  contrast?: { waive?: string[] }
}

const OTHER = /\n\[colors\.(?:dark|light)\][\s\S]*$/

function shadeOf(doc: ThemeDoc): Shade {
  const c = doc.colors

  return {
    background: c.background,
    foreground: c.foreground,
    cursor: c.cursor,
    selectionBackground: c.selection_background,
    ansi: c.ansi,
  }
}

const block = (shade: Shade, mode: Mode) =>
  colorsBlock(
    {
      background: shade.background,
      foreground: shade.foreground,
      cursor: shade.cursor,
      selection: shade.selectionBackground,
      ansi: shade.ansi,
    },
    `colors.${mode}`,
  )

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
  const out: Record<string, Record<string, { label: string; colors: Record<string, unknown> }>> = {}
  let failed = 0
  for (const file of positionals) {
    const source = await Bun.file(file).text()
    const doc = Bun.TOML.parse(source) as unknown as ThemeDoc
    const own = shadeOf(doc)
    const to = otherOf(modeOf(own))
    const theme = { ...own, name: doc.meta.name, signatureSlots: doc.meta.signature, waive: doc.contrast?.waive ?? [] }
    const { shade, moves } = mirrored(theme)
    const left = check({ ...theme, ...shade })
    console.log(`${doc.meta.name}: ${to}`)
    for (const m of moves)
      console.log(`  turned  ${m.slot} ${m.from} → ${m.to} (${m.rule}, ΔE ${deltaE(m.from, m.to).toFixed(1)})`)
    for (const v of left) console.log(`  gate    ${v.rule} — ${v.detail}`)
    if (left.length > 0) failed++
    out[doc.meta.name] = {
      [to]: {
        label: to === 'light' ? '라이트 (거울)' : '다크 (거울)',
        colors: {
          background: shade.background,
          foreground: shade.foreground,
          cursor: shade.cursor,
          selection_background: shade.selectionBackground,
          ansi: shade.ansi,
        },
      },
    }
    if (values.write) await Bun.write(file, `${source.replace(OTHER, '').trimEnd()}\n\n${block(shade, to)}`)
  }
  if (values.variants) writeFileSync(values.variants, `${JSON.stringify(out, null, 2)}\n`)
  console.log(
    failed === 0
      ? `gate clean (${positionals.length} themes${values.write ? ', written' : ''})`
      : `${failed} theme(s) violate the gate`,
  )
  process.exit(failed === 0 ? 0 : 1)
}
