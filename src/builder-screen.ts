import { cells, fit, spread, wrapText } from './ansi.ts'
import {
  joints,
  type Layout,
  layoutOf,
  lights,
  paneLines,
  type Tile,
  tabNames,
  usesOf,
  usesSlot,
  validSpot,
} from './builder-layout.ts'
import type { Hex } from './color.ts'
import type { Area } from './editor-backdrop.ts'
import {
  channelSamples,
  contrastLine,
  detailChecks,
  type EditorSpot,
  fixHint,
  gateBox,
  gateMisses,
  gradient,
  ink,
  lchShort,
  position,
  roleSgr,
  spot,
} from './editor-paint.ts'
import { srgb } from './fix.ts'
import {
  BASE,
  CHANNELS,
  CONTRAST,
  colorsOf,
  type Format,
  PAIRS,
  type PaletteEditor,
  SLOT_NAMES,
  slotLabel,
  slotUse,
} from './palette-editor.ts'
import { type Art, PLANE_BOTTOM, PLANE_TOP, reach, shareOf } from './picker-art.ts'
import type { Colors } from './seeds.ts'
import { boxEdge, boxed, pillOf } from './tui/parts.ts'
import { BG_RESET, FG_RESET, INK_RESET, MARKS, open, type Paint, painter, RESET, surfaceOf } from './tui/style.ts'
import { cover, keyZone, zone } from './tui/zones.ts'

const POPOVER = 34
const PICKER_COL = 2
const PLANE_MOST = 6
const PLANE_LEAST = 3
const ART_MOST = 7
const HINTS = '↑↓ L  ←→ C  ⇧←→ H  tab ◐'

interface Part {
  row: number
  col: number
  cols: number
  rows: number
}

interface Popup {
  lines: string[]
  parts?: { plane: Part; hue: Part; contrast: Part; tabs: Part; field: Part; divider: number | undefined }
}

interface Piece {
  text: string
  sgr: string
  target?: EditorSpot
}

type Cellrow = Piece[]

function sliceText(text: string, from: number, to: number): string {
  let out = ''
  let at = 0
  for (const ch of text) {
    const end = at + cells(ch)
    if (end > from && at < to) {
      out += at >= from && end <= to ? ch : ' '.repeat(Math.min(end, to) - Math.max(at, from))
    }
    at = end
    if (at >= to) {
      break
    }
  }
  return out
}

function widthOf(row: Cellrow): number {
  return row.reduce((n, piece) => n + cells(piece.text), 0)
}

function crop(row: Cellrow, from: number, to: number): Cellrow {
  const out: Cellrow = []
  let at = 0
  for (const piece of row) {
    const w = cells(piece.text)
    const a = Math.max(from, at)
    const b = Math.min(to, at + w)
    if (b > a) {
      out.push({ ...piece, text: sliceText(piece.text, a - at, b - at) })
    }
    at += w
  }
  return out
}

function overlay(row: Cellrow, col: number, over: Cellrow): Cellrow {
  return [...crop(row, 0, col), ...over, ...crop(row, col + widthOf(over), widthOf(row))]
}

function drawn(row: Cellrow, color: boolean): string {
  return row
    .map((piece) => {
      const body = color && piece.sgr ? `${piece.sgr}${piece.text}${RESET}` : piece.text
      return piece.target ? zone(piece.target, body) : body
    })
    .join('')
}

function slotShort(slot: number): string {
  return slot < BASE.length ? (BASE[slot] as string) : (PAIRS[(slot - BASE.length) % 8] as string)
}

function swatch(e: PaletteEditor, p: Paint, slot: number, restore: string): string {
  const glyph = e.signature.includes(SLOT_NAMES[slot] as string) ? MARKS.signature : p.color ? MARKS.swatch : ' '
  return p.color ? `${p.fg(e.list[slot] as Hex)}${glyph}${restore}` : glyph
}

function markOf(e: PaletteEditor, p: Paint, slot: number, missed: Set<number>, restore: string): string {
  return missed.has(slot)
    ? p.bold(MARKS.miss)
    : e.changed(slot)
      ? p.color
        ? `${open('warn')}${MARKS.on}${restore}`
        : MARKS.on
      : ' '
}

function gutterOf(p: Paint, c: Colors, here: boolean): string {
  return here ? (p.color ? `${p.fg(c.cursor)}${MARKS.gutter}${FG_RESET} ` : `${MARKS.gutter} `) : '  '
}

