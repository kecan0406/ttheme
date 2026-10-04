import { cells, fit, spread, wrapText } from './ansi.ts'
import { type Layout, layoutOf, linesOf, type Tile, tabNames, usesSlot, validSpot } from './builder-layout.ts'
import type { Hex } from './color.ts'
import {
  channelSamples,
  contrastLine,
  detailChecks,
  type EditorSpot,
  fixHint,
  gateLines,
  gradient,
  ink,
  lchShort,
  type Paint,
  painter,
  position,
  roleSgr,
  spot,
} from './editor-paint.ts'
import { srgb } from './fix.ts'
import {
  BASE,
  CHANNELS,
  colorsOf,
  type Format,
  PAIRS,
  type PaletteEditor,
  SLOT_NAMES,
  slotLabel,
} from './palette-editor.ts'
import type { Colors } from './seeds.ts'
import { keyZone, zone } from './tui/zones.ts'

const PLANE_TOP = 0.98
const PLANE_BOTTOM = 0.12
const PLANE_CHROMA = 0.37
const RESET = '\x1b[0m'
const YELLOW = '\x1b[33m'
const POPOVER = 34

const GROUPS = [
  { id: 'base', label: 'Base', slots: [0, 1, 2, 3] },
  { id: 'normal', label: 'Normal', slots: [4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'bright', label: 'Bright', slots: [12, 13, 14, 15, 16, 17, 18, 19] },
]

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

function pill(p: Paint, c: Colors, text: string): string {
  return p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}${p.bold(` ${text} `)}\x1b[39;49m` : `[${text}]`
}

function slotShort(slot: number): string {
  return slot < BASE.length ? (BASE[slot] as string) : (PAIRS[(slot - BASE.length) % 8] as string)
}

function keyText(e: PaletteEditor, slot: number): string {
  const normal = e.linkOf(slot)
  if (normal !== undefined) {
    return `⇠ ${slotShort(normal)}`
  }
  return slot < BASE.length ? '' : `ansi ${slot - BASE.length}`
}

function rowText(e: PaletteEditor, p: Paint, c: Colors, slot: number, side: number): string {
  const hex = e.list[slot] as Hex
  const here = slot === e.slot()
  const bad = e.misses().has(slot)
  const glyph = e.signature.includes(SLOT_NAMES[slot] as string) ? '◆' : p.color ? '■' : ' '
  const restore = here ? p.fg(c.foreground) : '\x1b[39m'
  const sw = p.color ? `${p.fg(hex)}${glyph}${restore}` : glyph
  const gutter = here ? (p.color ? `${p.fg(c.cursor)}▌${restore} ` : '▌ ') : '  '
  const mark = bad ? p.bold('✗') : e.changed(slot) ? (p.color ? `${YELLOW}●${restore}` : '●') : ' '
  const name = slotShort(slot).padEnd(11)
  const key = side >= 42 ? p.dim(keyText(e, slot).padEnd(10)) : ''
  const body = `${gutter}${sw} ${here ? p.bold(name) : name}${key}${lchShort(e.lch[slot] as { l: number; c: number; h: number })} ${mark}`
  const line = fit(body, side)
  return spot(
    { kind: 'open', slot },
    here && p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}${line}\x1b[39;49m` : line,
  )
}

function header(e: PaletteEditor, p: Paint, group: (typeof GROUPS)[number], shown: number): string {
  const folded = e.folded.has(group.id)
  return spot(
    { kind: 'fold', group: group.id },
    `  ${p.dim(folded ? '▸' : '▾')} ${p.bold(group.label)} ${p.dim(String(shown))}`,
  )
}

function lightnessAt(sample: number, rows: number): number {
  return PLANE_TOP - (sample * (PLANE_TOP - PLANE_BOTTOM)) / (rows * 2 - 1)
}

export function planeAt(row: number, rows: number, x: number, width: number): { lightness: number; chroma: number } {
  const at = Math.max(0, Math.min(rows - 1, row))
  return {
    lightness: (lightnessAt(at * 2, rows) + lightnessAt(at * 2 + 1, rows)) / 2,
    chroma: (Math.max(0, Math.min(width - 1, x)) / Math.max(1, width - 1)) * PLANE_CHROMA,
  }
}

