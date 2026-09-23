import { BLOCKS, type Block, KEY_SPAN, type Rating, SITES } from './booru.ts'
import { type Hex, rgb } from './color.ts'

export type Preset = 'cutouts' | 'all'
export type Order = 'fit' | 'newest' | 'score'
export type Sets = 'fold' | 'show'

export interface Setting {
  name: string
  label: string
  choices: string[]
  multi?: { read(raw: string | undefined): string[]; none?: string }
}

export interface Row {
  label: string
  choices: string[]
  value: string
  multi?: { none?: string }
  cursor: number
}

export interface Tile {
  id: number
  key: number
  site: string
  siteAnsi: number
  width: number
  height: number
  reduced: boolean
  owner: string
  artist: string
  score: number
  variants: number
  origin: string
  mates: string[]
  thumb?: string
}

export interface Shown {
  id: number
  clear: number
  bytes: number
  path: string
  cut: 'on' | 'off' | 'failed' | 'none'
}

export interface FindView {
  palette: string
  tag: string
  site: string
  siteAnsi: number
  nextSite: string
  preset: Preset
  order: Order
  solo: boolean
  rating: Rating[]
  block: Block[]
  sets: Sets
  unblocked: boolean
  settings: Row[]
  panel?: number
  colors: { cursor: Hex; selection: Hex; ansi: Hex[] }
  tiles: Tile[]
  installed: number[]
  checked: number
  total: number
  searching: boolean
  focus: number
  top: number
  mode: 'grid' | 'try'
  help: boolean
  fetching?: { id: number; got: number; size: number }
  preparing?: number
  cutting?: number
  installing?: number
  shown?: Shown
  editing?: string
  suggest?: { value: string; count: number; palette?: string }[]
  pick?: number
  asking?: string
  saved?: string
  note?: string
  hint?: string
  error?: string
  waiting?: number
  slow?: string
}

export interface Placement {
  id: number
  path: string
  row: number
  col: number
  cols: number
  rows: number
  z: number
}

export interface Frame {
  lines: string[]
  images: Placement[]
}

export const TILE = { pitch: 25, cols: 22, rows: 9, height: 13 }
export const MIN = { cols: 25, rows: 16 }
export const TRY_ID = 2 ** 31
const BELOW_BG = -1073741826
const SMALL = 1600

const R = '\x1b[0m'
const B = '\x1b[1m'
const D = '\x1b[2m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[1;34m'
const MAGENTA = '\x1b[35m'

const CSI: Record<string, string> = {
  A: 'up',
  B: 'down',
  C: 'right',
  D: 'left',
  H: 'home',
  F: 'end',
  '1~': 'home',
  '7~': 'home',
  '4~': 'end',
  '8~': 'end',
  '5~': 'pgup',
  '6~': 'pgdn',
  I: 'focus-in',
  O: 'focus-out',
}