function baseRow(e: PaletteEditor, p: Paint, c: Colors, slot: number, inner: number, missed: Set<number>): string {
  const here = slot === e.slot()
  const restore = here ? p.fg(c.foreground) : FG_RESET
  const name = slotShort(slot).padEnd(12)
  const at = e.lch[slot] as { l: number; c: number; h: number }
  const body = `${gutterOf(p, c, here)}${swatch(e, p, slot, restore)} ${here ? p.bold(name) : name}${lchShort(at)} ${markOf(e, p, slot, missed, restore)}`
  const line = fit(body, inner)
  return spot(
    { kind: 'open', slot },
    here && p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}${line}${INK_RESET}` : line,
  )
}

const NAME = 8
const FULL_SIDE = 44

function cellWidth(side: number): number {
  return side >= FULL_SIDE ? 16 : 11
}

function cellText(e: PaletteEditor, p: Paint, c: Colors, slot: number, side: number, missed: Set<number>): string {
  const width = cellWidth(side)
  if (!e.visible(slot)) {
    return ' '.repeat(width)
  }
  const here = slot === e.slot()
  const restore = here && p.color ? p.fg(c.foreground) : FG_RESET
  const at = e.lch[slot] as { l: number; c: number; h: number }
  const short = (n: number, digits: number) => n.toFixed(digits).replace(/^0(?=\.)/, '')
  const hue = `${at.h.toFixed(0).padStart(3)}°`
  const value = side >= FULL_SIDE ? `${short(at.l, 2)} ${short(at.c, 3)} ${hue}` : `${short(at.l, 2)} ${hue}`
  const text = `${swatch(e, p, slot, restore)} ${value}${markOf(e, p, slot, missed, restore)}`
  const shown = here && p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}${text}${INK_RESET}` : text
  return spot({ kind: 'open', slot }, shown)
}

function pairRow(e: PaletteEditor, p: Paint, c: Colors, row: number, side: number, missed: Set<number>): string {
  const normal = BASE.length + row
  const bright = normal + 8
  const here = e.row === normal
  const name = (PAIRS[row] as string).padEnd(NAME)
  const link = e.linkOf(bright) !== undefined ? p.dim('⇠') : ' '
  const first = spot({ kind: 'open', slot: normal }, `${gutterOf(p, c, here)}${here ? p.bold(name) : name}`)
  return `${first}${cellText(e, p, c, normal, side, missed)}${link} ${cellText(e, p, c, bright, side, missed)}`
}

function boxWidth(side: number): number {
  return 14 + 2 * cellWidth(side)
}

function ansiLabels(side: number): [number, string][] {
  const roomy = cellWidth(side) >= 16
  return [
    [2, ' ANSI '],
    [2 + NAME, roomy ? ' Normal 0–7 ' : ' Normal '],
    [5 + NAME + cellWidth(side), roomy ? ' Bright 8–15 ' : ' Bright '],
  ]
}

function aboutBox(e: PaletteEditor, p: Paint, layout: Layout, side: number): string[] {
  const slot = e.slot()
  const label = slotLabel(slot)
  const width = boxWidth(side)
  const inner = width - 2
  const title = ` ${label.name}${slot >= BASE.length ? ` · ${label.about}` : ''} `
  const lines = [` ${p.dim(slotUse(slot))}`]
  if (slot >= 2) {
    const uses = usesOf(layout, slot).filter((use) => use.count > 0)
    const here = uses.length > 0 ? uses.map((use) => `${use.name} ${use.count}`).join(' · ') : 'none'
    const toggle = keyZone('w', e.where ? pillOf(p, 'w where') : p.dim('w where'))
    lines.push(spread(` ${p.dim('Shown in')} ${here}`, `${toggle} `, inner))
  }
  const ansi = slot - BASE.length
  if (ansi === 0 || ansi === 7 || ansi === 8 || ansi === 15) {
    const at = (e.lch[slot] as { l: number }).l
    const ground = (e.lch[0] as { l: number }).l
    const ink = (e.lch[1] as { l: number }).l
    const near = Math.abs(at - ground) <= Math.abs(at - ink) ? 'the background' : 'the text'
    lines.push(` ${p.dim(`L ${at.toFixed(2)} reads near ${near}`)}`)
  }
  return [
    p.dim(boxEdge(width, 'top', [[2, title]])),
    ...lines.map((line) => boxed(p, line, width)),
    p.dim(boxEdge(width, 'bottom')),
  ]
}

function lightnessAt(sample: number, rows: number): number {
  return PLANE_TOP - (sample * (PLANE_TOP - PLANE_BOTTOM)) / (rows * 2 - 1)
}

