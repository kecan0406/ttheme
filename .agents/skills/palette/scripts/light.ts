import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { deltaE } from '../../../../src/core/color.ts'
import { check } from '../../../../src/core/contrast.ts'
import { colorsToml } from '../../../../src/core/draft.ts'
import type { Move } from '../../../../src/core/fix.ts'
import { colorsOfTheme } from '../../../../src/core/manifest.ts'
import { mirrored } from '../../../../src/core/mirror.ts'
import { type Mode, modeOf, otherOf } from '../../../../src/core/mode.ts'
import { withTable } from '../../../../src/core/own.ts'
import { setBlocks, withPalette } from '../../../../src/core/sets.ts'
import type { Shade } from '../../../../src/core/theme.ts'

interface ThemeDoc {
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
}

export interface Palette {
  file: string
  slug: string
  text: string
}

export interface Mirrored {
  file: string
  name: string
  to: Mode
  shade: Shade
  moves: Move[]
  text: string
}

interface Member {
  file: string
  source: string
  name: string
  to: Mode
  shade: Shade
  moves: Move[]
}

export function setPalettes(files: string[]): Palette[] {
  return [...new Set(files.map((file) => resolve(file)))].flatMap((file) =>
    setBlocks(basename(file), readFileSync(file, 'utf8')).blocks.map(({ slug, text }) => ({ file, slug, text })),
  )
}

function member({ file, slug, text }: Palette): Member {
  const doc = Bun.TOML.parse(text) as unknown as ThemeDoc
  const c = doc.colors
  const own = {
    background: c.background,
    foreground: c.foreground,
    cursor: c.cursor,
    selectionBackground: c.selection_background,
    ansi: c.ansi,
  }
  const { shade, moves } = mirrored({ ...own, name: slug })

  return {
    file,
    source: text,
    name: slug,
    to: otherOf(modeOf(own)),
    shade,
    moves,
  }
}

function textOf(m: Member): string {
  const table = `colors.${m.to}`
  const cleared = withTable(m.source, `colors.${otherOf(m.to)}`, undefined, 'colors')

  return withTable(cleared, table, colorsToml(colorsOfTheme(m.shade), table).join('\n'), 'colors')
}

export function mirrorPalettes(palettes: Palette[]): Mirrored[] {
  return palettes.map((palette) => {
    const m = member(palette)

    return { file: m.file, name: m.name, to: m.to, shade: m.shade, moves: m.moves, text: textOf(m) }
  })
}

export function writeMirrors(palettes: Palette[]): Mirrored[] {
  const made = mirrorPalettes(palettes)
  const sets = new Map<string, string>()
  for (const m of made) {
    const source = sets.get(m.file) ?? readFileSync(m.file, 'utf8')
    sets.set(m.file, withPalette(basename(m.file), source, m.name, m.text) as string)
  }
  for (const [file, text] of sets) writeFileSync(file, text)
  return made
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: { variants: { type: 'string' }, write: { type: 'boolean' } },
  })
  if (positionals.length === 0) {
    console.error('usage: bun light.ts [--write] [--variants <variants.json>] builtin/sets/<work>.toml [...]')
    process.exit(1)
  }
  const out: Record<string, Partial<Record<Mode, { label: string; colors: Record<string, unknown> }>>> = {}
  const palettes = setPalettes(positionals)
  const made = values.write ? writeMirrors(palettes) : mirrorPalettes(palettes)
  let failed = 0
  for (const m of made) {
    const left = check({ ...m.shade, name: m.name })
    console.log(`${m.name}: ${m.to}`)
    for (const v of m.moves)
      console.log(`  turned  ${v.slot} ${v.from} → ${v.to} (${v.rule}, ΔE ${deltaE(v.from, v.to).toFixed(1)})`)
    for (const v of left) console.log(`  gate    ${v.rule} — ${v.detail}`)
    if (left.length > 0) failed++
    out[m.name] = {
      [m.to]: {
        label: m.to === 'light' ? '라이트 (거울)' : '다크 (거울)',
        colors: {
          background: m.shade.background,
          foreground: m.shade.foreground,
          cursor: m.shade.cursor,
          selection_background: m.shade.selectionBackground,
          ansi: m.shade.ansi,
        },
      },
    }
  }
  if (values.variants) writeFileSync(values.variants, `${JSON.stringify(out, null, 2)}\n`)
  console.log(
    failed === 0
      ? `gate clean (${made.length} themes${values.write ? ', written' : ''})`
      : `${failed} theme(s) violate the gate`,
  )
  process.exit(failed === 0 ? 0 : 1)
}
