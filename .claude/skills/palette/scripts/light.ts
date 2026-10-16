import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import { check } from '../../../../src/contrast.ts'
import type { Move } from '../../../../src/fix.ts'
import { colorsOfTheme } from '../../../../src/manifest.ts'
import { CONTAINER_TONE, CURSOR_TONE, lookalikes, mirrored } from '../../../../src/mirror.ts'
import { type Mode, modeOf, otherOf } from '../../../../src/mode.ts'
import { colorsToml, withTable } from '../../../../src/own.ts'
import type { Shade } from '../../../../src/theme.ts'
import { deltaE, tripletDelta } from './delta.ts'

interface ThemeDoc {
  meta: { name: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
  contrast?: { waive?: string[] }
}

export interface Mirrored {
  file: string
  name: string
  to: Mode
  shade: Shade
  moves: Move[]
  tuned: string[]
  text: string
}

interface Member {
  file: string
  source: string
  name: string
  signature: string[]
  waive: string[]
  own: Shade
  to: Mode
  base: Shade
  shade: Shade
  moves: Move[]
}

const CATALOG_MIN = 13
const STEP = 0.5
const DRIFT = 0.001
const ROUNDS = 8

const BANDS = { cursor: CURSOR_TONE, selection: CONTAINER_TONE }

type Movable = keyof typeof BANDS

const hct = (hex: string) => Hct.fromInt(argbFromHex(hex))

function slotOf(shade: Shade, slot: string): string {
  if (slot === 'background') return shade.background
  if (slot === 'foreground') return shade.foreground
  if (slot === 'cursor') return shade.cursor
  if (slot === 'selection') return shade.selectionBackground
  return shade.ansi[Number(slot.slice(4))] as string
}

const withSlot = (shade: Shade, slot: Movable, value: string): Shade =>
  slot === 'cursor' ? { ...shade, cursor: value } : { ...shade, selectionBackground: value }

const signatureOf = (m: Member, shade: Shade) => m.signature.map((slot) => slotOf(shade, slot))

const signed = (m: Member) => ({ name: m.name, signatureSlots: m.signature, waive: m.waive })

function member(file: string, source: string): Member {
  const doc = Bun.TOML.parse(source) as unknown as ThemeDoc
  const c = doc.colors
  const own = {
    background: c.background,
    foreground: c.foreground,
    cursor: c.cursor,
    selectionBackground: c.selection_background,
    ansi: c.ansi,
  }
  const waive = doc.contrast?.waive ?? []
  const { shade, moves } = mirrored({ ...own, name: doc.meta.name, signatureSlots: doc.meta.signature, waive })

  return {
    file,
    source,
    name: doc.meta.name,
    signature: doc.meta.signature,
    waive,
    own,
    to: otherOf(modeOf(own)),
    base: shade,
    shade,
    moves,
  }
}

function nearestMate(members: Member[], i: number, shadeOf: (m: Member) => Shade): number {
  const own = signatureOf(members[i] as Member, shadeOf(members[i] as Member))

  return Math.min(
    Number.POSITIVE_INFINITY,
    ...members.filter((_, j) => j !== i).map((m) => tripletDelta(own, signatureOf(m, shadeOf(m)))),
  )
}

function tune(members: Member[]) {
  if (members.length < 2) return
  const targets = members.map((_, i) =>
    Math.min(
      CATALOG_MIN,
      nearestMate(members, i, (m) => m.own),
    ),
  )
  const drift = (m: Member) =>
    (['cursor', 'selection'] as const).reduce(
      (n, slot) => n + Math.abs(hct(slotOf(m.shade, slot)).tone - hct(slotOf(m.base, slot)).tone),
      0,
    )
  const score = () =>
    members.reduce(
      (n, m, i) => n + Math.max(0, (targets[i] as number) - nearestMate(members, i, (x) => x.shade)) + DRIFT * drift(m),
      0,
    )

  for (let round = 0; round < ROUNDS; round++) {
    let moved = false
    for (const m of members) {
      for (const slot of (['cursor', 'selection'] as const).filter((s) => m.signature.includes(s))) {
        const band = BANDS[slot][m.to]
        const source = hct(slotOf(m.own, slot))
        const alike = lookalikes(signed(m), m.base).length
        const failing = check({ ...signed(m), ...m.base }).length
        let best = score()
        let kept = m.shade
        for (let tone = band.min; tone <= band.max; tone += STEP) {
          const shade = withSlot(
            m.shade,
            slot,
            hexFromArgb(Hct.from(source.hue, source.chroma, tone).toInt()).toLowerCase(),
          )
          if (lookalikes(signed(m), shade).length > alike) continue
          const held = m.shade
          m.shade = shade
          const s = score()
          m.shade = held
          if (s < best - 1e-9 && check({ ...signed(m), ...shade }).length <= failing) {
            best = s
            kept = shade
          }
        }
        if (kept !== m.shade) {
          m.shade = kept
          moved = true
        }
      }
    }
    if (!moved) break
  }
}

function textOf(m: Member): string {
  const table = `colors.${m.to}`
  const cleared = withTable(m.source, `colors.${otherOf(m.to)}`, undefined, 'colors')

  return withTable(cleared, table, colorsToml(colorsOfTheme(m.shade), table).join('\n'), 'colors')
}

async function catalog(dir: string, sources: Map<string, string>): Promise<Member[]> {
  const files = (await Array.fromAsync(new Bun.Glob('*.toml').scan(dir))).sort().map((name) => join(dir, name))

  return Promise.all(files.map(async (file) => member(file, sources.get(file) ?? (await Bun.file(file).text()))))
}

export async function mirrorCatalogs(files: string[], sources = new Map<string, string>()): Promise<Mirrored[]> {
  const given = new Map([...sources].map(([file, text]) => [resolve(file), text]))
  const out: Mirrored[] = []

  for (const dir of new Set(files.map((file) => dirname(resolve(file))))) {
    const members = await catalog(dir, given)
    tune(members)
    for (const m of members) {
      const tuned = (['cursor', 'selection'] as const).filter((slot) => slotOf(m.shade, slot) !== slotOf(m.base, slot))
      out.push({ file: m.file, name: m.name, to: m.to, shade: m.shade, moves: m.moves, tuned, text: textOf(m) })
    }
  }

  return out
}

export async function writeMirrors(files: string[], sources = new Map<string, string>()): Promise<Mirrored[]> {
  const made = await mirrorCatalogs(files, sources)
  for (const m of made) writeFileSync(m.file, m.text)
  return made
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
  const made = values.write ? await writeMirrors(positionals) : await mirrorCatalogs(positionals)
  let failed = 0
  for (const m of made) {
    const doc = Bun.TOML.parse(m.text) as unknown as ThemeDoc
    const left = check({
      ...m.shade,
      name: m.name,
      signatureSlots: doc.meta.signature,
      waive: doc.contrast?.waive ?? [],
    })
    console.log(`${m.name}: ${m.to}`)
    for (const v of m.moves)
      console.log(`  turned  ${v.slot} ${v.from} → ${v.to} (${v.rule}, ΔE ${deltaE(v.from, v.to).toFixed(1)})`)
    for (const slot of m.tuned) console.log(`  tuned   ${slot} → ${slotOf(m.shade, slot)} (apart from its castmates)`)
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