export function planeAt(
  y: number,
  rows: number,
  x: number,
  width: number,
  hue: number,
): { lightness: number; chroma: number } {
  const lightness = lightnessAt(Math.max(0, Math.min(rows * 2 - 1, y * 2 - 0.5)), rows)
  const share = Math.max(0, Math.min(1, (x - 0.5) / Math.max(1, width - 1)))
  return { lightness, chroma: share * reach(lightness, hue) }
}

function planeLines(
  p: Paint,
  at: { l: number; c: number; h: number },
  hex: Hex,
  width: number,
  rows: number,
  origin: { l: number; c: number; h: number } | undefined,
): string[] {
  const cellOf = (one: { l: number; c: number; h: number }) => {
    const sample = Math.max(
      0,
      Math.min(rows * 2 - 1, Math.round(((PLANE_TOP - one.l) / (PLANE_TOP - PLANE_BOTTOM)) * (rows * 2 - 1))),
    )
    return { row: Math.floor(sample / 2), col: Math.round(shareOf(one.l, one.c, one.h) * (width - 1)) }
  }
  const { row: markRow, col: markCol } = cellOf(at)
  const was = origin ? cellOf(origin) : { row: -1, col: -1 }
  const color = (l: number, share: number) => {
    const one = srgb(l, share * reach(l, at.h), at.h) ?? [0, 0, 0]
    return `#${one.map((v) => v.toString(16).padStart(2, '0')).join('')}` as Hex
  }
  return Array.from({ length: rows }, (_, r) => {
    let line = ''
    for (let k = 0; k < width; k++) {
      if (r === markRow && k === markCol) {
        line += p.color ? `${p.bg(hex)}${p.fg(ink(hex))}${MARKS.on}${INK_RESET}` : MARKS.on
        continue
      }
      const share = k / Math.max(1, width - 1)
      if (r === was.row && k === was.col) {
        const under = color(lightnessAt(r * 2 + 1, rows), share)
        line += p.color ? `${p.bg(under)}${p.fg(ink(under))}${MARKS.off}${INK_RESET}` : MARKS.off
        continue
      }
      line += p.color
        ? `${p.fg(color(lightnessAt(r * 2, rows), share))}${p.bg(color(lightnessAt(r * 2 + 1, rows), share))}▀${INK_RESET}`
        : '·'
    }
    return spot({ kind: 'plane', row: r, rows }, line)
  })
}

function formatText(e: PaletteEditor, hex: Hex, at: { l: number; c: number; h: number }): string {
  if (e.format === 'rgb') {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
    return `rgb(${r} ${g} ${b})`
  }
  if (e.format === 'oklch') {
    return `oklch(${at.l.toFixed(3)} ${at.c.toFixed(3)} ${at.h.toFixed(0)})`
  }
  return hex
}

function notes(e: PaletteEditor, p: Paint, width: number): string[] {
  const slot = e.slot()
  const at = e.lch[slot] as { l: number; c: number; h: number }
  const checks = detailChecks(e, slot, at).filter((check) => check.ok === false || check.text.startsWith('Chroma ○'))
  const said = checks.flatMap((check) =>
    wrapText(check.text, width - 2).map(
      (line, i) => `${i === 0 ? (check.ok === false ? p.bold(MARKS.miss) : p.dim(MARKS.off)) : ' '} ${line}`,
    ),
  )
  const hint = fixHint(e, slot)
  return [...said.slice(0, 3), ...(hint ? [p.dim(hint)] : [])]
}

function linkLine(e: PaletteEditor, p: Paint, width: number): string | undefined {
  const pair = e.pair(e.slot())
  if (!pair) {
    return undefined
  }
  const bright = e.slot() >= pair.bright
  const other = slotShort(bright ? pair.normal : pair.bright).toLowerCase()
  const lift = `${pair.lift >= 0 ? '+' : ''}${pair.lift.toFixed(2)}`
  const room = width - 9
  const choices = bright
    ? pair.on
      ? [`⇠ Linked to ${other} · L ${lift}`, `⇠ ${other} · L ${lift}`, `⇠ ${other}`]
      : [`Not linked to ${other}`, `Not linked`]
    : pair.on
      ? [`Bright follows · L ${lift}`, `Bright follows`]
      : ['Its bright moves on its own', 'Moves on its own']
  const text = choices.find((choice) => cells(choice) <= room) ?? choices[choices.length - 1] ?? ''
  return spread(p.dim(text), keyZone('l', `${p.bold('l')} ${p.dim(pair.on ? 'unlink' : 'link')}`), width)
}

