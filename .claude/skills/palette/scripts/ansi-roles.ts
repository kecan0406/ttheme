import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { oklch } from '../../../../src/color.ts'
import {
  ACHROMATIC,
  BRIGHT_GAP,
  brightDrift,
  check,
  DISTINCT_HUE,
  DISTINCT_LIGHTNESS,
  exemptSlots,
  hueGap,
  lookalikes,
  offRole,
  ROLE_HUES,
  ROLES,
  roleOf,
} from '../../../../src/contrast.ts'
import type { Theme } from '../../../../src/theme.ts'
import { deltaE } from './delta.ts'

interface ThemeDoc {
  meta: { name: string; group: string; signature: string[] }
  colors: { background: string; foreground: string; cursor: string; selection_background: string; ansi: string[] }
  contrast?: { waive?: string[] }
}

interface Move {
  slot: number
  rule: string
  from: string
  to: string
}

const MARGIN = 5
const PASSES = 6

const toward = (from: number, to: number) => ((to - from + 360) % 360 <= 180 ? 1 : -1)

function srgb(l: number, c: number, h: number): number[] | undefined {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3) as [number, number, number]
  const [x, y, z] = lms
  const linear = [
    4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
    -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
    -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
  ]
  if (linear.some((v) => v < -1e-4 || v > 1 + 1e-4)) return undefined
  return linear.map((v) => {
    const u = Math.min(1, Math.max(0, v))
    return Math.round(255 * (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055))
  })
}

function rehue(hex: string, hue: number): string {
  const { l, c } = oklch(hex)
  const h = (hue + 360) % 360
  let lo = 0
  let hi = c
  if (srgb(l, c, h) === undefined) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (srgb(l, mid, h) === undefined) hi = mid
      else lo = mid
    }
  } else lo = c
  const rgb = srgb(l, lo, h) as number[]
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
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

function place(ansi: string[], role: number, exempt: Set<number>): [number, number] | undefined {
  const band = ROLE_HUES[role] as { center: number; width: number }
  const [n, b] = [oklch(ansi[role] as string), oklch(ansi[role + 8] as string)]
  const span = (slot: number, now: number) =>
    exempt.has(slot)
      ? [now]
      : Array.from({ length: 2 * band.width + 1 }, (_, i) => (band.center - band.width + i + 360) % 360)
  const clear = (slot: number, hue: number, l: number) =>
    ROLES.every((j) => {
      const other = (slot > 8 ? 8 : 0) + j
      if (other === slot) return true
      const o = oklch(ansi[other] as string)
      return o.c < ACHROMATIC || hueGap(o.h, hue) >= DISTINCT_HUE + 1 || Math.abs(o.l - l) >= DISTINCT_LIGHTNESS
    })
  let best: [number, number] | undefined
  let cost = Number.POSITIVE_INFINITY
  for (const hn of span(role, n.h)) {
    if (!exempt.has(role) && !clear(role, hn, n.l)) continue
    for (const hb of span(role + 8, b.h)) {
      if (hueGap(hn, hb) > BRIGHT_GAP - MARGIN || (!exempt.has(role + 8) && !clear(role + 8, hb, b.l))) continue
      const moved = hueGap(hn, n.h) + hueGap(hb, b.h)
      if (moved < cost) {
        cost = moved
        best = [hn, hb]
      }
    }
  }
  return best
}

function fix(doc: ThemeDoc): { ansi: string[]; moves: Move[] } {
  const ansi = [...doc.colors.ansi]
  const moves: Move[] = []
  const own = new Set(doc.meta.signature)
  const set = (slot: number, rule: string, hue: number) => {
    const from = ansi[slot] as string
    const to = rehue(from, hue)
    if (to === from) return
    moves.push({ slot, rule, from, to })
    ansi[slot] = to
  }
  for (let pass = 0; pass < PASSES; pass++) {
    const theme = gated(doc, ansi)
    for (const { slot, hue } of offRole(theme)) {
      const band = ROLE_HUES[roleOf(slot)] as { center: number; width: number }
      set(slot, 'ansi-role', band.center + toward(band.center, hue) * (band.width - MARGIN))
    }
    for (const { normal, gap } of brightDrift(gated(doc, ansi))) {
      if (gap <= BRIGHT_GAP) continue
      const [anchor, mover] = own.has(`ansi${normal + 8}`) ? [normal + 8, normal] : [normal, normal + 8]
      const a = oklch(ansi[anchor] as string).h
      const m = oklch(ansi[mover] as string).h
      set(mover, 'bright-follows', a + toward(a, m) * (BRIGHT_GAP - MARGIN))
    }
    const exempt = exemptSlots({ signatureSlots: doc.meta.signature })
    for (const [a, b] of lookalikes(gated(doc, ansi))) {
      const role = roleOf(exempt.has(b) ? a : b)
      const hues = place(ansi, role, exempt)
      if (hues === undefined) continue
      set(role, 'distinct', hues[0])
      set(role + 8, 'distinct', hues[1])
    }
    if (check(gated(doc, ansi)).length === 0) break
  }
  return { ansi, moves }
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
      rules: [...new Set(moves.filter((m) => m.slot === slot).map((m) => m.rule))],
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