function planeLines(
  e: PaletteEditor,
  p: Paint,
  at: { l: number; c: number; h: number },
  hex: Hex,
  width: number,
  rows: number,
): string[] {
  const held = e.mode === 'tune' && e.held !== undefined && e.held - at.c > 0.0005 ? e.held : undefined
  const sample = Math.max(
    0,
    Math.min(rows * 2 - 1, Math.round(((PLANE_TOP - at.l) / (PLANE_TOP - PLANE_BOTTOM)) * (rows * 2 - 1))),
  )
  const markRow = Math.floor(sample / 2)
  const markCol = Math.round((Math.min(PLANE_CHROMA, at.c) / PLANE_CHROMA) * (width - 1))
  const heldCol = held === undefined ? -1 : Math.round((Math.min(PLANE_CHROMA, held) / PLANE_CHROMA) * (width - 1))
  return Array.from({ length: rows }, (_, r) => {
    let line = ''
    for (let k = 0; k < width; k++) {
      const chroma = (k / Math.max(1, width - 1)) * PLANE_CHROMA
      if (r === markRow && k === markCol) {
        line += p.color ? `${p.bg(hex)}${p.fg(ink(hex))}●\x1b[39;49m` : '●'
        continue
      }
      if (r === markRow && k === heldCol) {
        line += p.color ? `${p.fg('#aaaaaa')}○\x1b[39m` : '○'
        continue
      }
      const upper = srgb(lightnessAt(r * 2, rows), chroma, at.h)
      const lower = srgb(lightnessAt(r * 2 + 1, rows), chroma, at.h)
      if (!p.color) {
        line += upper && lower ? '·' : '░'
      } else if (upper && lower) {
        const up = `#${upper.map((v) => v.toString(16).padStart(2, '0')).join('')}`
        const down = `#${lower.map((v) => v.toString(16).padStart(2, '0')).join('')}`
        line += `${p.fg(up)}${p.bg(down)}▀\x1b[39;49m`
      } else if (upper || lower) {
        const one = (upper ?? lower) as number[]
        const color = `#${one.map((v) => v.toString(16).padStart(2, '0')).join('')}`
        line += `${p.fg(color)}${upper ? '▀' : '▄'}\x1b[39m`
      } else {
        line += `${p.fg('#555555')}░\x1b[39m`
      }
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

function pickerLines(e: PaletteEditor, p: Paint, c: Colors, side: number, room: number): string[] {
  const slot = e.slot()
  const at = e.lch[slot] as { l: number; c: number; h: number }
  const hex = e.list[slot] as Hex
  const width = side - 8
  const outer = width + 4
  const edge = p.dim('│')
  const boxed = (content: string) => ` ${edge} ${fit(content, width)} ${edge}`
  const pair = e.pair(slot)
  const checks = detailChecks(e, slot, at).filter((check) => check.ok === false || check.text.startsWith('Chroma ○'))
  const said = checks.flatMap((check) =>
    wrapText(check.text, width - 2).map(
      (line, i) => `${i === 0 ? (check.ok === false ? p.bold('✗') : p.dim('○')) : ' '} ${line}`,
    ),
  )
  const hint = fixHint(e, slot)
  const extra = [...said.slice(0, 3), ...(hint ? [p.dim(hint)] : [])]
  const fixed = 6 + (pair ? 1 : 0) + extra.length
  const rows = Math.max(3, Math.min(6, room - fixed))
  const left = ' L × C '
  const right = ` H ${at.h.toFixed(0)}° `
  const dashes = Math.max(0, outer - 4 - cells(left) - cells(right))
  const lines = [` ${p.dim('╭─')}${p.dim(left)}${p.dim('─'.repeat(dashes))}${p.dim(right)}${p.dim('─╮')}`]
  for (const line of planeLines(e, p, at, hex, width, rows)) {
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
        ),
      ),
    ),
  )
  lines.push(boxed(contrastLine(p, e, Math.max(8, width - 11))))
  const tab = (label: string, format: Format) =>
    spot({ kind: 'format', format }, e.format === format ? pill(p, c, label) : p.dim(` ${label} `))
  lines.push(boxed(`${tab('Hex', 'hex')} ${tab('RGB', 'rgb')} ${tab('OKLCH', 'oklch')}`))
  const typed = e.typing !== undefined ? p.bold(`${e.typing}▏`) : p.bold(formatText(e, hex, at))
  const was = e.start[slot] as Hex
  const swatch = p.color ? `${p.fg(was)}■\x1b[39m ` : ''
  lines.push(boxed(spread(typed, was !== hex ? p.dim(`was ${swatch}${was}`) : '', width)))
  if (pair) {
    const bright = slot >= pair.bright
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
    lines.push(boxed(spread(p.dim(text), keyZone('l', `${p.bold('l')} ${p.dim(pair.on ? 'unlink' : 'link')}`), width)))
  }
  for (const line of extra) {
    lines.push(boxed(line))
  }
  const bottom = fit(' ↑↓ L  ←→ C  ⇧←→ H  tab ◐ ', outer - 4, false)
  lines.push(
    ` ${p.dim('╰─')}${p.dim(bottom)}${p.dim('─'.repeat(Math.max(0, outer - 4 - cells(bottom))))}${p.dim('─╯')}`,
  )
  return lines
}

function sidebar(e: PaletteEditor, p: Paint, c: Colors, side: number, height: number): string[] {
  const failing = e.failing().length
  const tab = (id: 'colors' | 'gate', label: string) =>
    spot({ kind: 'tab', tab: id }, e.tab === id ? pill(p, c, label) : p.dim(` ${label} `))
  const tabs = ` ${tab('colors', 'Colors')} ${tab('gate', failing === 0 ? 'Gate ✓' : `Gate ✗ ${failing}`)}`
  const query = e.searching ? `${p.bold(e.search)}▏` : e.search ? p.bold(e.search) : p.dim('Search slots…')
  const dot = e.changedOnly ? (p.color ? `${YELLOW}●\x1b[39m` : '●') : ' '
  const search = spread(
    keyZone('ctrl+f', ` ${p.dim('⌕')} ${query}`),
    keyZone('m', `${e.changedOnly ? p.bold('⧩') : p.dim('⧩')}${dot} `),
    side,
  )
  const body = height - 2
  if (e.tab === 'gate') {
    return [tabs, search, ...gateLines(p, e, body, side)]
  }
  const rows: string[] = []
  let selAt = -1
  let pickAt = -1
  let pick: string[] = []
  const total = GROUPS.reduce((n, g) => n + 1 + g.slots.filter((s) => e.visible(s)).length, 0)
  const open = e.mode === 'tune' && e.visible(e.slot())
  if (open) {
    pick = pickerLines(e, p, c, side, Math.max(8, body - total))
  }
  for (const group of GROUPS) {
    const slots = group.slots.filter((s) => e.visible(s))
    if (slots.length === 0 && (e.changedOnly || e.search !== '')) {
      continue
    }
    rows.push(header(e, p, group, slots.length))
    if (e.folded.has(group.id)) {
      continue
    }
    for (const slot of slots) {
      if (slot === e.slot()) {
        selAt = rows.length
      }
      rows.push(rowText(e, p, c, slot, side))
      if (open && slot === e.slot()) {
        pickAt = rows.length
        rows.push(...pick)
      }
    }
  }
  if (rows.length <= body) {
    return [tabs, search, ...rows]
  }
  const keep = pickAt >= 0 ? pick.length + 1 : 1
  let start = Math.max(0, selAt - 2)
  if (selAt + keep > start + body) {
    start = selAt + keep - body
  }
  start = Math.max(0, Math.min(start, rows.length - body))
  const shown = rows.slice(start, start + body)
  if (start > 0) {
    shown[0] = p.dim(`  ↑ ${start} more`)
  }
  const below = rows.length - (start + body)
  if (below > 0) {
    shown[shown.length - 1] = p.dim(`  ↓ ${below} more`)
  }
  return [tabs, search, ...shown]
}

function topBar(e: PaletteEditor, p: Paint, c: Colors, width: number): string {
  const accent = p.fg(e.list[2] as Hex)
  const title = `${accent}◆${p.color ? '\x1b[39m' : ''} ${p.bold(e.options.title)} ${p.dim(`· ${e.options.name}`)}`
  const dirty = e.dirty()
  const changes = e.changes()
  const dot = p.color ? `${YELLOW}●\x1b[39m` : '●'
  const state = dirty ? `${dot} ${p.dim(changes > 0 ? `unsaved · ${changes} changed` : 'unsaved')}` : ''
  const buttons = dirty ? `${keyZone('R', p.dim('Reset'))}  ${keyZone('s', pill(p, c, 'Save'))}` : ''
  const left = [title, state, buttons].filter(Boolean).join('   ')
  const button = (word: string, label: string, on: boolean) => keyZone(word, on ? pill(p, c, label) : p.dim(label))
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

function titleRow(p: Paint, tile: Tile): Cellrow {
  const name = ` ${tile.name} `
  return [
    { text: name, sgr: p.color ? '\x1b[1;2m' : '' },
    { text: '─'.repeat(Math.max(0, tile.width - cells(name))), sgr: p.color ? '\x1b[2m' : '' },
  ]
}

function contentRows(
  e: PaletteEditor,
  p: Paint,
  c: Colors,
  layout: Layout,
  tile: Tile,
  pinned: ReturnType<typeof validSpot>,
): Cellrow[] {
  const lines = linesOf(tile.id, layout.tier, tile.width)
  const base = p.color ? `${p.bg(c.background)}${p.fg(c.foreground)}` : ''
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
            : `${base}${roleSgr(p, c, part.role, usesSlot(part.role, slot))}`
          : ''
        row.push({ text: part.text, sgr, target: { kind: 'run', spot: { pane: tile.id, line: i, run: r } } })
      })
    }
    const inner = crop(row, 0, tile.width - 1)
    const pad = tile.width - widthOf(inner)
    return pad > 0 ? [...inner, { text: ' '.repeat(pad), sgr: base }] : inner
  })
}