function valueLine(e: PaletteEditor, p: Paint, width: number): string {
  const slot = e.slot()
  const hex = e.list[slot] as Hex
  const at = e.lch[slot] as { l: number; c: number; h: number }
  const typed = e.typing !== undefined ? p.bold(`${e.typing}▏`) : keyZone('#', p.bold(formatText(e, hex, at)))
  const was = e.start[slot] as Hex
  const swatch = p.color ? `${p.fg(was)}${MARKS.swatch}${FG_RESET} ` : ''
  return spread(typed, was !== hex ? p.dim(`was ${swatch}${was}`) : '', width)
}

function pickerLines(e: PaletteEditor, p: Paint, outer: number, room: number): Popup {
  const slot = e.slot()
  const at = e.lch[slot] as { l: number; c: number; h: number }
  const hex = e.list[slot] as Hex
  const width = outer - 4
  const edge = p.dim('│')
  const boxed = (content: string) => `${edge} ${fit(content, width)} ${edge}`
  const link = linkLine(e, p, width)
  const fixed = 6 + (link ? 1 : 0)
  const extra = notes(e, p, width).slice(0, Math.max(0, room - fixed - PLANE_LEAST))
  const rows = Math.max(PLANE_LEAST, Math.min(PLANE_MOST, room - fixed - extra.length))
  const left = ' L × C '
  const right = ` H ${at.h.toFixed(0)}° `
  const dashes = Math.max(0, outer - 4 - cells(left) - cells(right))
  const lines = [`${p.dim('╭─')}${p.dim(left)}${p.dim('─'.repeat(dashes))}${p.dim(right)}${p.dim('─╮')}`]
  const origin = e.origin()
  for (const line of planeLines(p, at, hex, width, rows, origin?.lch)) {
    lines.push(boxed(line))
  }
  const hue = CHANNELS[2] as (typeof CHANNELS)[number]
  lines.push(
    boxed(
      spot(
        { kind: 'bar', channel: 2 },
        gradient(
          p,
          channelSamples(at, hue, width),
          position(at.h, hue.min, hue.max, width),
          e.mode === 'tune' && e.channel === 2,
          origin && position(origin.lch.h, hue.min, hue.max, width),
        ),
      ),
    ),
  )
  lines.push(boxed(contrastLine(p, e, Math.max(8, width - 11), origin?.ratio)))
  const tab = (label: string, format: Format) =>
    spot({ kind: 'format', format }, e.format === format ? pillOf(p, label) : p.dim(` ${label} `))
  lines.push(boxed(`${tab('Hex', 'hex')} ${tab('RGB', 'rgb')} ${tab('OKLCH', 'oklch')}`))
  lines.push(boxed(valueLine(e, p, width)))
  if (link) {
    lines.push(boxed(link))
  }
  for (const line of extra) {
    lines.push(boxed(line))
  }
  const bottom = fit(` ${HINTS} `, outer - 4, false)
  lines.push(`${p.dim('╰─')}${p.dim(bottom)}${p.dim('─'.repeat(Math.max(0, outer - 4 - cells(bottom))))}${p.dim('─╯')}`)
  return { lines: lines.map((line) => spot({ kind: 'picker' }, line)) }
}

const FORMATS: [string, Format][] = [
  ['Hex', 'hex'],
  ['RGB', 'rgb'],
  ['OKLCH', 'oklch'],
]

