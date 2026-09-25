import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { oklch } from '../../../../src/color.ts'
import { check } from '../../../../src/contrast.ts'
import { fixRoles } from '../../../../src/fix.ts'
import type { Theme } from '../../../../src/theme.ts'
import { deltaE } from './delta.ts'

interface ThemeDoc {
  meta: { name: string; group: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
  contrast?: { waive?: string[] }
}

function gated(doc: ThemeDoc, ansi: string[]): Theme {
  return {
    name: doc.meta.name,
    background: doc.colors.background,
    foreground: doc.colors.foreground,
    selectionBackground: doc.colors.selection_background,
    ansi,
    signatureSlots: doc.meta.signature,
    waive: doc.contrast?.waive ?? [],
  } as unknown as Theme
}

function fix(doc: ThemeDoc): { ansi: string[]; moves: { slot: number; rule: string }[] } {
  const { theme, moves } = fixRoles(gated(doc, doc.colors.ansi))
  return {
    ansi: theme.ansi,
    moves: moves.map((m) => ({ slot: Number(m.slot.slice(4)), rule: m.rule })),
  }
}

function rewrite(text: string, ansi: string[]): string {
  const start = text.indexOf('ansi = [')
  const end = text.indexOf(']', start)
  let index = 0
  const block = text.slice(start, end).replace(/"#[0-9a-fA-F]{6}"/g, () => `"${ansi[index++]}"`)
  if (index !== 16) throw new Error(`expected 16 ANSI colors, found ${index}`)
  return text.slice(0, start) + block + text.slice(end)
}

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: { write: { type: 'boolean', default: false }, report: { type: 'string' } },
  allowPositionals: true,
})
if (positionals.length === 0) {
  console.error('usage: bun ansi-roles.ts [--write] [--report <file.json>] themes/<a>.toml [...]')
  process.exit(1)
}

const report: unknown[] = []
let failed = 0
for (const file of positionals) {
  const text = await Bun.file(file).text()
  const doc = Bun.TOML.parse(text) as unknown as ThemeDoc
  const { ansi, moves } = fix(doc)
  const left = check(gated(doc, ansi))
  failed += left.length
  const net = [...new Set(moves.map((m) => m.slot))].map((slot) => {
    const from = doc.colors.ansi[slot] as string
    const to = ansi[slot] as string
    return {
      slot,
      rules: [...new Set(moves.filter((m) => m.slot === slot).flatMap((m) => m.rule.split(', ')))],
      from,
      to,
      hueFrom: Math.round(oklch(from).h),
      hueTo: Math.round(oklch(to).h),
      de: Math.round(deltaE(from, to) * 10) / 10,
    }
  })
  if (net.length > 0 || left.length > 0) {
    console.log(`\n── ${doc.meta.name} · ${doc.meta.group}`)
    for (const n of net)
      console.log(
        `  ansi${n.slot}  ${n.from} → ${n.to}  ${n.hueFrom}° → ${n.hueTo}°  ΔE ${n.de}  ${n.rules.join(', ')}`,
      )
    for (const v of left) console.log(`  still: ${v.rule} — ${v.detail}`)
  }
  report.push({
    name: doc.meta.name,
    group: doc.meta.group,
    signature: doc.meta.signature,
    background: doc.colors.background,
    foreground: doc.colors.foreground,
    cursor: doc.colors.cursor,
    before: doc.colors.ansi,
    after: ansi,
    changes: net,
  })
  if (values.write && net.length > 0) writeFileSync(file, rewrite(text, ansi))
}

if (values.report) writeFileSync(values.report, JSON.stringify(report))
console.log(failed === 0 ? '\nrole rules clean' : `\n${failed} violation(s) left`)
process.exit(failed === 0 ? 0 : 1)
