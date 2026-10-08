import { fit, spread } from './ansi.ts'
import type { Spot } from './builder-layout.ts'
import { type Hex, luminance, type Oklch } from './color.ts'
import { inGamut, srgb } from './fix.ts'
import {
  BASE,
  type Channel,
  type Check,
  CONTRAST,
  type Format,
  gateRows,
  type PaletteEditor,
  ruleSlots,
  type Scope,
  slotChecks,
  slotLabel,
} from './palette-editor.ts'
import type { Colors } from './seeds.ts'
import { boxEdge, boxed, checkOf } from './tui/parts.ts'
import { FG_RESET, INK_RESET, MARKS, open, type Paint } from './tui/style.ts'
import { type KeySpot, zone } from './tui/zones.ts'

export const LEFT = 50

export type EditorSpot =
  | KeySpot
  | { kind: 'slot'; slot: number }
  | { kind: 'channel'; channel: number }
  | { kind: 'bar'; channel: number }
  | { kind: 'field'; field: number }
  | { kind: 'seed'; field: number }
  | { kind: 'scope'; scope: Scope }
  | { kind: 'view'; view: PaletteEditor['view'] }
  | { kind: 'scene'; scene: number }
  | { kind: 'choice'; index: number }
  | { kind: 'plane'; row: number; rows: number }
  | { kind: 'format'; format: Format }
  | { kind: 'run'; spot: Spot }
  | { kind: 'open'; slot: number }
  | { kind: 'entry'; index: number }
  | { kind: 'picker' }

export function spot(target: EditorSpot, text: string): string {
  return zone(target, text)
}

export function ink(hex: Hex): Hex {
  return luminance(hex) > 0.35 ? '#000000' : '#ffffff'
}

export function heldOf(e: PaletteEditor, at: Oklch): number | undefined {
  return e.held !== undefined && e.held - at.c > 0.0005 ? e.held : undefined
}

export function contrastLine(p: Paint, e: PaletteEditor, barWidth: number, origin?: number): string {
  const here = e.mode === 'tune' && e.channel === CONTRAST
  const ratio = e.ratio()
  const { floor } = e.partner()
  const at = (r: number) => Math.round((Math.log(Math.max(1, r)) / Math.log(21)) * (barWidth - 1))
  const pos = at(ratio)
  const tick = floor === undefined ? -1 : at(floor)
  const was = origin === undefined ? -1 : at(origin)
  const line = here ? '━' : '─'
  const bar = Array.from({ length: barWidth }, (_, k) =>
    k === pos ? p.bold('●') : k === was ? '○' : k === tick ? '┃' : k < tick ? p.dim(line) : line,
  ).join('')
  const shown = `${ratio.toFixed(2)}:1`.padStart(6)
  const grip: EditorSpot = { kind: 'channel', channel: CONTRAST }
  return `${spot(grip, here ? p.bold('▸◐') : p.dim(' ◐'))} ${spot({ kind: 'bar', channel: CONTRAST }, bar)} ${spot(grip, here ? p.bold(shown) : p.dim(shown))}`
}

export function fixHint(e: PaletteEditor, slot: number): string | undefined {
  if (!e.misses().has(slot)) {
    return undefined
  }
  if (ruleSlots(e.list, e.signature, e.waive, 'bright-follows').includes(slot)) {
    return slot - BASE.length < 8 ? '= makes the bright follow its normal' : '= on the normal makes this follow it'
  }
  return 'f moves the colors the gate misses'
}

export function detailChecks(e: PaletteEditor, slot: number, at: Oklch): Check[] {
  const checks = slotChecks(e.list, e.signature, e.waive, slot)
  const held = heldOf(e, at)
  if (held !== undefined) {
    checks.push({
      ok: undefined,
      text: `Chroma ○ ${held.toFixed(3)} is held while you tune — ${at.c.toFixed(3)} fits this lightness and hue`,
    })
  }
  return checks
}

export function lchTight(at: Oklch): string {
  const short = (n: number, digits: number) => n.toFixed(digits).replace(/^0(?=\.)/, '')
  return `${short(at.l, 2)} ${short(at.c, 3)} ${at.h.toFixed(0).padStart(3)}°`
}

export function lchShort(at: Oklch): string {
  return `${at.l.toFixed(2)} ${at.c.toFixed(3)} ${at.h.toFixed(0).padStart(3)}°`
}