function artLines(e: PaletteEditor, p: Paint, outer: number, room: number): Popup {
  const at = e.lch[e.slot()] as { l: number; c: number; h: number }
  const width = outer - 2
  const link = linkLine(e, p, width)
  const fixed = 6 + (link ? 1 : 0)
  const extra = notes(e, p, width).slice(0, Math.max(0, room - fixed - PLANE_LEAST))
  const rows = Math.max(PLANE_LEAST, Math.min(ART_MOST, room - fixed - extra.length))
  const padded = (content: string) => ` ${fit(content, width)} `
  const lines = [padded(spread(p.dim('L × C'), p.dim(`H ${at.h.toFixed(0)}°`), width))]
  for (let row = 0; row < rows; row++) {
    lines.push(padded(spot({ kind: 'plane', row, rows }, ' '.repeat(width))))
  }
  const hue = lines.length
  lines.push(padded(spot({ kind: 'bar', channel: 2 }, ' '.repeat(width))))
  const contrast = lines.length
  const here = e.mode === 'tune' && e.channel === CONTRAST
  const grip: EditorSpot = { kind: 'channel', channel: CONTRAST }
  const ratio = `${e.ratio().toFixed(2)}:1`.padStart(8)
  const track = width - 11
  lines.push(
    padded(
      `${spot(grip, here ? p.bold('◐') : p.dim('◐'))} ${spot({ kind: 'bar', channel: CONTRAST }, ' '.repeat(track))} ${spot(grip, here ? p.bold(ratio) : p.dim(ratio))}`,
    ),
  )
  const tabs = lines.length
  const segment = Math.floor(width / FORMATS.length)
  lines.push(
    padded(
      FORMATS.map(([label, format], i) => {
        const room = i === FORMATS.length - 1 ? width - segment * i : segment
        const before = Math.floor((room - cells(label)) / 2)
        const text = `${' '.repeat(before)}${label}${' '.repeat(room - before - cells(label))}`
        const shown = e.format === format ? (p.color ? p.accent(p.bold(text)) : `[${label}]`.padEnd(room)) : p.dim(text)
        return spot({ kind: 'format', format }, shown)
      }).join(''),
    ),
  )
  const field = lines.length
  lines.push(padded(` ${valueLine(e, p, width - 2)} `))
  const divider = link ? lines.length : undefined
  if (link) {
    lines.push(padded(link))
  }
  for (const line of extra) {
    lines.push(padded(line))
  }
  lines.push(padded(p.dim(HINTS)))
  return {
    lines: lines.map((line) => spot({ kind: 'picker' }, line)),
    parts: {
      plane: { row: 1, col: 1, cols: width, rows },
      hue: { row: hue, col: 1, cols: width, rows: 1 },
      contrast: { row: contrast, col: 3, cols: track, rows: 1 },
      tabs: { row: tabs, col: 1, cols: width, rows: 1 },
      field: { row: field, col: 1, cols: width, rows: 1 },
      divider,
    },
  }
}

function artOf(
  e: PaletteEditor,
  shown: Colors,
  popup: Required<Popup>['parts'],
  row: number,
  col: number,
  height: number,
): Art {
  const slot = e.slot()
  const at = e.lch[slot] as { l: number; c: number; h: number }
  const hex = e.list[slot] as Hex
  const box = (part: Part) => ({ row: row + part.row, col: col + part.col, cols: part.cols, rows: part.rows })
  const along = (ratio: number) => Math.log(Math.max(1, ratio)) / Math.log(21)
  const floor = e.partner().floor
  const origin = e.origin()
  return {
    panel: { row, col, cols: popup.plane.cols + 2, rows: height },
    ground: shown.background,
    ink: shown.foreground,
    accent: shown.cursor,
    plane: { ...box(popup.plane), h: at.h, l: at.l, c: at.c },
    hue: { ...box(popup.hue), h: at.h, color: hex },
    contrast: {
      ...box(popup.contrast),
      at: along(e.ratio()),
      floor: floor === undefined ? undefined : along(floor),
      color: hex,
      lit: e.channel === CONTRAST,
    },
    tabs: { ...box(popup.tabs), active: FORMATS.findIndex(([, format]) => format === e.format), count: FORMATS.length },
    field: box(popup.field),
    divider: popup.divider === undefined ? undefined : row + popup.divider,
    origin: origin && { ...origin.lch, color: origin.hex, at: along(origin.ratio) },
  }
}

function picker(
  e: PaletteEditor,
  p: Paint,
  c: Colors,
  side: number,
  lines: string[],
  anchor: number | undefined,
  height: number,
  drawn: boolean,
): { lines: string[]; art: Art | undefined } {
  const top = 2
  const at = anchor ?? top - 1
  const below = height - 1 - at
  const above = at - top
  const outer = 12 + 2 * cellWidth(side) - PICKER_COL
  const make = drawn ? artLines : pickerLines
  const natural = make(e, p, outer, Number.POSITIVE_INFINITY)
  const down = natural.lines.length <= below || (natural.lines.length > above && below >= above)
  const room = down ? below : above
  const pop = natural.lines.length <= room ? natural : make(e, p, outer, room)
  const first = down ? at + 1 : at - pop.lines.length
  const out = Array.from({ length: height }, (_, i) => lines[i] ?? '')
  pop.lines.forEach((line, i) => {
    const row = first + i
    if (row >= 0 && row < height) {
      out[row] = cover(out[row] as string, PICKER_COL, line)
    }
  })
  return { lines: out, art: pop.parts && artOf(e, c, pop.parts, first, PICKER_COL, pop.lines.length) }
}

