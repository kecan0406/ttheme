import type { Spot } from '../core/builder-layout.ts'
import { type Hex, luminance, type Oklch } from '../core/color.ts'
import { inGamut, srgb } from '../core/fix.ts'
import type { Colors } from '../core/seeds.ts'
import { BASE, type Check, type Format, ruleSlots, slotChecks, slotLabel } from '../core/slots.ts'
import { cells } from '../core/text.ts'
import { fit, spread } from './ansi.ts'
import { type Channel, CONTRAST, gateRows, type PaletteEditor, type Scope } from './palette-editor.ts'
import { boxEdge, boxed, boxTitle, buttonOf, checkOf, hintOf, moreOf } from './parts.ts'
import { FG_RESET, INK_RESET, MARKS, open, type Paint } from './style.ts'
import { type KeySpot, keyZone, zone } from './zones.ts'

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

export function baseButton(p: Paint, e: PaletteEditor, room: number, value?: string): string {
  const base = e.original[e.slot()] as Hex
  const chip = buttonOf(p, 'base', 'idle')
  const swatch = p.color ? `${p.fg(base)}${MARKS.swatch}${FG_RESET}` : ''
  const shown = [value ?? base, base, ''].map((text) => [chip, swatch, text].filter(Boolean).join(' '))

  return keyZone('r', shown.find((one) => cells(one) <= room) ?? chip)
}

export function ratioAt(ratio: number, width: number): number {
  return Math.round((Math.log(Math.max(1, ratio)) / Math.log(21)) * (width - 1))
}

export function contrastLine(p: Paint, e: PaletteEditor, barWidth: number, origin?: number): string {
  const here = e.mode === 'tune' && e.channel === CONTRAST
  const ratio = e.ratio()
  const { floor } = e.partner()
  const pos = ratioAt(ratio, barWidth)
  const tick = floor === undefined ? -1 : ratioAt(floor, barWidth)
  const was = origin === undefined ? -1 : ratioAt(origin, barWidth)
  const line = here ? '━' : '─'

  const bar = Array.from({ length: barWidth }, (_, k) =>
    k === pos ? p.bold(MARKS.on) : k === was ? MARKS.off : k === tick ? '┃' : k < tick ? p.dim(line) : line,
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

export function lchShort(at: Oklch): string {
  return `${at.l.toFixed(2)} ${at.c.toFixed(3)} ${at.h.toFixed(0).padStart(3)}°`
}

function gateLines(p: Paint, e: PaletteEditor, room: number, wide = LEFT): string[] {
  const rows = gateRows(e.list, e.signature, e.waive).sort((a, b) => Number(a.ok !== false) - Number(b.ok !== false))
  const failing = rows.filter((r) => r.ok === false).length
  const checked = (ok: boolean | undefined) => (failing === 0 && ok ? p.ok(MARKS.ok) : checkOf(p, ok))
  const width = wide - 4

  const rules = rows.map((r) => {
    const tail = `${r.value} ${r.bound}`
    const row = `  ${checked(r.ok)} ${spread(r.ok === false ? r.label : p.dim(r.label), p.dim(tail), width - 2)}`
    const names = [...new Set(r.slots)].map((slot) => slotLabel(slot).name)
    const first = r.slots[0]
    const to = (line: string) => (first === undefined ? line : spot({ kind: 'slot', slot: first }, line))

    return names.length > 0 ? [to(row), to(`    ${p.dim(fit(names.join(' · '), width - 2))}`)] : [to(row)]
  })

  const fits = (n: number) => rules.slice(0, n).flat().length + (n < rules.length ? 1 : 0) <= room
  const shown = Array.from({ length: rules.length + 1 }, (_, i) => rules.length - i).find(fits) ?? 0
  const lines = rules.slice(0, shown).flat()

  return shown < rules.length && room > 0 ? [...lines, `  ${p.dim(moreOf(1, rules.length - shown))}`] : lines
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
    return samples.map((_, k) => (k === i ? MARKS.on : k === o ? MARKS.off : lit ? '━' : '─')).join('')
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
  const title = failing === 0 ? ` Gate ${MARKS.ok} passes ` : ` Gate ${MARKS.miss} ${failing} · n next `

  return [
    boxTitle(width, title, p.dim, failing === 0 ? p.ok : p.dim),
    ...gateLines(p, e, room - 2, width - 1).map((line) => boxed(p, line, width)),
    p.dim(boxEdge(width, 'bottom')),
  ]
}

export function quitDialog(p: Paint, e: PaletteEditor, cols: number): string[] {
  const width = Math.min(46, cols - 4)
  const edits = e.unsaved()

  const parts = [
    ...(edits > 0 ? [`${edits} ${edits === 1 ? 'color' : 'colors'} changed`] : []),
    ...(e.added > 0 ? [`${e.added} ${e.added === 1 ? 'picture' : 'pictures'} added`] : []),
  ]

  const yes = keyZone('y', buttonOf(p, 'Yes', e.quitFocus === 'yes' ? 'focus' : 'idle'))
  const no = keyZone('n', buttonOf(p, 'No', e.quitFocus === 'no' ? 'focus' : 'idle', true))
  const buttons = `${yes}  ${no}`
  const hints = [hintOf(p, 'y', 'save'), hintOf(p, 'n', 'discard'), hintOf(p, 'esc', 'keep editing')].join('   ')
  const row = (content: string) => boxed(p, content, width)

  return [
    boxTitle(width, ' Save changes? ', p.dim, p.bold),
    row(''),
    row(`  ${parts.length > 0 ? parts.join(' · ') : 'Unsaved changes'}`),
    row(''),
    row(`${' '.repeat(Math.max(0, Math.floor((width - 2 - cells(buttons)) / 2)))}${buttons}`),
    row(''),
    row(`  ${hints}`),
    p.dim(boxEdge(width, 'bottom')),
  ]
}
