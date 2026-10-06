import { cells } from './ansi.ts'
import { SCENES, sceneParts } from './scenes.ts'

export const FULL_COLS = 130
export const FULL_ROWS = 38
export const TABS_COLS = 96
export const TABS_ROWS = 28

interface Pane {
  id: string
  scenes: string[]
  name: string
  tail: boolean
}

const PANES: Pane[] = [
  { id: 'shell', scenes: ['Diff', 'Logs', 'Shell'], name: 'zsh', tail: true },
  { id: 'code', scenes: ['Editor'], name: 'nvim', tail: false },
  { id: 'monitor', scenes: ['Top'], name: 'htop', tail: false },
]

const PICKS: Record<string, number[]> = {
  Shell: [0, 1, 2, 3, 4, 6, 7, 9, 10, 12, 14],
  Diff: [0, 1, 3, 4, 6, 7, 8, 9, 10, 15],
  Logs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

const SWATCHES = (from: number) => Array.from({ length: 8 }, (_, i) => `«K${from + i}»   «»`).join(' ')

const COLORTEST = ['«2»❯ «»colortest', `«d»0-7   ${SWATCHES(0)}`, `«d»8-15  ${SWATCHES(8)}`]

const MARGIN = 2

export interface Part {
  text: string
  role: string
  col: number
}

export interface Tile {
  id: string
  name: string
  col: number
  row: number
  width: number
  rows: number
}

export interface Rule {
  row: number
  col: number
  length: number
  down: boolean
}

export interface Box {
  col: number
  row: number
  cols: number
  rows: number
}

export interface Layout {
  tier: 'full' | 'tabs'
  side: number
  width: number
  frame: Box
  title: Box
  inner: Box
  rules: Rule[]
  tiles: Tile[]
}

export interface Spot {
  pane: string
  line: number
  run: number
}

export interface Slots {
  text: number
  ground: number
}

function paneAt(index: number): Pane {
  const n = PANES.length
  return PANES[((index % n) + n) % n] as Pane
}

export function tabNames(): string[] {
  return PANES.map((pane) => pane.name)
}

export function layoutOf(cols: number, rows: number, scene: number): Layout | undefined {
  const tier =
    cols >= FULL_COLS && rows >= FULL_ROWS ? 'full' : cols >= TABS_COLS && rows >= TABS_ROWS ? 'tabs' : undefined
  if (!tier) {
    return undefined
  }
  const side = tier === 'full' ? (cols >= 140 ? 47 : 38) : 37
  const width = cols - side - 1
  const left = side + 1 + MARGIN
  const right = side + width - MARGIN
  const top = 3
  const bottom = rows - 3
  const frame = { col: left, row: top, cols: right - left + 1, rows: bottom - top + 1 }
  const inner = { col: left + 1, row: top + 3, cols: frame.cols - 2, rows: bottom - top - 3 }
  const rules: Rule[] = [
    { row: top, col: left, length: frame.cols, down: false },
    { row: top + 2, col: left, length: frame.cols, down: false },
    { row: bottom, col: left, length: frame.cols, down: false },
    { row: top, col: left, length: bottom - top + 1, down: true },
    { row: top, col: right, length: bottom - top + 1, down: true },
  ]
  const pane = paneAt(scene)
  return {
    tier,
    side,
    width,
    frame,
    title: { col: inner.col, row: top + 1, cols: inner.cols, rows: 1 },
    inner,
    rules,
    tiles: [{ id: pane.id, name: pane.name, col: inner.col, row: inner.row, width: inner.cols, rows: inner.rows }],
  }
}

const ADDED = '«2»▎ '
const CHANGED = '«3»▎ '
const DELETED = '«1»▁ '

const SOURCE: [string, string][] = [
  ['', "«5»import«» { «4»readFile«» } «5»from «2»'node:fs/promises'"],
  ['', "«5»import«» { «5»type «6»Hex«», «4»contrast«» } «5»from «2»'./color.ts'"],
  ['', ''],
  ['', '«8»/** A palette read from disk and checked against the gate. */'],
  [ADDED, '«5»export interface «6»Palette «»{'],
  [ADDED, '  name: «6»string'],
  [ADDED, '  ansi: «6»Hex«»[]'],
  [ADDED, '  ratio?: «6»number'],
  [ADDED, '}'],
  ['', ''],
  ['', '«5»const «»SIXTEEN = «3»16'],
  ['', '«5»const «»FLOOR = «3»4.5 «8»// WCAG AA for body text'],
  ['', ''],
  ['', '«5»export async function «4»load«»(path: «6»string«»): «6»Promise«»<«6»Palette«»> {'],
  [CHANGED, "  «5»const «»text = «5»await «4»readFile«»(path, «2»'utf8'«»)"],
  [CHANGED, '  «5»const «»colors = «s»parse(text)«».colors ?? {}'],
  ['', '  «5»if «»(colors.ansi.length !== «K3»SIXTEEN«») {  «1»● needs 16 ANSI colors'],
  ['', "    «5»throw new «6»Error«»(«2»'expected sixteen colors, got '«» + colors.ansi.length)"],
  ['', '  }'],
  [DELETED, '  «5»const «»ratio = «4»contrast«»(colors.ansi[«3»0«»], colors.ansi[«3»7«»])  «3»● ratio is read once'],
  ['', '  «5»return «»{ name: path, ...colors, ratio: «c»r«»atio }'],
  ['', '}'],
  ['', ''],
  ['', '«5»export function «4»passes«»(palette: «6»Palette«»): «6»boolean «»{'],
  ['', '  «5»return «»(palette.ratio ?? «3»0«») >= FLOOR «8»// TODO: check the bright pairs'],
  ['', '}'],
]

const CURSOR_LINE = 21

function editorLines(): string[] {
  return [
    '«K4» theme.ts «s» scenes.ts «s» contrast.ts ',
    ...SOURCE.map(([sign, code], i) => {
      const n = String(i + 1).padStart(3)
      return `${i + 1 === CURSOR_LINE ? `«b»${n}` : `«d»${n}`} ${sign || '«»  '}«»${code}`
    }),
  ]
}

function meter(label: string, parts: [string, number][], text: string, width: number): string {
  const room = Math.max(1, width - label.length - 2 - text.length)
  let used = 0
  let out = `«6»${label}«b»[`
  for (const [role, share] of parts) {
    const n = Math.min(room - used, Math.round(share * room))
    out += `«${role}»${'|'.repeat(n)}`
    used += n
  }
  return `${out}«»${' '.repeat(room - used)}${text}«b»]`
}

const CPUS: [number, number, number][] = [
  [0.31, 0.07, 0],
  [0.22, 0.02, 0.03],
  [0.04, 0.01, 0],
  [0.52, 0.12, 0],
  [0.1, 0.02, 0],
  [0.41, 0.11, 0],
  [0.02, 0, 0],
  [0.15, 0.03, 0.04],
]

const PROCESSES = [
  '«s»   4127 kec        24   0  412G  612M «s»R  38.2  3.7  3:12.44 node dev.js',
  '   2210 kec        31   0  411G  1.2G «2»R«»  12.0  7.5  1:02.10 «d»/Applications/«b»Ghostty',
  '   3301 kec        31   0  409G   12M S   4.4  0.1  0:05.61 «b»zsh',
  '   3302 kec        31   0  409G  9.8M S   0.0  0.1  0:00.42 «d»├─ «b»nvim «»src/theme.ts',
  '   3310 kec        31   0  410G   88M S   1.2  0.5  0:03.18 «d»│  └─ «b»tsserver',
  '   3402 kec        24   0  409G   21M «2»R«»   0.6  0.1  0:01.02 «d»└─ «b»htop',
  '    501 kec        31  «4»10«»  409G   34M S   0.3  0.2  0:02.77 «b»bun «»test --watch',
  '   1180 kec        31   0  409G   72M «1»D«»   0.0  0.4  0:00.91 «b»rsync «»-a ~/Pictures backup:',
  '    812 «d»root«»       «1» 4 -20«»  410G  1.5G S   3.1  9.4  0:44.02 «d»kernel_task',
  '    167 «d»root«»       31   0  411G  402M S   0.9  2.5  0:12.80 «d»WindowServer',
  '    344 «d»_mdns«»      31   0  408G  5.1M S   0.0  0.0  0:00.33 «d»mDNSResponder',
]

const KEYS = ['Help', 'Setup', 'Search', 'Filter', 'Tree', 'SortBy', 'Nice -', 'Nice +', 'Kill', 'Quit']

function filled(role: string, text: string, width: number): string {
  return `«${role}»${text}${' '.repeat(Math.max(0, width - cells(text)))}`
}

function topLines(width: number): string[] {
  const text = width - 2
  const half = Math.floor((text - 2) / 2)
  const cpu = (i: number) => {
    const [user, system, nice] = CPUS[i] as [number, number, number]
    const total = `${((user + system + nice) * 100).toFixed(1)}%`
    return meter(
      String(i).padStart(3),
      [
        ['2', user],
        ['1', system],
        ['4', nice],
      ],
      total,
      half,
    )
  }
  return [
    ...[0, 1, 2, 3].map((i) => `${cpu(i)}  ${cpu(i + 4)}`),
    `${meter(
      'Mem',
      [
        ['2', 0.45],
        ['4', 0.1],
        ['3', 0.07],
      ],
      '9.84G/16.0G',
      half,
    )}  «6»Tasks: «b»214«», 1093 thr; «B2»4«» running`,
    `${meter('Swp', [['1', 0.15]], '0.31G/2.00G', half)}  «6»Load average: «b»2.14 «»1.87 «d»1.52`,
    `${' '.repeat(half)}  «6»Uptime: «b»3 days, 04:12:55`,
    '',
    filled('K2', '    PID USER      PRI  NI  VIRT   RES S  CPU% MEM%   TIME+  Command', text),
    ...PROCESSES.map((line) =>
      line.startsWith('«s»') ? `${line}${' '.repeat(Math.max(0, text - cells(line.replace(/«[^»]*»/g, ''))))}` : line,
    ),
  ]
}

function keyBar(width: number): string {
  const text = width - 2
  let out = ''
  let used = 0
  KEYS.forEach((label, i) => {
    const key = `F${i + 1}`
    const piece = label.padEnd(6)
    if (used + key.length + piece.length <= text) {
      out += `«»${key}«K6»${piece}`
      used += key.length + piece.length
    }
  })
  return `${out}«K6»${' '.repeat(Math.max(0, text - used))}`
}

function sceneLines(name: string, picked: boolean, width: number): string[] {
  if (name === 'Editor') {
    return editorLines()
  }
  if (name === 'Top') {
    return topLines(width)
  }
  const lines = SCENES.find((s) => s.name === name)?.lines ?? []
  const pick = picked ? PICKS[name] : undefined
  const chosen = pick ? pick.map((i) => lines[i] ?? '') : lines
  return name === 'Shell' ? [...chosen.slice(0, -1), ...COLORTEST, ...chosen.slice(-1)] : chosen
}

function parsed(markup: string[], width: number): Part[][] {
  const lines: Part[][] = []
  for (const text of markup) {
    const parts = sceneParts(text, width)
    if (!parts) {
      continue
    }
    let col = 0
    lines.push(
      parts.map(([t, role]) => {
        const part = { text: t, role, col }
        col += cells(t)
        return part
      }),
    )
  }
  return lines
}

function statusLine(width: number): string {
  const left = '«K4» NORMAL «s» main  src/theme.ts [+] '
  const right = '«K1» 1 «K3» 1 «s» utf-8  typescript  21:28 «K4» 80% '
  const room = width - 2 - cells(left.replace(/«[^»]*»/g, '')) - cells(right.replace(/«[^»]*»/g, ''))
  return `${left}${' '.repeat(Math.max(0, room))}${right}`
}

function footerOf(pane: Pane, width: number): string[] {
  if (pane.id === 'code') {
    return [statusLine(width), '«d»"src/theme.ts" 26L, 912B written']
  }
  return pane.id === 'monitor' ? [keyBar(width)] : []
}

function fitted(pane: Pane, width: number, rows: number): Part[][] {
  const footer = parsed(footerOf(pane, width), width)
  const room = Math.max(0, rows - footer.length)
  let shown: Part[][] = []
  for (const name of [...pane.scenes].reverse()) {
    const whole = parsed(sceneLines(name, false, width), width)
    const picked = parsed(sceneLines(name, true, width), width)
    const next = [whole, picked].find((lines) => shown.length + lines.length <= room)
    if (!next) {
      if (shown.length === 0) {
        shown = pane.tail ? picked.slice(picked.length - room) : picked.slice(0, room)
      }
      break
    }
    shown = [...next, ...shown]
  }
  if (footer.length === 0) {
    return shown
  }
  const filler = parsed(
    Array.from({ length: room - shown.length }, () => (pane.id === 'code' ? '«4»~' : '')),
    width,
  )
  return [...shown, ...filler, ...footer]
}

export function paneLines(tile: Tile): Part[][] {
  const pane = PANES.find((p) => p.id === tile.id)
  return pane ? fitted(pane, tile.width, tile.rows) : []
}

export function paneTiles(width: number, rows: number): Tile[] {
  return PANES.map((pane) => ({ id: pane.id, name: pane.name, col: 0, row: 0, width, rows }))
}

export function footerRows(tile: Tile): number {
  const pane = PANES.find((p) => p.id === tile.id)
  return pane ? footerOf(pane, tile.width).length : 0
}

export function lights(role: string, slot: number): boolean {
  const { text, ground } = slotsOfRole(role)
  return text === slot || ground === slot
}

export function usesOf(layout: Layout, slot: number): { name: string; count: number }[] {
  const box = layout.inner
  return PANES.map((pane) => ({
    name: pane.name,
    count: paneLines({ id: pane.id, name: pane.name, col: box.col, row: box.row, width: box.cols, rows: box.rows })
      .flat()
      .filter((part) => lights(part.role, slot)).length,
  }))
}

export function slotsOfRole(role: string): Slots {
  if (role === 's') {
    return { text: 1, ground: 3 }
  }
  if (role === 'c') {
    return { text: 1, ground: 2 }
  }
  const m = /^([BK]?)(\d+)$/.exec(role)
  if (!m) {
    return { text: 1, ground: 0 }
  }
  const slot = 4 + Number(m[2])
  return m[1] === 'K' ? { text: 4, ground: slot } : { text: slot, ground: 0 }
}

export function usesSlot(role: string, slot: number): boolean {
  if (slot >= 4) {
    const m = /^([BK]?)(\d+)$/.exec(role)
    return m !== null && Number(m[2]) === slot - 4
  }
  return (slot === 3 && role === 's') || (slot === 2 && role === 'c')
}

interface Run {
  spot: Spot
  col: number
  text: string
  role: string
}

function runsOf(layout: Layout): Run[] {
  const out: Run[] = []
  for (const tile of layout.tiles) {
    paneLines(tile).forEach((line, l) => {
      line.forEach((part, r) => {
        out.push({ spot: { pane: tile.id, line: l, run: r }, col: part.col, text: part.text, role: part.role })
      })
    })
  }
  return out
}

function same(a: Spot, b: Spot): boolean {
  return a.pane === b.pane && a.line === b.line && a.run === b.run
}

export function firstSpot(layout: Layout, slot: number): Spot | undefined {
  const runs = runsOf(layout)
  return (runs.find((r) => usesSlot(r.role, slot)) ?? runs[0])?.spot
}

export function validSpot(layout: Layout, spot: Spot | undefined): Spot | undefined {
  return spot && runsOf(layout).find((r) => same(r.spot, spot))?.spot
}

export function moveSpot(
  layout: Layout,
  spot: Spot | undefined,
  way: 'left' | 'right' | 'up' | 'down' | 'next' | 'previous',
): Spot | undefined {
  const runs = runsOf(layout)
  if (runs.length === 0) {
    return undefined
  }
  const at = spot ? runs.findIndex((r) => same(r.spot, spot)) : -1
  if (at < 0) {
    return runs[0]?.spot
  }
  const here = runs[at] as Run
  if (way === 'left' || way === 'right') {
    return runs[(at + (way === 'left' ? runs.length - 1 : 1)) % runs.length]?.spot
  }
  if (way === 'next' || way === 'previous') {
    const panes = layout.tiles.map((t) => t.id)
    const k = panes.indexOf(here.spot.pane)
    const target = panes[(k + (way === 'next' ? 1 : panes.length - 1)) % panes.length]
    return runs.find((r) => r.spot.pane === target)?.spot
  }
  const step = way === 'up' ? -1 : 1
  const inPane = runs.filter((r) => r.spot.pane === here.spot.pane)
  const lines = [...new Set(inPane.map((r) => r.spot.line))]
  const line = lines[lines.indexOf(here.spot.line) + step]
  if (line === undefined) {
    const order = layout.tiles.map((t) => t.id)
    const k = order.indexOf(here.spot.pane) + step
    const target = order[(k + order.length) % order.length]
    const there = runs.filter((r) => r.spot.pane === target)
    const edge = step < 0 ? (there.at(-1)?.spot.line ?? 0) : (there[0]?.spot.line ?? 0)
    const row = there.filter((r) => r.spot.line === edge)
    return (row.find((r) => r.col >= here.col) ?? row.at(-1))?.spot
  }
  const row = inPane.filter((r) => r.spot.line === line)
  const exact = row.find((r) => r.col <= here.col && r.col + cells(r.text) > here.col)
  return (exact ?? row.find((r) => r.col >= here.col) ?? row.at(-1))?.spot
}

export function slotsAt(layout: Layout, spot: Spot): Slots | undefined {
  const run = runsOf(layout).find((r) => same(r.spot, spot))
  return run ? slotsOfRole(run.role) : undefined
}

const JOINTS: Record<string, string> = {
  lr: '─',
  du: '│',
  dr: '╭',
  dl: '╮',
  ru: '╰',
  lu: '╯',
  dlr: '┬',
  lru: '┴',
  dru: '├',
  dlu: '┤',
  dlru: '┼',
}

export function joints(rules: readonly Rule[]): Map<number, Map<number, string>> {
  const ways = new Map<number, Map<number, Set<string>>>()
  const mark = (row: number, col: number, way: string) => {
    const line = ways.get(row) ?? new Map<number, Set<string>>()
    ways.set(row, line)
    const cell = line.get(col) ?? new Set<string>()
    line.set(col, cell)
    cell.add(way)
  }
  for (const rule of rules) {
    for (let i = 0; i < rule.length; i++) {
      const row = rule.down ? rule.row + i : rule.row
      const col = rule.down ? rule.col : rule.col + i
      if (i > 0) {
        mark(row, col, rule.down ? 'u' : 'l')
      }
      if (i < rule.length - 1) {
        mark(row, col, rule.down ? 'd' : 'r')
      }
    }
  }
  const out = new Map<number, Map<number, string>>()
  for (const [row, line] of ways) {
    const drawn = new Map<number, string>()
    for (const [col, cell] of line) {
      const key = [...cell].sort().join('')
      drawn.set(col, JOINTS[key] ?? (cell.has('l') || cell.has('r') ? '─' : '│'))
    }
    out.set(row, drawn)
  }
  return out
}