function sidebar(
  e: PaletteEditor,
  p: Paint,
  c: Colors,
  layout: Layout,
  height: number,
): { lines: string[]; anchor: number | undefined } {
  const side = layout.side
  const failing = gateMisses(e)
  const dot = e.changedOnly ? p.warn(MARKS.on) : ' '
  const gate = failing === 0 ? p.dim('Gate ✓') : p.bold(`Gate ✗ ${failing}`)
  const tabs = spread(
    ` ${p.bold('Colors')}  ${gate}`,
    keyZone('m', `${e.changedOnly ? p.bold('⧩ changed') : p.dim('⧩ changed')}${dot} `),
    side,
  )
  const body = height - 1
  const missed = e.misses()
  const width = boxWidth(side)
  const rows: string[] = []
  let anchor: number | undefined
  const bases = BASE.map((_, slot) => slot).filter((slot) => e.visible(slot))
  if (bases.length > 0) {
    rows.push(p.dim(boxEdge(width, 'top', [[2, ' Base ']])))
    for (const slot of bases) {
      if (slot === e.slot()) {
        anchor = rows.length
      }
      rows.push(boxed(p, baseRow(e, p, c, slot, width - 2, missed), width))
    }
  }
  const pairs = PAIRS.map((_, row) => row).filter(
    (row) => e.visible(BASE.length + row) || e.visible(BASE.length + row + 8),
  )
  if (pairs.length > 0) {
    rows.push(p.dim(boxEdge(width, bases.length > 0 ? 'mid' : 'top', ansiLabels(side))))
    for (const row of pairs) {
      if (e.row === BASE.length + row) {
        anchor = rows.length
      }
      rows.push(boxed(p, pairRow(e, p, c, row, side, missed), width))
    }
  }
  if (bases.length > 0 || pairs.length > 0) {
    rows.push(p.dim(boxEdge(width, 'bottom')))
  }
  if (e.visible(e.slot())) {
    rows.push(...aboutBox(e, p, layout, side))
  }
  const rules = gateBox(p, e, body - rows.length, width)
  rows.push(...Array.from({ length: Math.max(0, body - rows.length - rules.length) }, () => ''), ...rules)
  return { lines: [tabs, ...rows.slice(0, body)], anchor: anchor === undefined ? undefined : anchor + 1 }
}

function topBar(e: PaletteEditor, p: Paint, width: number): string {
  const title = `${p.accent(MARKS.current)} ${p.bold(e.options.title)} ${p.dim(`· ${e.options.name}`)}`
  const dirty = e.dirty()
  const changes = e.changes()
  const dot = p.warn(MARKS.on)
  const state = dirty ? `${dot} ${p.dim(changes > 0 ? `unsaved · ${changes} changed` : 'unsaved')}` : ''
  const buttons = dirty ? `${keyZone('R', p.dim('Reset'))}  ${keyZone('s', pillOf(p, 'Save'))}` : ''
  const left = [title, state, buttons].filter(Boolean).join('   ')
  const button = (word: string, label: string, on: boolean) => keyZone(word, on ? pillOf(p, label) : p.dim(label))
  const pictures = e.options.find || e.pictures > 0
  const right = [
    ...(pictures
      ? [
          button(
            'b',
            `▣ ${e.pictures > 0 ? `${e.pictures} ` : ''}Picture`,
            e.pic && (e.pictures > 0 || !!e.options.find),
          ),
        ]
      : []),
    button('i', '⌖ Inspect', e.inspect),
    `${button('u', '↶', false)} ${button('ctrl+r', '↷', false)}`,
    button('I', 'Import ▾', e.menu === 'import'),
    ...(e.options.exports ? [button('x', 'Export ▾', e.menu === 'export')] : []),
  ].join('  ')
  return spread(left, `${right} `, width)
}

const GROUND: EditorSpot = { kind: 'open', slot: 0 }

function groundOf(p: Paint, c: Colors, behind: boolean): string {
  return p.color ? `${behind ? BG_RESET : p.bg(c.background)}${p.fg(c.foreground)}` : ''
}

function contentRows(
  e: PaletteEditor,
  p: Paint,
  c: Colors,
  tile: Tile,
  pinned: ReturnType<typeof validSpot>,
  behind: boolean,
): Cellrow[] {
  const lines = paneLines(tile)
  const base = groundOf(p, c, behind)
  const slot = e.slot()
  return Array.from({ length: tile.rows }, (_, i) => {
    const line = lines[i]
    const row: Cellrow = [{ text: ' ', sgr: base }]
    if (line) {
      line.forEach((part, r) => {
        const here = pinned && pinned.pane === tile.id && pinned.line === i && pinned.run === r
        const sgr = p.color
          ? here
            ? `${base}${p.bg(c.foreground)}${p.fg(c.background)}`
            : `${base}${roleSgr(p, c, part.role, usesSlot(part.role, slot))}${e.where && !lights(part.role, slot) ? open('dim') : ''}`
          : ''
        row.push({ text: part.text, sgr, target: { kind: 'run', spot: { pane: tile.id, line: i, run: r } } })
      })
    }
    const inner = crop(row, 0, tile.width - 1)
    const pad = tile.width - widthOf(inner)
    return pad > 0 ? [...inner, { text: ' '.repeat(pad), sgr: base, target: GROUND }] : inner
  })
}