function gateLines(p: Paint, e: PaletteEditor, room: number, wide = LEFT): string[] {
  const rows = gateRows(e.list, e.signature, e.waive).sort((a, b) => Number(a.ok !== false) - Number(b.ok !== false))
  const failing = rows.filter((r) => r.ok === false).length
  const head = `  ${p.dim('Gate')}  ${failing === 0 ? p.dim('passes') : p.bold(`${failing} ${failing === 1 ? 'miss' : 'misses'}`)}`
  const width = wide - 4
  const lines = rows.flatMap((r) => {
    const tail = `${r.value} ${r.bound}`
    const row = `  ${checkOf(p, r.ok)} ${spread(r.ok === false ? r.label : p.dim(r.label), p.dim(tail), width - 2)}`
    const names = [...new Set(r.slots)].map((slot) => slotLabel(slot).name)
    const first = r.slots[0]
    const to = (line: string) => (first === undefined ? line : spot({ kind: 'slot', slot: first }, line))
    return names.length > 0 ? [to(row), to(`    ${p.dim(fit(names.join(' · '), width - 2))}`)] : [to(row)]
  })
  return [
    failing === 0 ? head : spread(head, `${p.bold('n')} ${p.dim('next miss')}`, wide - 2),
    ...lines.slice(0, Math.max(0, room - 1)),
  ]
}

export function used(slot: number, role: string): boolean {
  const ansi = slot - BASE.length
  if (ansi >= 0) {
    return role === String(ansi) || role === `B${ansi}` || role === `K${ansi}`
  }
  return (slot === 3 && role === 's') || (slot === 2 && role === 'c')
}

export function roleSgr(p: Paint, c: Colors, role: string, mark: boolean): string {
  const under = mark ? open('under') : ''
  if (role === 'd') {
    return `${p.fg(c.foreground)}${open('dim')}${under}`
  }
  if (role === 'b') {
    return `${p.fg(c.foreground)}${open('bold')}${under}`
  }
  if (role === 's') {
    return `${p.bg(c.selection)}${p.fg(c.foreground)}${under}`
  }
  if (role === 'c') {
    return `${p.bg(c.cursor)}${under}`
  }
  const m = /^([BK]?)(\d+)$/.exec(role)
  if (!m) {
    return `${p.fg(c.foreground)}${under}`
  }
  const color = c.ansi[Number(m[2])] as Hex
  if (m[1] === 'K') {
    return `${p.fg(c.ansi[0] as Hex)}${p.bg(color)}${under}`
  }
  return `${p.fg(color)}${m[1] === 'B' ? open('bold') : ''}${under}`
}

export function gradient(p: Paint, samples: (Hex | undefined)[], at: number, lit: boolean, held?: number): string {
  const last = samples.length - 1
  const i = Math.max(0, Math.min(last, at))
  const o = held === undefined ? -1 : Math.max(0, Math.min(last, held))
  if (!p.color) {
    return samples.map((_, k) => (k === i ? '●' : k === o ? '○' : lit ? '━' : '─')).join('')
  }
  return samples
    .map((hex, k) => {
      const shown = hex ?? '#000000'
      if (k === i) {
        return `${p.bg(shown)}${p.fg(ink(shown))}${MARKS.on}${INK_RESET}`
      }
      if (k === o) {
        return hex ? `${p.bg(hex)}${p.fg(ink(hex))}${MARKS.off}${INK_RESET}` : `${p.fg('#aaaaaa')}${MARKS.off}`
      }
      return hex ? `${p.fg(hex)}█` : `${p.fg(lit ? '#777777' : '#555555')}░`
    })
    .join('')
    .concat(FG_RESET)
}

export function channelSamples(want: Oklch, channel: Channel, width: number): (Hex | undefined)[] {
  return Array.from({ length: width }, (_, k) => {
    const value = channel.min + ((channel.max - channel.min) * k) / (width - 1)
    const next = { ...want, [channel.key]: value }
    return srgb(next.l, next.c, next.h) ? inGamut(next.l, next.c, next.h) : undefined
  })
}

export function position(value: number, min: number, max: number, width: number): number {
  return Math.round(((value - min) / (max - min)) * (width - 1))
}

export function gateMisses(e: PaletteEditor): number {
  return gateRows(e.list, e.signature, e.waive).filter((row) => row.ok === false).length
}

export function gateBox(p: Paint, e: PaletteEditor, room: number, width: number): string[] {
  if (room < 3) {
    return []
  }
  const failing = gateMisses(e)
  const title = failing === 0 ? ' Gate ✓ passes ' : ` Gate ✗ ${failing} · n next `
  return [
    p.dim(boxEdge(width, 'top', [[2, title]])),
    ...gateLines(p, e, room - 1, width - 1)
      .slice(1)
      .map((line) => boxed(p, line, width)),
    p.dim(boxEdge(width, 'bottom')),
  ]
}