function popoverRows(e: PaletteEditor, p: Paint, c: Colors): Cellrow[] | undefined {
  const here = e.slotsHere()
  if (!here) {
    return undefined
  }
  const base = p.color ? `${p.bg(c.background)}${p.fg(c.foreground)}` : ''
  const dim = p.color ? `${base}\x1b[2m` : ''
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
      { text: '■', sgr: p.color ? `${base}${p.fg(hex)}` : '', target },
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
  const dim = p.color ? `${base}\x1b[2m` : ''
  const title = e.menu === 'export' ? 'Copy ' : 'Take from '
  const rows: Cellrow[] = [[{ text: `┌ ${title}${'─'.repeat(Math.max(0, width - 3 - title.length))}┐`, sgr: dim }]]
  items.forEach((item, index) => {
    const here = index === e.entry
    const target: EditorSpot = { kind: 'entry', index }
    rows.push([
      { text: '│', sgr: dim },
      {
        text: ` ${here ? '▌' : ' '} ${item.padEnd(width - 6)}`,
        sgr: here && p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}\x1b[1m` : base,
        target,
      },
      { text: '│', sgr: dim },
    ])
  })
  rows.push([{ text: `└${'─'.repeat(width - 2)}┘`, sgr: dim }])
  return rows
}

function tabStrip(e: PaletteEditor, p: Paint, c: Colors, width: number): Cellrow {
  const names = tabNames()
  const at = ((e.scene % names.length) + names.length) % names.length
  const row: Cellrow = [{ text: ' ', sgr: '' }]
  names.forEach((name, i) => {
    const target: EditorSpot = { kind: 'scene', scene: i }
    row.push(
      i === at
        ? { text: ` ${name} `, sgr: p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}\x1b[1m` : '', target }
        : { text: `${name}`, sgr: p.color ? '\x1b[2m' : '', target },
      { text: '  ', sgr: '' },
    )
  })
  const used = widthOf(row)
  return [
    ...row,
    { text: ' '.repeat(Math.max(0, width - used - 4)), sgr: '' },
    { text: '⇧←→ ', sgr: p.color ? '\x1b[2m' : '' },
  ]
}

export function renderBuilder(e: PaletteEditor, cols: number, rows: number, color: boolean): string[] | undefined {
  const layout = layoutOf(cols, rows, e.scene)
  if (!layout) {
    return undefined
  }
  const p = painter(color)
  const shown = e.shown()
  const c = colorsOf(shown)
  const side = sidebar(e, p, colorsOf(e.list), layout.side, rows - 1)
  const pinned = e.inspect ? validSpot(layout, e.spot) : undefined
  const grid: Cellrow[] = Array.from({ length: rows - 3 }, () => [{ text: ' '.repeat(layout.width), sgr: '' }])
  const put = (row: number, col: number, cellrow: Cellrow) => {
    const at = row - 2
    if (at >= 0 && at < grid.length) {
      grid[at] = overlay(grid[at] as Cellrow, col, cellrow)
    }
  }
  const origin = layout.side + 1
  if (layout.tier === 'tabs') {
    put(2, 0, tabStrip(e, p, c, layout.width))
  }
  for (const tile of layout.tiles) {
    const col = tile.col - origin
    if (tile.title >= 0) {
      put(tile.title, col, titleRow(p, tile))
    }
    contentRows(e, p, c, layout, tile, pinned).forEach((row, i) => {
      put(tile.row + i, col, row)
    })
    if (col > 0 && tile.width < layout.width) {
      for (let r = tile.title; r < tile.row + tile.rows; r++) {
        put(r, col - 1, [{ text: '│', sgr: p.color ? '\x1b[2m' : '' }])
      }
    }
  }
  const pop = pinned ? popoverRows(e, p, c) : undefined
  if (pinned && pop) {
    const tile = layout.tiles.find((t) => t.id === pinned.pane) as Tile
    const part = linesOf(tile.id, layout.tier, tile.width)[pinned.line]?.[pinned.run]
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
  const top = topBar(e, p, colorsOf(e.list), layout.width)
  const rule = p.dim('─'.repeat(layout.width))
  const divider = p.dim('│')
  const lines: string[] = []
  for (let r = 0; r < rows - 1; r++) {
    const right = r === 0 ? top : r === 1 ? rule : drawn(grid[r - 2] ?? [], color)
    lines.push(`${fit(side[r] ?? '', layout.side)}${divider}${right}`)
  }
  return lines
}