function popoverRows(e: PaletteEditor, p: Paint, c: Colors): Cellrow[] | undefined {
  const here = e.slotsHere()
  if (!here) {
    return undefined
  }
  const base = p.color ? `${p.bg(c.background)}${p.fg(c.foreground)}` : ''
  const dim = p.color ? `${base}${open('dim')}` : ''
  const edge = (text: string): Piece => ({ text, sgr: dim })
  const top = '┌ Slots here '
  const foot = '└ enter its slot · esc '
  const rows: Cellrow[] = [[edge(`${top}${'─'.repeat(POPOVER - cells(top) - 1)}┐`)]]
  const slots: [string, number][] = [['text', here.text]]
  if (here.ground !== here.text) {
    slots.push(['ground', here.ground])
  }
  for (const [label, slot] of slots) {
    const target: EditorSpot = { kind: 'open', slot }
    const hex = e.shown()[slot] as Hex
    const about = slot < BASE.length ? '' : slotLabel(slot).about
    rows.push([
      { text: '│ ', sgr: dim, target },
      { text: label.padEnd(7), sgr: dim, target },
      { text: MARKS.swatch, sgr: p.color ? `${base}${p.fg(hex)}` : '', target },
      { text: ' ', sgr: base, target },
      { text: slotLabel(slot).name.slice(0, 14).padEnd(14), sgr: base, target },
      { text: about.padEnd(POPOVER - 27), sgr: dim, target },
      { text: ' │', sgr: dim, target },
    ])
  }
  rows.push([edge(`${foot}${'─'.repeat(POPOVER - cells(foot) - 1)}┘`)])
  return rows.map((row) => crop(row, 0, POPOVER))
}