export function decodeKeys(input: string): string[] {
  const keys: string[] = []
  let i = 0
  while (i < input.length) {
    const c = input[i] ?? ''
    if (c === '\x1b') {
      const m = /^(?:\[([0-9;]*)([A-Za-z~])|O([A-Za-z]))/.exec(input.slice(i + 1))
      if (m) {
        keys.push(CSI[`${m[1] ?? ''}${m[2] ?? m[3] ?? ''}`] ?? 'nop')
        i += 1 + m[0].length
        continue
      }
      const next = input[i + 1] ?? ''
      if (/^[a-z]$/.test(next)) {
        keys.push(`alt-${next}`)
        i += 2
        continue
      }
      keys.push('esc')
      i++
      continue
    }
    keys.push(
      c === '\r' || c === '\n'
        ? 'enter'
        : c === '\t'
          ? 'tab'
          : c === '\x03'
            ? 'ctrl-c'
            : c === '\x16'
              ? 'ctrl-v'
              : c === '\x7f' || c === '\b'
                ? 'backspace'
                : c,
    )
    i++
  }
  return keys
}

export const CELL_QUERY = '\x1b]1337;ReportCellSize\x07\x1b[16t'

const ITERM_CELL = '\x1b]1337;ReportCellSize='

export function cellReport(input: string): { cell: { w: number; h: number }; rest: string } | null {
  const at = input.indexOf(ITERM_CELL)
  if (at !== -1) {
    const body = input.slice(at + ITERM_CELL.length)
    const ends = [body.indexOf('\x07'), body.indexOf('\x1b\\')].filter((i) => i !== -1)
    const end = ends.length > 0 ? Math.min(...ends) : -1
    const m = end === -1 ? null : /^([\d.]+);([\d.]+);([\d.]+)$/.exec(body.slice(0, end))
    if (m) {
      const scale = Number(m[3])
      return {
        cell: { h: Math.round(Number(m[1]) * scale), w: Math.round(Number(m[2]) * scale) },
        rest: input.slice(0, at) + body.slice(end + (body[end] === '\x07' ? 1 : 2)),
      }
    }
  }
  const x = input.indexOf('\x1b[6;')
  const m = x === -1 ? null : /^\[6;(\d+);(\d+)t/.exec(input.slice(x + 1))
  if (!m) {
    return null
  }
  return { cell: { h: Number(m[1]), w: Number(m[2]) }, rest: input.slice(0, x) + input.slice(x + 1 + m[0].length) }
}

export function gridShape(cols: number, rows: number): { perRow: number; rowsVis: number } {
  return {
    perRow: Math.max(1, Math.floor((cols + 1) / TILE.pitch)),
    rowsVis: Math.max(1, Math.floor((rows - 4) / TILE.height)),
  }
}

export function transmit(p: Placement): string {
  return `\x1b_Ga=t,t=f,f=100,i=${p.id},q=2;${Buffer.from(p.path).toString('base64')}\x1b\\`
}

export function place(p: Placement): string {
  return `\x1b[${p.row + 1};${p.col + 1}H\x1b_Ga=p,i=${p.id},p=${p.id},c=${p.cols},r=${p.rows},C=1,z=${p.z},q=2\x1b\\`
}

export function release(id: number): string {
  return `\x1b_Ga=d,d=I,i=${id},q=2\x1b\\`
}

function fg(hex: Hex): string {
  return `\x1b[38;2;${rgb(hex).join(';')}m`
}

function bg(hex: Hex): string {
  return `\x1b[48;2;${rgb(hex).join(';')}m`
}

function width(text: string): number {
  return Array.from(text).length
}

type Part = [string, string]

class Line {
  private readonly parts: { col: number; text: string; sgr: string }[] = []
  private readonly cols: number

  constructor(cols: number) {
    this.cols = cols
  }

  put(col: number, text: string, sgr = ''): number {
    this.parts.push({ col, text, sgr })
    return col + width(text)
  }

  run(col: number, parts: Part[]): number {
    let c = col
    for (const [text, sgr] of parts) {
      c = this.put(c, text, sgr)
    }
    return c
  }

  right(end: number, parts: Part[]): void {
    this.run(end - parts.reduce((n, [text]) => n + width(text), 0), parts)
  }

  render(): string {
    let out = ''
    for (const { col, text, sgr } of this.parts) {
      if (col >= this.cols || col < 0) {
        continue
      }
      const shown = Array.from(text)
        .slice(0, this.cols - col)
        .join('')
      out += `\x1b[${col + 1}G${sgr}${shown}${sgr ? R : ''}`
    }
    return out
  }
}

function megabytes(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`
}

function progress(got: number, size: number): string {
  if (!size) {
    return megabytes(got)
  }
  return size >= 1e6
    ? `${(got / 1e6).toFixed(1)}/${(size / 1e6).toFixed(1)} MB`
    : `${Math.round(got / 1e3)}/${Math.round(size / 1e3)} KB`
}

export function plain(artist: string): string {
  return artist.replace(/_\([^)]*\)?$/, '')
}

function dims(tile: Tile): Part {
  return [
    `${tile.reduced ? '↓' : ''}${tile.width}×${tile.height}`,
    Math.max(tile.width, tile.height) < SMALL ? YELLOW : D,
  ]
}

interface Foot {
  badge?: string
  lead?: Part
  keys?: [string, string][]
  right?: [string, string]
}

function foot(line: Line, cols: number, accent: string, spec: Foot): void {
  const keys = [...(spec.keys ?? [])]
  let lead = spec.lead
  let right = spec.right
  const size = () => {
    const segs = [...(lead ? [width(lead[0])] : []), ...keys.map(([k, l]) => width(k) + 1 + width(l))]
    const left =
      (spec.badge ? width(spec.badge) + 4 : 0) + segs.reduce((n, w) => n + w, 0) + 3 * Math.max(0, segs.length - 1)
    return left + (right ? 3 + width(right[0]) + 1 + width(right[1]) : 0)
  }
  while (size() > cols) {
    if (keys.length > 2) {
      keys.splice(-2, 1)
    } else if (right) {
      right = undefined
    } else if (keys.length > 1) {
      keys.splice(-2, 1)
    } else {
      break
    }
  }
  if (lead && size() > cols) {
    const keep = Math.max(0, width(lead[0]) - (size() - cols) - 1)
    lead = [`${Array.from(lead[0]).slice(0, keep).join('')}…`, lead[1]]
  }
  let c = 0
  if (spec.badge) {
    c = line.put(0, ` ${spec.badge} `, `\x1b[7;1m${accent}`) + 2
  }
  const segs: Part[][] = [
    ...(lead ? [[lead]] : []),
    ...keys.map(([k, l]): Part[] => [
      [k, B],
      [` ${l}`, D],
    ]),
  ]
  segs.forEach((seg, i) => {
    c = line.run(c + (i ? 3 : 0), seg)
  })
  if (right) {
    line.right(cols, [
      [right[0], B],
      [` ${right[1]}`, D],
    ])
  }
}

function specimen(lines: Line[], row: number, col: number, sw: number, maxRow: number, view: FindView): void {
  const { ansi, selection, cursor } = view.colors
  let cw = sw < 44 ? 3 : 4
  if (sw >= 56) {
    cw = Math.min(7, Math.floor((sw + 1) / 8) - 1)
  }
  let c = col
  for (let i = 0; i < 8; i++) {
    c = (lines[row]?.put(c, '▀'.repeat(cw), fg(ansi[i] ?? cursor) + bg(ansi[i + 8] ?? cursor)) ?? c) + 1
  }
  const prompt: Part = ['❯ ', GREEN]
  const text: Part[][] = [
    [
      ['~/code/demo', BLUE],
      [' on ', D],
      ['main', MAGENTA],
      [' +2', GREEN],
      [' ~1', YELLOW],
    ],
  ]
  text.push([prompt, ['git status -sb', '']])
  if (sw >= 44) {
    text.push([
      ['## ', ''],
      ['main', GREEN],
      ['...', ''],
      ['origin/main', RED],
      [' [ahead 1]', YELLOW],
    ])
  }
  text.push([
    [' M', RED],
    [' src/main.rs', ''],
  ])
  text.push([
    ['??', RED],
    [' notes.md', ''],
  ])
  text.push([])
  if (sw >= 44) {
    text.push([prompt, ['ls', '']])
    text.push([
      ['docs', BLUE],
      ['  ', ''],
      ['src', BLUE],
      ['  ', ''],
      ['tests', BLUE],
      ['  Cargo.toml  README.md', ''],
    ])
    text.push([])
  }
  text.push([prompt, ['cargo test', '']])
  text.push([
    [' ✓', GREEN],
    [' parses config', ''],
  ])
  const failed: Part[] = [
    [' ✗', RED],
    [' renders frame', ''],
  ]
  if (sw >= 44) {
    failed.push(['  expected ', D], ['3', GREEN], [', received ', D], ['2', RED])
  }
  text.push(failed)
  text.push([])
  text.push([prompt, ['echo ', ''], ['selected text', bg(selection)], [' ', ''], [' ', bg(cursor)]])
  text.forEach((parts, i) => {
    const r = row + 2 + i
    if (r <= maxRow) {
      lines[r]?.run(col, parts)
    }
  })
}

function frameBox(lines: Line[], r0: number, c0: number, h: number, w: number, sgr: string): void {
  lines[r0]?.put(c0, `╭${'─'.repeat(w - 2)}╮`, sgr)
  for (let r = r0 + 1; r < r0 + h - 1; r++) {
    lines[r]?.put(c0, '│', sgr)
    lines[r]?.put(c0 + w - 1, '│', sgr)
  }
  lines[r0 + h - 1]?.put(c0, `╰${'─'.repeat(w - 2)}╯`, sgr)
}

function badge(view: FindView, label = view.site, ansi = view.siteAnsi): Part {
  return [` ${label} `, `\x1b[7;${30 + ansi}m`]
}

function named(key: number): string {
  return `${SITES[Math.floor(key / KEY_SPAN)]?.name ?? 'local'} ${key % KEY_SPAN}`
}

function tabs(line: Line, cols: number, view: FindView): void {
  const strip = [{ name: 'all', moved: false }, ...SITES].flatMap((site, i): Part[] => {
    const label = `${site.name}${site.moved ? '*' : ''}`
    const tab: Part = site.name === view.site ? badge(view, label) : [` ${label} `, D]
    return i ? [[' ', ''], tab] : [tab]
  })
  const fits = strip.reduce((n, [text]) => n + width(text), 0) <= cols
  const end = line.run(0, fits ? strip : [badge(view)])
  if (view.asking !== undefined) {
    line.run(end, [
      [`  ${view.asking} was cut off — this network may block it. turn on the unblock proxy?  `, YELLOW],
      ['y', B],
      [' turn on  ', D],
      ['n', B],
      [' not now', D],
    ])
  }
}

function query(line: Line, cols: number, view: FindView, accent: string): void {
  if (view.editing !== undefined) {
    const c = line.run(0, [
      ['⌕ ', accent],
      [view.editing, ''],
      ['█', accent],
    ])
    const hint = view.suggest?.length ? '  ↑↓ pick  enter searches' : '  enter searches'
    line.put(
      c,
      view.editing ? hint : `  a tag, a post url or an id, or drop a picture or ctrl+v — ${view.tag || 'esc leaves'}`,
      D,
    )
    return
  }
  const c = line.run(0, [
    ['⌕ ', accent],
    [view.tag || 'nothing yet — / searches, ctrl+v pastes a picture', view.tag ? '' : D],
  ])
  const allowed = BLOCKS.filter((block) => !view.block.includes(block))
  const state = [
    view.preset,
    ...(view.solo ? ['solo'] : []),
    view.order,
    ...(view.rating.join('+') === 'safe' ? [] : [view.rating.join('+')]),
    ...(allowed.length > 0 ? [`allows ${allowed.join('+')}`] : []),
    ...(view.unblocked ? ['unblock'] : []),
  ]
  line.put(c, `  ${state.join('  ')}`, D)
  if (view.total > 0 || !view.searching) {
    const counter: Part[] = [[`${view.tiles.length}/${view.checked}`, '']]
    if (view.checked < view.total) {
      counter.push([` of ${view.total}`, D])
    }
    line.right(cols, counter)
  }
}

function transparent(shown: Shown): Part[] {
  if (shown.cut === 'on') {
    return [[`cut out · ${shown.clear}% transparent`, GREEN]]
  }
  if (shown.cut === 'off') {
    return [['opaque · x cuts out', YELLOW]]
  }
  if (shown.cut === 'failed') {
    return [['opaque · no cut-out', YELLOW]]
  }
  return [shown.clear > 0 ? [`${shown.clear}% transparent`, GREEN] : ['opaque', YELLOW]]
}

function where(view: FindView): string {
  return view.site === 'all' ? 'any site' : view.site
}

function status(view: FindView): Part | undefined {
  if (view.installing !== undefined) {
    return [`installing ${view.palette} ← ${named(view.installing)}`, YELLOW]
  }
  if (view.hint) {
    return [view.hint, GREEN]
  }
  if (view.error) {
    return [view.error, YELLOW]
  }
  if (view.waiting !== undefined) {
    return [`${view.slow ?? view.site} asked to slow down · ${view.waiting}s`, YELLOW]
  }
  if (view.fetching) {
    return [`fetching ${view.fetching.id % KEY_SPAN} · ${progress(view.fetching.got, view.fetching.size)}`, YELLOW]
  }
  if (view.cutting !== undefined) {
    return [`cutting out ${view.cutting % KEY_SPAN}`, YELLOW]
  }
  if (view.preparing !== undefined) {
    return [`preparing ${view.preparing % KEY_SPAN}`, YELLOW]
  }
  if (view.saved) {
    return [view.saved, GREEN]
  }
  if (view.note) {
    return [view.note, D]
  }
  return undefined
}

function grid(lines: Line[], images: Placement[], cols: number, rows: number, view: FindView, accent: string): void {
  const { perRow, rowsVis } = gridShape(cols, rows)
  query(lines[0] as Line, cols, view, accent)
  tabs(lines[1] as Line, cols, view)
  for (let k = 0; k < perRow * rowsVis; k++) {
    const i = view.top * perRow + k
    const tile = view.tiles[i]
    if (!tile) {
      break
    }
    const r0 = 2 + Math.floor(k / perRow) * TILE.height
    const c0 = (k % perRow) * TILE.pitch
    const on = i === view.focus
    if (on) {
      frameBox(lines, r0, c0, TILE.height, TILE.pitch - 1, accent)
    }
    if (tile.thumb) {
      images.push({ id: tile.key, path: tile.thumb, row: r0 + 1, col: c0 + 1, cols: TILE.cols, rows: TILE.rows, z: -1 })
    }
    lines[r0 + 10]?.run(c0 + 1, [
      ...(view.installed.includes(tile.key) ? ([['✓ ', GREEN]] as Part[]) : []),
      ...(view.site === 'all' ? ([['● ', `\x1b[${30 + tile.siteAnsi}m`]] as Part[]) : []),
      [String(tile.id), on ? B : ''],
      [' ', ''],
      dims(tile),
    ])
    if (tile.mates.length > 0) {
      lines[r0 + 10]?.put(c0 + TILE.cols, '≈', accent)
    }
    const credit = tile.artist ? plain(tile.artist) : tile.owner && `@${tile.owner}`
    if (credit) {
      lines[r0 + 11]?.put(c0 + 1, credit.slice(0, TILE.cols - 8), D)
    }
    const marks: Part[] = []
    if (tile.score > 0) {
      marks.push([`★${tile.score}`, D])
    }
    if (tile.variants > 1) {
      marks.push([` ×${tile.variants}`, accent])
    }
    if (marks.length > 0) {
      lines[r0 + 11]?.right(c0 + TILE.cols + 1, marks)
    }
  }
  const above = view.top * perRow
  const below = view.tiles.length - (view.top + rowsVis) * perRow
  const scroll = [...(above > 0 ? [`↑ ${above} above`] : []), ...(below > 0 ? [`↓ ${below} more`] : [])]
  if (scroll.length > 0) {
    lines[rows - 2]?.put(0, scroll.join('   '), D)
  }
  if (!view.searching && view.tiles.length === 0 && !view.error) {
    lines[3]?.put(
      0,
      view.preset === 'cutouts'
        ? `no transparent cutouts of ${view.tag} on ${where(view)} — c searches every post, tab tries ${view.nextSite}`
        : `no posts of ${view.tag} on ${where(view)} — tab tries ${view.nextSite}`,
      D,
    )
  }
  const line = lines[rows - 1] as Line
  const lead = status(view)
  if (view.searching && view.tiles.length === 0 && !lead) {
    foot(line, cols, accent, {
      badge: 'FIND',
      lead: [view.preset === 'cutouts' ? 'checking png headers' : 'fetching posts', D],
      right: ['esc', 'back'],
    })
    return
  }
  foot(line, cols, accent, {
    badge: 'FIND',
    lead,
    keys:
      view.asking !== undefined
        ? []
        : [
            ['←↑↓→', 'move'],
            ['enter', 'try on'],
            ['tab', 'site'],
            ['ctrl+v', 'picture'],
            ['s', 'settings'],
            ['/', 'search'],
            ['?', 'keys'],
          ],
    right: view.asking !== undefined ? undefined : ['esc', 'back'],
  })
}

function trial(lines: Line[], images: Placement[], cols: number, rows: number, view: FindView, accent: string): void {
  const tile = view.tiles[view.focus]
  if (!tile) {
    return
  }
  const shown = view.shown?.id === tile.key ? view.shown : undefined
  const meta: Part[] = [badge(view, tile.site, tile.siteAnsi), ['  ', ''], [String(tile.id), B], ['  ', ''], dims(tile)]
  if (tile.artist) {
    meta.push([` · ${plain(tile.artist)}`, ''])
  }
  if (tile.score > 0) {
    meta.push([` · ★${tile.score}`, D])
  }
  if (shown) {
    meta.push([` · ${megabytes(shown.bytes)}`, D])
  }
  if (tile.owner) {
    meta.push([` · ${tile.owner}`, D])
  }
  if (tile.origin) {
    meta.push([` · ${tile.origin}`, D])
  }
  if (shown) {
    meta.push(['  ', ''], ...transparent(shown))
  }
  lines[0]?.run(0, meta)
  if (tile.mates.length > 0) {
    lines[0]?.right(cols, [
      ['≈ ', accent],
      [tile.mates.join(' '), D],
    ])
  }
  specimen(lines, 3, 2, cols - 4, rows - 2, view)
  if (view.shown) {
    images.push({ id: TRY_ID + view.shown.id, path: view.shown.path, row: 0, col: 0, cols, rows, z: BELOW_BG })
  }
  const lead = status(view)
  foot(lines[rows - 1] as Line, cols, accent, {
    badge: 'TRY',
    lead,
    keys:
      view.installing === undefined
        ? [
            ['←→', 'browse'],
            ['enter', 'install'],
            ...(view.shown?.cut === 'on' || view.shown?.cut === 'off' ? [['x', 'cut out'] as [string, string]] : []),
            ['?', 'keys'],
          ]
        : [],
    right: view.installing === undefined ? ['esc', 'grid'] : undefined,
  })
}

const KEYS: Record<FindView['mode'], [string, string][]> = {
  grid: [
    ['move', '←↑↓→  home  end  pgup  pgdn'],
    ['try on', 'enter'],
    ['site', `tab  all, ${SITES.map((site) => site.name).join(', ')}`],
    ['posts', 'c  cutouts or every post'],
    ['search', '/  a tag, a post url or an id'],
    ['your own', 'ctrl+v or v  a picture from the clipboard · drop one on the window or paste its link'],
    ['unfold', 'space  a set of ×N'],
    ['open', 'o  the post page in a browser'],
    ['settings', 's  rating, block, posts, solo, order, sets, remove bg'],
    ['back', 'esc returns to preview'],
    ['close', '?  esc'],
  ],
  try: [
    ['browse', '←→'],
    ['install', 'enter'],
    ['cut out', 'x  the background off or on, on an opaque picture'],
    ['open', 'o  the post page in a browser'],
    ['your own', 'ctrl+v or v  a picture from the clipboard · drop one on the window'],
    ['grid', 'esc'],
    ['close', '?  esc'],
  ],
}

function panel(lines: Line[], cols: number, rows: number, view: FindView, accent: string): void {
  const at = view.panel ?? 0
  const label = Math.max(...view.settings.map((row) => row.label.length))
  const widest = Math.max(
    ...view.settings.map((row) => row.choices.reduce((n, c) => n + c.length + (row.multi ? 6 : 3), 0)),
  )
  const w = Math.min(cols - 2, Math.max(28, label + widest + 8))
  const h = view.settings.length + 4
  const x = Math.floor((cols - w) / 2)
  const y = Math.max(2, Math.floor((rows - h) / 2))
  lines[y]?.put(x, `╭─ settings ${'─'.repeat(Math.max(0, w - 13))}╮`)
  for (let r = y + 1; r < y + h - 1; r++) {
    lines[r]?.put(x, `│${' '.repeat(w - 2)}│`)
  }
  view.settings.forEach((row, i) => {
    const line = lines[y + 2 + i] as Line
    line.put(x + 3, row.label, i === at ? B : D)
    let c = x + 5 + label
    const on = row.value.split(' ')
    row.choices.forEach((choice, k) => {
      const lit = on.includes(choice)
      const under = row.multi && i === at && k === row.cursor ? '4;' : ''
      const text = row.multi ? ` ${lit ? '[x]' : '[ ]'} ${choice} ` : ` ${choice} `
      c = line.put(c, text, lit ? `\x1b[${under}7;${30 + view.siteAnsi}m` : under ? `\x1b[4m${D}` : D) + 1
    })
  })
  lines[y + h - 1]?.put(x, `╰${'─'.repeat(w - 2)}╯`)
  foot(lines[rows - 1] as Line, cols, accent, {
    badge: 'SET',
    keys: [
      ['↑↓', 'setting'],
      ['←→', 'value'],
      ['space', 'toggle'],
      ['enter', 'save'],
    ],
    right: ['esc', 'undo'],
  })
}

function help(lines: Line[], cols: number, rows: number, view: FindView, accent: string): void {
  const keys = KEYS[view.mode]
  const w = Math.min(cols - 2, 50)
  const h = keys.length + 4
  const x = Math.floor((cols - w) / 2)
  const y = Math.max(2, Math.floor((rows - h) / 2))
  lines[y]?.put(x, `╭─ keys ${'─'.repeat(w - 9)}╮`)
  for (let r = y + 1; r < y + h - 1; r++) {
    lines[r]?.put(x, `│${' '.repeat(w - 2)}│`)
  }
  keys.forEach(([label, value], i) => {
    lines[y + 2 + i]?.put(x + 3, label, B)
    lines[y + 2 + i]?.put(x + 13, value.slice(0, w - 16))
  })
  lines[y + h - 1]?.put(x, `╰${'─'.repeat(w - 2)}╯`)
  foot(lines[rows - 1] as Line, cols, accent, { badge: 'KEYS', right: ['? esc', 'close'] })
}

function suggestions(lines: Line[], view: FindView, accent: string): void {
  const list = view.suggest ?? []
  const said = list.map((item) => (item.count > 0 ? String(item.count) : (item.palette ?? '0')))
  const wide = Math.max(...list.map((item) => width(item.value)))
  const note = Math.max(7, ...said.map(width))
  list.forEach((item, i) => {
    const on = i === view.pick
    const line = lines[1 + i]
    line?.run(0, [
      [on ? '▸ ' : '  ', accent],
      [item.value, on ? B + accent : ''],
    ])
    line?.right(2 + wide + 2 + note, [[said[i] as string, D]])
  })
}

export function renderFind(view: FindView, cols: number, rows: number): Frame {
  const lines = Array.from({ length: rows }, () => new Line(cols))
  const images: Placement[] = []
  const accent = fg(view.colors.cursor)
  if (cols < MIN.cols || rows < MIN.rows) {
    lines[0]?.put(0, 'ttheme find', B + accent)
    lines[1]?.put(0, `needs ${MIN.cols}×${MIN.rows} — now ${cols}×${rows}`)
    lines[2]?.put(0, 'esc quits', D)
    return { lines: lines.map((l) => l.render()), images }
  }
  if (view.mode === 'try') {
    trial(lines, images, cols, rows, view, accent)
  } else {
    grid(lines, images, cols, rows, view, accent)
  }
  if (view.mode === 'grid' && view.editing !== undefined && view.suggest?.length) {
    for (let r = 1; r < rows - 1; r++) {
      lines[r] = new Line(cols)
    }
    suggestions(lines, view, accent)
    return { lines: lines.map((l) => l.render()), images: [] }
  }
  if (view.help || view.panel !== undefined) {
    const keep = view.mode === 'try' ? images : []
    for (let r = 0; r < rows; r++) {
      lines[r] = new Line(cols)
    }
    if (view.help) {
      help(lines, cols, rows, view, accent)
    } else {
      panel(lines, cols, rows, view, accent)
    }
    return { lines: lines.map((l) => l.render()), images: keep }
  }
  return { lines: lines.map((l) => l.render()), images }
}