function menuRows(e: PaletteEditor, p: Paint, c: Colors): Cellrow[] | undefined {
  if (!e.menu) {
    return undefined
  }
  const items =
    e.menu === 'export' ? ['Share code', 'Add command', 'Palette file'] : ['Another palette', 'A share code']
  const width = 24
  const base = p.color ? `${p.bg(c.background)}${p.fg(c.foreground)}` : ''
  const dim = p.color ? `${base}${open('dim')}` : ''
  const title = e.menu === 'export' ? 'Copy ' : 'Take from '
  const rows: Cellrow[] = [[{ text: `┌ ${title}${'─'.repeat(Math.max(0, width - 3 - title.length))}┐`, sgr: dim }]]
  items.forEach((item, index) => {
    const here = index === e.entry
    const target: EditorSpot = { kind: 'entry', index }
    rows.push([
      { text: '│', sgr: dim },
      {
        text: ` ${here ? '▌' : ' '} ${item.padEnd(width - 6)}`,
        sgr: here && p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}${open('bold')}` : base,
        target,
      },
      { text: '│', sgr: dim },
    ])
  })
  rows.push([{ text: `└${'─'.repeat(width - 2)}┘`, sgr: dim }])
  return rows
}

const LIGHTS: Hex[] = ['#ff5f57', '#febc2e', '#28c840']

function titleBar(e: PaletteEditor, p: Paint, ui: Colors, width: number): Cellrow {
  const bar = p.color ? `${p.bg(barOf(ui))}${p.fg(ui.foreground)}` : ''
  const row: Cellrow = [{ text: ' ', sgr: bar }]
  for (const hex of LIGHTS) {
    row.push({ text: '●', sgr: p.color ? `${bar}${p.fg(hex)}` : '' }, { text: ' ', sgr: bar })
  }
  row.push({ text: '  ', sgr: bar })
  const names = tabNames()
  const at = ((e.scene % names.length) + names.length) % names.length
  names.forEach((name, i) => {
    const target: EditorSpot = { kind: 'scene', scene: i }
    row.push(
      i === at
        ? {
            text: ` ${name} `,
            sgr: p.color ? `${bar}${p.bg(surfaceOf(ui.background, ui.foreground, 'tab'))}${open('bold')}` : '',
            target,
          }
        : { text: ` ${name} `, sgr: p.color ? `${bar}${open('dim')}` : '', target },
      { text: ' ', sgr: bar },
    )
  })
  const hint = '⇧←→ '
  return [
    ...row,
    { text: ' '.repeat(Math.max(0, width - widthOf(row) - cells(hint))), sgr: bar },
    { text: hint, sgr: p.color ? `${bar}${open('dim')}` : '' },
  ]
}

function barOf(ui: Colors): Hex {
  return surfaceOf(ui.background, ui.foreground, 'bar')
}

function frameRows(p: Paint, ui: Colors, layout: Layout): [number, number, Cellrow][] {
  const { frame } = layout
  const line = surfaceOf(ui.background, ui.foreground, 'line')
  const edge = p.color ? `${p.bg(stageOf(ui))}${p.fg(line)}` : ''
  const under = p.color ? `${p.bg(barOf(ui))}${p.fg(line)}` : ''
  const ring = (row: number, col: number) =>
    row === frame.row || row === frame.row + frame.rows - 1 || col === frame.col || col === frame.col + frame.cols - 1
  const out: [number, number, Cellrow][] = []
  for (const [row, cols] of joints(layout.rules)) {
    for (const [col, text] of cols) {
      out.push([row, col, [{ text, sgr: ring(row, col) ? edge : under }]])
    }
  }
  return out
}

function stageOf(ui: Colors): Hex {
  return surfaceOf(ui.background, ui.foreground, 'stage')
}

export function pictureArea(cols: number, rows: number): Area | undefined {
  return layoutOf(cols, rows, 0)?.inner
}

export interface Look {
  behind?: boolean
  art?: boolean
  chrome?: readonly Hex[]
}

export function renderBuilder(
  e: PaletteEditor,
  cols: number,
  rows: number,
  color: boolean,
  look: Look = {},
): { lines: string[]; art: Art | undefined } | undefined {
  const layout = layoutOf(cols, rows, e.scene)
  if (!layout) {
    return undefined
  }
  const p = painter(color)
  const shown = e.shown()
  const c = colorsOf(shown)
  const ui = colorsOf(look.chrome ? [...look.chrome] : e.list)
  const bar = sidebar(e, p, ui, layout, rows - 1)
  const popped =
    e.mode === 'tune'
      ? picker(e, p, ui, layout.side, bar.lines, bar.anchor, rows - 1, color && look.art === true)
      : { lines: bar.lines, art: undefined }
  const side = popped.lines
  const behind = look.behind === true
  const pinned = e.inspect ? validSpot(layout, e.spot) : undefined
  const stage = p.color ? p.bg(stageOf(ui)) : ''
  const grid: Cellrow[] = Array.from({ length: rows - 3 }, () => [{ text: ' '.repeat(layout.width), sgr: stage }])
  const put = (row: number, col: number, cellrow: Cellrow) => {
    const at = row - 2
    if (at >= 0 && at < grid.length) {
      grid[at] = overlay(grid[at] as Cellrow, col, cellrow)
    }
  }
  const origin = layout.side + 1
  for (const [row, col, cellrow] of frameRows(p, ui, layout)) {
    put(row, col - origin, cellrow)
  }
  for (const tile of layout.tiles) {
    contentRows(e, p, c, tile, pinned, behind).forEach((row, i) => {
      put(tile.row + i, tile.col - origin, row)
    })
  }
  put(layout.title.row, layout.title.col - origin, titleBar(e, p, ui, layout.title.cols))
  const pop = pinned ? popoverRows(e, p, c) : undefined
  if (pinned && pop) {
    const tile = layout.tiles.find((t) => t.id === pinned.pane) as Tile
    const part = paneLines(tile)[pinned.line]?.[pinned.run]
    if (part) {
      const col = Math.max(0, Math.min(tile.col - origin + 1 + part.col, layout.width - POPOVER))
      const line = tile.row + pinned.line
      const below = line + 1
      const top = below + pop.length - 2 > rows - 2 ? line - pop.length : below
      pop.forEach((row, i) => {
        put(top + i, col, row)
      })
    }
  }
  const menu = menuRows(e, p, c)
  if (menu) {
    const col = Math.max(0, layout.width - 24 - (e.menu === 'import' ? 12 : 2))
    menu.forEach((row, i) => {
      put(2 + i, col, row)
    })
  }
  const top = topBar(e, p, layout.width)
  const rule = p.dim('─'.repeat(layout.width))
  const divider = p.dim('│')
  const lines: string[] = []
  for (let r = 0; r < rows - 1; r++) {
    const right = r === 0 ? top : r === 1 ? rule : drawn(grid[r - 2] ?? [], color)
    lines.push(`${fit(side[r] ?? '', layout.side)}${divider}${right}`)
  }
  return { lines, art: popped.art }
}
