import { readFileSync } from 'node:fs'
import columns from 'fast-string-width'
import { BOLD as B, DIM as D, GREEN, LINK, linked, RESET as R, SPINNER, YELLOW } from '../ansi.ts'
import type { Coloring, Framing } from '../backdrop.ts'
import { BLOCKS, type Block, KEY_SPAN, type Kind, type Narrow, type Rating, SITES } from '../booru.ts'
import { type Hex, mix, rgb } from '../color.ts'
import { megabytes, progress } from '../pending.ts'
import { SCENES, sceneAt, sceneParts, WIDE } from '../scenes.ts'
import { POSITIONS } from '../theme.ts'
import { hintKey, type KeySpot, type Zone } from '../tui/zones.ts'

export type Preset = 'cutouts' | 'all'
export type Order = 'fit' | 'newest' | 'score'
export type Sets = 'fold' | 'show'

export type Entry = 'number' | 'text'

export interface Setting {
  name: string
  label: string
  about: string
  choices: string[]
  multi?: { read(raw: string | undefined): string[]; none?: string }
  entry?: Entry
  advanced?: boolean
}

export interface Row {
  label: string
  about: string
  choices: string[]
  value: string
  default: string
  multi?: { none?: string }
  entry?: Entry
  advanced?: boolean
  cursor: number
}

export interface Count {
  site: string
  count?: number
}

export interface Tile {
  id: number
  key: number
  site: string
  siteAnsi: number
  width: number
  height: number
  reduced: boolean
  page: string
  artist: string
  score: number
  variants: number
  mates: string[]
  thumb?: string
  missing?: boolean
}

export type Stage = 'fetch' | 'check'

export interface Shown {
  id: number
  clear: number
  bytes: number
  path: string
  cut: 'on' | 'off' | 'failed' | 'none'
}

export interface Info {
  page: string
  source: string
  link?: string
  artists: string[]
  characters: string[]
  series: string[]
  tags: string[]
  rating?: string
  posted?: string
  ext: string
  uploader: string
}

export type Tuning = Framing

export interface TunePanel {
  field: number
  held: Tuning
  fill: number
  coloring: Coloring
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
  narrow: Narrow
  enabled: string[]
  hide: Kind[]
  hideTags: string[]
  settings: Row[]
  panel?: number
  advanced: boolean
  typing?: string
  counts?: Count[]
  colors: { cursor: Hex; selection: Hex; background: Hex; foreground: Hex; ansi: Hex[] }
  tiles: Tile[]
  installed: number[]
  held: Held[]
  checked: number
  total: number
  searching: boolean
  stage: Stage
  ranking?: { done: number; total: number }
  sites: { name: string; arrived: boolean }[]
  focus: number
  top: number
  scroll: number
  beat: number
  loaderFrom?: number
  mode: 'grid' | 'try'
  help: boolean
  scene: number
  details: boolean
  info?: Info
  tune: Tuning
  untuned: Tuning
  coloring: Coloring
  tuning?: TunePanel
  fetching?: { id: number; got: number; size: number }
  preparing?: number
  cutting?: number
  installing?: number
  shown?: Shown
  editing?: string
  chosen?: string[]
  chips: TagChip[]
  suggest?: { value: string; count: number; palette?: string; alias?: string; whole?: boolean }[]
  pick?: number
  saved?: { text: string; key: number }
  note?: string
  hint?: string
  error?: string
  waiting?: number
  slow?: string
}

export interface TagChip {
  name: string
  on: boolean
}

export interface Held {
  key: string
  id: number
  ansi: number
  page?: string
  up: boolean
  from: string
  thumb?: string
}

export interface Placement {
  id: number
  path: string
  row: number
  col: number
  cols: number
  rows: number
  crop?: number
  z: number
}

export type FindSpot =
  | KeySpot
  | { kind: 'link'; url: string }
  | { kind: 'tile'; index: number }
  | { kind: 'query' }
  | { kind: 'site'; tab: number }
  | { kind: 'chip'; index: number }
  | { kind: 'setting'; index: number }
  | { kind: 'choice'; index: number; choice: string | undefined }
  | { kind: 'suggest'; index: number }
  | { kind: 'field'; field: number }
  | { kind: 'track'; field: number }
  | { kind: 'place'; at: number }
  | { kind: 'scene'; scene: number }

export interface Frame {
  lines: string[]
  images: Placement[]
  zones: Zone[]
  loader: boolean
  tick: boolean
}

export const TILE = { pitch: 25, cols: 22, rows: 9, height: 13 }
export const MIN = { cols: 25, rows: 21 }
export const HELD = { cols: 10, rows: 3, pitch: 12, top: 4 }
export const GRID_TOP = HELD.top + HELD.rows + 1
export const HELD_ID = 2 ** 30
export const TRY_ID = 2 ** 31
const BELOW_BG = -1073741826
const SMALL = 1600
const BAR = 56
const FADE = 4
const SWEEP = 20
const TIP_BEATS = 50
const TIPS: [string, string][] = [
  ['space', 'unfolds a set of ×N'],
  ['o', 'opens the post page in a browser'],
  ['c', 'switches between cutouts and every post'],
  ['a', 'opens the advanced filters'],
  ['1-9', 'turn a tag of the tags row on or off'],
  ['ctrl+v', 'tries on a picture from the clipboard — or drop one on the window'],
]

export function heldFit(cols: number): number {
  return Math.max(0, Math.floor((cols - 1) / HELD.pitch))
}

export function gridShape(cols: number, rows: number): { perRow: number; rowsVis: number; height: number } {
  const height = rows - GRID_TOP - 2
  return {
    perRow: Math.max(1, Math.floor((cols - 1) / TILE.pitch)),
    rowsVis: Math.max(1, Math.floor(height / TILE.height)),
    height,
  }
}

export function transmit(p: Placement, files = true): string | undefined {
  if (files) {
    return `\x1b_Ga=t,t=f,f=100,i=${p.id},q=2;${Buffer.from(p.path).toString('base64')}\x1b\\`
  }
  let data: string
  try {
    data = readFileSync(p.path).toString('base64')
  } catch {
    return undefined
  }
  const chunks = data.match(/.{1,4096}/g) ?? ['']
  return chunks
    .map((chunk, i) => {
      const more = i < chunks.length - 1 ? 1 : 0
      return i === 0 ? `\x1b_Ga=t,f=100,i=${p.id},m=${more},q=2;${chunk}\x1b\\` : `\x1b_Gm=${more},q=2;${chunk}\x1b\\`
    })
    .join('')
}

export function place(p: Placement, cell: { w: number; h: number }): string {
  const crop = p.crop === undefined ? '' : `,x=0,y=${p.crop * cell.h},w=${p.cols * cell.w},h=${p.rows * cell.h}`
  return `\x1b[${p.row + 1};${p.col + 1}H\x1b_Ga=p,i=${p.id},p=${p.id}${crop},c=${p.cols},r=${p.rows},C=1,z=${p.z},q=2\x1b\\`
}

export function unplace(id: number): string {
  return `\x1b_Ga=d,d=i,i=${id},p=${id},q=2\x1b\\`
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

let beating = false

function beat(view: FindView): number {
  beating = true
  return view.beat
}

function spin(view: FindView): string {
  return SPINNER[beat(view) % SPINNER.length] as string
}

function width(text: string): number {
  return columns(text)
}

function clip(text: string, room: number): string {
  if (columns(text) <= room) {
    return text
  }
  let out = ''
  for (const ch of text) {
    if (columns(out + ch) > room) {
      break
    }
    out += ch
  }
  return out
}

type Part = [string, string, string?, FindSpot?]

function siteColor(ansi: number): string {
  return `\x1b[${30 + ansi}m`
}

function reference(text: string, sgr: string, url: string | undefined, mark: string): Part[] {
  return url
    ? [
        [`${LINK} `, mark, undefined, { kind: 'link', url }],
        [text, sgr, url],
      ]
    : [[text, sgr]]
}

function keyed(key: string): KeySpot | undefined {
  const named = hintKey(key)
  return named ? { kind: 'key', key: named } : undefined
}

function partsWidth(parts: readonly Part[]): number {
  return parts.reduce((n, [text]) => n + width(text), 0)
}

function clipParts(parts: readonly Part[], room: number): Part[] {
  const out: Part[] = []
  let left = room
  for (const [text, sgr, link, spot] of parts) {
    const w = width(text)
    if (w <= left) {
      out.push([text, sgr, link, spot])
      left -= w
      continue
    }
    out.push([`${clip(text, left)}…`, sgr, link, spot])
    break
  }
  return out
}

class Line {
  private readonly parts: {
    col: number
    text: string
    sgr: string
    link?: string
    spot?: FindSpot
    hidden?: true
  }[] = []
  private readonly cols: number

  constructor(cols: number) {
    this.cols = cols
  }

  put(col: number, text: string, sgr = '', link?: string, spot?: FindSpot): number {
    this.parts.push({ col, text, sgr, ...(link ? { link } : {}), ...(spot ? { spot } : {}) })
    return col + width(text)
  }

  run(col: number, parts: Part[]): number {
    let c = col
    for (const [text, sgr, link, spot] of parts) {
      c = this.put(c, text, sgr, link, spot)
    }
    return c
  }

  mark(col: number, span: number, spot: FindSpot): void {
    this.parts.push({ col, text: ' '.repeat(Math.max(0, span)), sgr: '', spot, hidden: true })
  }

  zones(row: number): Zone[] {
    return this.parts.flatMap(({ col, text, link, spot }): Zone[] => {
      const target = spot ?? (link ? { kind: 'link', url: link } : undefined)
      const shown = col >= 0 && col < this.cols ? width(clip(text, this.cols - col)) : 0
      return target && shown > 0 ? [{ row, col, width: shown, height: 1, target }] : []
    })
  }

  right(end: number, parts: Part[]): void {
    this.run(end - parts.reduce((n, [text]) => n + width(text), 0), parts)
  }

  center(room: number, parts: Part[]): void {
    this.run(Math.floor((room - parts.reduce((n, [text]) => n + width(text), 0)) / 2), parts)
  }

  render(): string {
    let out = ''
    for (const { col, text, sgr, link, hidden } of this.parts) {
      if (hidden || col >= this.cols || col < 0) {
        continue
      }
      const shown = clip(text, this.cols - col)
      out += `\x1b[${col + 1}G${sgr}${linked(shown, link)}${sgr ? R : ''}`
    }
    return out
  }
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
  lead?: Part[]
  keys?: [string, string][]
  right?: [string, string]
}

function foot(line: Line, cols: number, accent: string, spec: Foot): void {
  const keys = [...(spec.keys ?? [])]
  let lead = spec.lead
  let right = spec.right
  const size = () => {
    const segs = [...(lead ? [partsWidth(lead)] : []), ...keys.map(([k, l]) => width(k) + 1 + width(l))]
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
    lead = clipParts(lead, Math.max(0, partsWidth(lead) - (size() - cols) - 1))
  }
  let c = 0
  if (spec.badge) {
    c = line.put(0, ` ${spec.badge} `, `\x1b[7;1m${accent}`) + 2
  }
  const segs: Part[][] = [
    ...(lead ? [lead] : []),
    ...keys.map(([k, l]): Part[] => [
      [k, B, undefined, keyed(k)],
      [` ${l}`, D, undefined, keyed(k)],
    ]),
  ]
  segs.forEach((seg, i) => {
    c = line.run(c + (i ? 3 : 0), seg)
  })
  if (right) {
    const key = keyed(right[0].split(' ')[0] ?? '')
    line.right(cols, [
      [right[0], B, undefined, key],
      [` ${right[1]}`, D, undefined, key],
    ])
  }
}

function roleSgr(role: string, view: FindView): string {
  if (role === 'd') {
    return D
  }
  if (role === 'b') {
    return B
  }
  if (role === 's') {
    return bg(view.colors.selection)
  }
  if (role === 'c') {
    return bg(view.colors.cursor)
  }
  const m = /^([BK]?)(\d+)$/.exec(role)
  if (!m) {
    return ''
  }
  const n = Number(m[2])
  const code = (base: number): number => (n < 8 ? base + n : base + 52 + n)
  if (m[1] === 'K') {
    return `\x1b[30;${code(40)}m`
  }
  return `\x1b[${m[1] === 'B' ? '1;' : ''}${code(30)}m`
}

function sceneTabs(line: Line | undefined, col: number, room: number, view: FindView, accent: string): void {
  const at = SCENES.indexOf(sceneAt(view.scene))
  const strip = SCENES.flatMap((scene, i): Part[] => [
    ...(i ? ([['  ', '']] as Part[]) : []),
    [scene.name, i === at ? B + accent : D, undefined, { kind: 'scene', scene: i }],
  ])
  const fits = strip.reduce((n, [text]) => n + width(text), 0) <= room
  line?.run(
    col,
    fits
      ? strip
      : [
          [sceneAt(view.scene).name, B + accent],
          [`  ${at + 1}/${SCENES.length}`, D],
        ],
  )
}

function specimen(
  lines: Line[],
  row: number,
  col: number,
  sw: number,
  maxRow: number,
  view: FindView,
  accent: string,
): void {
  const { ansi, cursor } = view.colors
  sceneTabs(lines[row - 2], col, sw, view, accent)
  let cw = sw < WIDE ? 3 : 4
  if (sw >= 56) {
    cw = Math.min(7, Math.floor((sw + 1) / 8) - 1)
  }
  let c = col
  for (let i = 0; i < 8; i++) {
    c = (lines[row]?.put(c, '▀'.repeat(cw), fg(ansi[i] ?? cursor) + bg(ansi[i + 8] ?? cursor)) ?? c) + 1
  }
  let r = row + 2
  for (const text of sceneAt(view.scene).lines) {
    const parts = sceneParts(text, sw)
    if (!parts) {
      continue
    }
    if (r > maxRow) {
      return
    }
    lines[r]?.run(
      col,
      parts.map(([t, role]): Part => [t, roleSgr(role, view)]),
    )
    r++
  }
}

function tagLines(tags: string[], room: number, most: number): string[] {
  const out: string[][] = [[]]
  for (const tag of tags) {
    const line = out[out.length - 1] as string[]
    if (line.length === 0 || width([...line, tag].join('  ')) <= room) {
      line.push(tag)
    } else if (out.length < most) {
      out.push([tag])
    } else {
      break
    }
  }
  let kept = out.reduce((n, line) => n + line.length, 0)
  const last = out[out.length - 1] as string[]
  while (kept < tags.length && last.length > 0 && width([...last, `+${tags.length - kept}`].join('  ')) > room) {
    last.pop()
    kept--
  }
  if (kept < tags.length) {
    last.push(`+${tags.length - kept}`)
  }
  return out.filter((line) => line.length > 0).map((line) => line.join('  '))
}

function bare(url: string): string {
  return url.replace(/^https?:\/\/(?:www\.)?/, '')
}

function credits(lines: Line[], row: number, col: number, view: FindView, accent: string): void {
  const info = view.info
  const artists = info?.artists ?? []
  const site = siteColor(view.tiles[view.focus]?.siteAnsi ?? view.siteAnsi)
  const said: [string, Part[]][] = [
    ['Post', info?.page ? reference(bare(info.page), '', info.page, site) : [['—', D]]],
    ['Source', info?.source ? reference(bare(info.source), '', info.link, accent) : [['—', D]]],
    ['Artist', [artists.length > 0 ? [artists.join('  '), ''] : ['—', D]]],
  ]
  said.forEach(([label, value], i) => {
    lines[row + i]?.put(col, label, D)
    lines[row + i]?.run(col + 12, value)
  })
}

function details(lines: Line[], row: number, col: number, room: number, maxRow: number, view: FindView): void {
  const info = view.info
  const tile = view.tiles[view.focus]
  if (!info || !tile) {
    return
  }
  const shown = view.shown?.id === tile.key ? view.shown : undefined
  const at = col + 12
  const text = Math.max(12, room - 12)
  const file = [
    `${tile.width}×${tile.height}${info.ext ? ` ${info.ext.toUpperCase()}` : ''}`,
    ...(shown ? [megabytes(shown.bytes)] : []),
  ].join(' · ')
  const rated = [info.rating ?? '—', tile.score > 0 ? `★${tile.score}` : '', info.posted ?? '']
    .filter(Boolean)
    .join(' · ')
  const tagRows = (tags: string[], most: number): Part[][] =>
    tags.length > 0 ? tagLines(tags, text, most).map((line): Part[] => [[line, '']]) : [[['—', D]]]
  const said: [string, Part[][]][] = [
    ['Characters', tagRows(info.characters, 2)],
    ['Series', tagRows(info.series, 1)],
    ['Tags', tagRows(info.tags, 3)],
    ['Rating', [[[rated, rated === '—' ? D : '']]]],
    ['File', [[[file, ''], ...(shown ? ([['  ', '']] as Part[]) : []), ...(shown ? transparent(shown) : [])]]],
    ['Uploader', [[info.uploader ? [info.uploader, ''] : ['—', D]]]],
  ]
  let r = row
  for (const [label, values] of said) {
    if (r + values.length - 1 > maxRow) {
      return
    }
    lines[r]?.put(col, label, D)
    for (const parts of values) {
      lines[r]?.run(at, parts)
      r++
    }
  }
}

const TUNE_LABELS = ['Size', 'Position', 'Opacity']
const TUNE_ROWS = [0, 3, 6]

function tunedField(view: FindView, field: number): boolean {
  const { tune, untuned } = view
  return field === 0
    ? tune.size !== untuned.size
    : field === 1
      ? tune.at !== untuned.at
      : tune.opacity !== untuned.opacity
}

function opacityText(opacity: number): string {
  return opacity.toFixed(2)
}

function tunePanel(lines: Line[], r0: number, col: number, end: number, view: FindView, accent: string): void {
  const panel = view.tuning
  if (!panel) {
    return
  }
  const tile = view.tiles[view.focus]
  lines[r0 - 3]?.run(col, [
    [view.palette, B + accent],
    ['  Background', D],
    ...(tile
      ? [
          [' · ', D] as Part,
          ...reference(`${tile.site} ${tile.id}`, D, tile.page || undefined, siteColor(tile.siteAnsi)),
        ]
      : []),
  ])
  const track = Math.max(8, end - col - 21)
  const lo = 20
  const hi = Math.max(100, panel.fill)
  for (const [k, label] of TUNE_LABELS.entries()) {
    const r = r0 + (TUNE_ROWS[k] as number)
    const on = panel.field === k
    const style = on ? B : D
    if (on) {
      lines[r]?.put(col, '▶', accent, undefined, { kind: 'field', field: k })
    }
    lines[r]?.put(col + 2, label, style, undefined, { kind: 'field', field: k })
    let value: string
    if (k === 1) {
      for (let i = 1; i <= 9; i++) {
        const here = i === view.tune.at
        const line = lines[r0 + 2 + Math.floor((i - 1) / 3)]
        const at = col + 12 + ((i - 1) % 3) * 3
        line?.mark(at - 1, 3, { kind: 'place', at: i })
        line?.put(at, here ? '■' : '·', here ? B + accent : D)
      }
      value = POSITIONS[view.tune.at - 1] ?? 'center'
    } else {
      let knob: number
      if (k === 0) {
        const { size } = view.tune
        knob = size === 'fill' ? track - 1 : Math.floor(((size - lo) * (track - 1)) / (hi - lo + 1))
        value = size === 'fill' ? 'fill' : `${size}%`
      } else {
        knob = Math.floor((Math.round(view.tune.opacity * 100) * (track - 1)) / 100)
        value = opacityText(view.tune.opacity)
      }
      knob = Math.max(0, Math.min(track - 1, knob))
      lines[r]?.run(col + 12, [
        ['━'.repeat(knob), accent],
        ['●', B],
        ['─'.repeat(track - 1 - knob), D],
      ])
      lines[r]?.mark(col + 12, track, { kind: 'track', field: k })
    }
    lines[r]?.right(end - 2, [[value, style]])
    if (tunedField(view, k)) {
      lines[r]?.put(end - 1, '↺', on ? B + accent : D)
    }
  }
}

function frameBox(lines: (Line | undefined)[], r0: number, c0: number, h: number, w: number, sgr: string): void {
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

function mention(text: string, key: number, sgr: string): Part[] {
  const site = SITES[Math.floor(key / KEY_SPAN)]
  const ref = named(key)
  const at = text.indexOf(ref)
  if (!site || at === -1) {
    return [[text, sgr]]
  }
  const parts: Part[] = [
    [text.slice(0, at), sgr],
    ...reference(ref, sgr, site.pageUrl(key % KEY_SPAN), siteColor(site.ansi)),
    [text.slice(at + ref.length), sgr],
  ]
  return parts.filter(([part]) => part !== '')
}

function tabs(line: Line, cols: number, view: FindView): void {
  const strip = [{ name: 'all', moved: false }, ...SITES].flatMap((site, i): Part[] => {
    const label = `${site.name}${site.moved ? '*' : ''}`
    const [text, sgr] = site.name === view.site ? badge(view, label) : [` ${label} `, D]
    const tab: Part = [text, sgr, undefined, { kind: 'site', tab: i }]
    return i ? [[' ', ''], tab] : [tab]
  })
  const fits = strip.reduce((n, [text]) => n + width(text), 0) <= cols
  line.run(0, fits ? strip : [badge(view)])
}

function tagRow(line: Line, cols: number, view: FindView, accent: string): void {
  if (view.chips.length === 0) {
    return
  }
  const parts: Part[] = [['tags ', D]]
  let used = width('tags ')
  let left = view.chips.length
  for (const [i, chip] of view.chips.entries()) {
    const text = ` ${i + 1} ${chip.name} `
    if (used + width(text) + 1 > cols - 2) {
      break
    }
    parts.push([text, chip.on ? `\x1b[7m${accent}` : D, undefined, { kind: 'chip', index: i }], [' ', ''])
    used += width(text) + 1
    left--
  }
  if (left > 0) {
    parts.push([`+${left}`, D])
  }
  line.run(0, parts)
}

function shelf(lines: Line[], images: Placement[], cols: number, view: FindView, accent: string): void {
  lines[GRID_TOP - 1]?.put(0, '─'.repeat(cols - 1), D)
  const head = lines[HELD.top - 1] as Line
  const fit = heldFit(cols)
  const shown = view.held.length > fit ? Math.max(0, fit - 1) : view.held.length
  for (const [i, held] of view.held.slice(0, shown).entries()) {
    const x = i * HELD.pitch
    const sgr = held.up ? B : ''
    head.run(
      x + 1,
      held.page
        ? reference(String(held.id), sgr, held.page, siteColor(held.ansi))
        : [
            ['● ', siteColor(held.ansi)],
            [String(held.id), sgr],
          ],
    )
    if (held.up) {
      for (let r = 0; r < HELD.rows; r++) {
        lines[HELD.top + r]?.put(x, '▌', accent)
      }
    }
    if (held.thumb) {
      images.push({
        id: HELD_ID + i,
        path: held.thumb,
        row: HELD.top,
        col: x + 1,
        cols: HELD.cols,
        rows: HELD.rows,
        z: -1,
      })
    }
  }
  if (shown < view.held.length) {
    head.put(shown * HELD.pitch + 1, `+${view.held.length - shown}`, D)
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
      view.editing ? hint : `  A tag, a post URL or an id, or drop a picture or ctrl+v — ${view.tag || 'esc leaves'}`,
      D,
    )
    return
  }
  const c = line.run(0, [
    ['⌕ ', accent, undefined, { kind: 'query' }],
    [view.tag || 'Nothing yet — / searches, ctrl+v pastes a picture', view.tag ? '' : D, undefined, { kind: 'query' }],
  ])
  const allowed = BLOCKS.filter((block) => !view.block.includes(block))
  const skipped = SITES.filter((site) => !view.enabled.includes(site.name)).map((site) => site.name)
  const state = [
    view.preset,
    ...(view.solo ? ['solo'] : []),
    view.order,
    ...(view.rating.join('+') === 'safe' ? [] : [view.rating.join('+')]),
    ...(allowed.length > 0 ? [`allows ${allowed.join('+')}`] : []),
    ...(view.narrow.size > 0 ? [`≥${view.narrow.size}px`] : []),
    ...(view.narrow.score > 0 ? [`score≥${view.narrow.score}`] : []),
    ...(view.narrow.png ? ['png'] : []),
    ...(view.hide.length + view.hideTags.length > 0 ? [`hides ${[...view.hide, ...view.hideTags].join('+')}`] : []),
    ...(skipped.length > 0 ? [`all skips ${skipped.join('+')}`] : []),
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
    return [[`Cut out · ${shown.clear}% transparent`, GREEN]]
  }
  if (shown.cut === 'off') {
    return [['Opaque · x cuts out', YELLOW]]
  }
  if (shown.cut === 'failed') {
    return [['Opaque · no cut-out', YELLOW]]
  }
  return [shown.clear > 0 ? [`${shown.clear}% transparent`, GREEN] : ['Opaque', YELLOW]]
}

function where(view: FindView): string {
  return view.site === 'all' ? 'any site' : view.site
}

function status(view: FindView, loading?: Part): Part[] | undefined {
  if (view.installing !== undefined) {
    return mention(`${spin(view)} Installing ${view.palette} ← ${named(view.installing)}`, view.installing, YELLOW)
  }
  if (view.hint) {
    return [[view.hint, GREEN]]
  }
  if (view.error) {
    return [[view.error, YELLOW]]
  }
  if (view.waiting !== undefined) {
    return [[`${view.slow ?? view.site} asked to slow down · ${view.waiting}s`, YELLOW]]
  }
  if (view.fetching) {
    const { id, got, size } = view.fetching
    return mention(`${spin(view)} Fetching ${named(id)} · ${progress(got, size)}`, id, YELLOW)
  }
  if (view.cutting !== undefined) {
    return mention(`${spin(view)} Cutting out ${named(view.cutting)}`, view.cutting, YELLOW)
  }
  if (view.preparing !== undefined) {
    return mention(`${spin(view)} Preparing ${named(view.preparing)}`, view.preparing, YELLOW)
  }
  if (loading) {
    return [loading]
  }
  if (view.saved) {
    return mention(view.saved.text, view.saved.key, GREEN)
  }
  if (view.note) {
    return [[view.note, D]]
  }
  return undefined
}

function stageLabel(view: FindView): string {
  if (view.ranking) {
    return 'Ranking previews by palette colors'
  }
  if (view.stage === 'check') {
    return view.preset === 'cutouts' ? 'Checking PNG headers' : 'Loading previews'
  }
  return 'Fetching posts'
}

function stageCount(view: FindView, gap: string): string {
  return view.ranking ? `${gap}${view.ranking.done}/${view.ranking.total}` : ''
}

function bar(line: Line | undefined, x: number, w: number, view: FindView, k: number): void {
  const { background, cursor, selection } = view.colors
  const { ranking } = view
  const fillTo = ranking ? Math.round((w * ranking.done) / ranking.total) : -1
  const seg = Math.max(6, Math.round(w * 0.22))
  const u = (beat(view) % (SWEEP * 2)) / SWEEP
  const from = Math.round((w - seg) * (0.5 - 0.5 * Math.cos(Math.PI * (u < 1 ? u : 2 - u))))
  const on = mix(background, cursor, k)
  const off = mix(background, mix(selection, background, 0.15), k)
  const cells = Array.from({ length: w }, (_, i) => {
    const color = (fillTo >= 0 ? i < fillTo : i >= from && i < from + seg) ? on : off
    return i === 0 || i === w - 1 ? mix(color, background, 0.55) : color
  })
  let start = 0
  for (let i = 1; i <= w; i++) {
    if (i === w || cells[i] !== cells[start]) {
      line?.put(x + start, ' '.repeat(i - start), bg(cells[start] as Hex))
      start = i
    }
  }
}

function loader(lines: (Line | undefined)[], top: number, height: number, room: number, view: FindView): void {
  const { background, foreground } = view.colors
  const k = view.loaderFrom === undefined ? 0 : Math.min(1, (beat(view) - view.loaderFrom) / FADE)
  const row0 = top + (height >= 5 ? Math.floor((height - 5) / 2) : 0)
  lines[row0]?.center(room, [
    [stageLabel(view), B + fg(mix(background, foreground, k))],
    [stageCount(view, '  '), fg(mix(background, mix(foreground, background, 0.45), k))],
  ])
  const w = Math.min(BAR, room - 8)
  bar(lines[row0 + (height >= 3 ? 2 : 1)], Math.floor((room - w) / 2), w, view, k)
  if (height < 5) {
    return
  }
  lines[row0 + 4]?.center(
    room,
    view.sites.flatMap(({ name, arrived }, i): Part[] => [
      ...(i ? ([['  ·  ', fg(mix(background, foreground, 0.25 * k))]] as Part[]) : []),
      [name, fg(mix(background, arrived ? mix(foreground, background, 0.2) : foreground, arrived ? k : 0.32 * k))],
    ]),
  )
}

function rail(lines: Line[], cols: number, view: FindView, height: number, content: number, accent: string): void {
  if (content <= height) {
    return
  }
  const size = Math.max(1, Math.round((height * height) / content))
  const at = Math.max(0, Math.min(height - size, Math.round((view.scroll * height) / content)))
  for (let r = 0; r < height; r++) {
    const on = r >= at && r < at + size
    lines[GRID_TOP + r]?.put(cols - 1, on ? '┃' : '│', on ? accent : D)
  }
}

function loading(view: FindView, waiting: boolean, shown: Tile[]): Part | undefined {
  if (waiting) {
    return [`${spin(view)} ${stageLabel(view)}${stageCount(view, ' · ')}`, D]
  }
  const due = shown.filter((tile) => !tile.missing)
  const ready = due.filter((tile) => tile.thumb).length
  return ready < due.length ? [`${spin(view)} Loading thumbnails · ${ready}/${due.length}`, D] : undefined
}

function grid(
  lines: Line[],
  images: Placement[],
  tiles: Zone[],
  cols: number,
  rows: number,
  view: FindView,
  accent: string,
): boolean {
  const { perRow, rowsVis, height } = gridShape(cols, rows)
  query(lines[0] as Line, cols, view, accent)
  tabs(lines[1] as Line, cols, view)
  tagRow(lines[2] as Line, cols, view, accent)
  shelf(lines, images, cols, view, accent)
  const inside = lines.map((line, r) => (r >= GRID_TOP && r < GRID_TOP + height ? line : undefined))
  const first = Math.floor(view.scroll / TILE.height)
  const last = Math.floor((view.scroll + height - 1) / TILE.height)
  const shown: Tile[] = []
  for (let t = first; t <= last; t++) {
    const r0 = GRID_TOP + t * TILE.height - view.scroll
    for (let c = 0; c < perRow; c++) {
      const i = t * perRow + c
      const c0 = c * TILE.pitch
      const tile = view.tiles[i]
      if (!tile) {
        continue
      }
      shown.push(tile)
      const seen = Math.max(r0, GRID_TOP)
      const ends = Math.min(r0 + TILE.height, GRID_TOP + height)
      if (ends > seen) {
        tiles.push({
          row: seen,
          col: c0,
          width: TILE.pitch - 1,
          height: ends - seen,
          target: { kind: 'tile', index: i },
        })
      }
      const on = i === view.focus
      if (on) {
        frameBox(inside, r0, c0, TILE.height, TILE.pitch - 1, accent)
      }
      const top = r0 + 1
      const from = Math.max(top, GRID_TOP)
      const to = Math.min(top + TILE.rows, GRID_TOP + height)
      if (tile.thumb && to > from) {
        images.push({
          id: tile.key,
          path: tile.thumb,
          row: from,
          col: c0 + 1,
          cols: TILE.cols,
          rows: to - from,
          ...(to - from < TILE.rows ? { crop: from - top } : {}),
          z: -1,
        })
      }
      const row: Part[] = [
        ...(view.installed.includes(tile.key) ? ([['✓ ', GREEN]] as Part[]) : []),
        ...(tile.page || view.site !== 'all'
          ? reference(String(tile.id), on ? B : '', tile.page || undefined, siteColor(tile.siteAnsi))
          : ([
              ['● ', siteColor(tile.siteAnsi)],
              [String(tile.id), on ? B : ''],
            ] as Part[])),
        [' ', ''],
        dims(tile),
      ]
      const room = TILE.cols - (tile.mates.length > 0 ? 1 : 0)
      inside[r0 + 10]?.run(
        c0 + 1,
        partsWidth(row) > room ? row.map(([text, sgr, link]): Part => [text.replace(/^(\S) $/, '$1'), sgr, link]) : row,
      )
      if (tile.mates.length > 0) {
        inside[r0 + 10]?.put(c0 + TILE.cols, '≈', accent)
      }
      inside[r0 + 11]?.put(c0 + 1, tile.artist ? plain(tile.artist).slice(0, TILE.cols - 8) : '—', D)
      const marks: Part[] = []
      if (tile.score > 0) {
        marks.push([`★${tile.score}`, D])
      }
      if (tile.variants > 1) {
        marks.push([` ×${tile.variants}`, accent])
      }
      if (marks.length > 0) {
        inside[r0 + 11]?.right(c0 + TILE.cols + 1, marks)
      }
    }
  }
  const filled = Math.ceil(view.tiles.length / perRow) * TILE.height
  rail(lines, cols, view, height, filled, accent)
  const below = Math.max(GRID_TOP, GRID_TOP + filled - view.scroll)
  const room = GRID_TOP + height - below
  const waiting = view.searching && room >= 2
  if (waiting) {
    loader(inside, below, room, cols - 1, view)
  }
  const quiet = view.searching && view.tiles.length === 0
  if (quiet && !view.error) {
    const [key, label] = TIPS[Math.floor(beat(view) / TIP_BEATS) % TIPS.length] as [string, string]
    lines[rows - 2]?.run(0, [
      ['Tip  ', D],
      [key, B],
      [` ${label}`, D],
    ])
  }
  const above = view.top * perRow
  const more = view.tiles.length - (view.top + rowsVis) * perRow
  const scroll = [...(above > 0 ? [`↑ ${above} above`] : []), ...(more > 0 ? [`↓ ${more} more`] : [])]
  if (scroll.length > 0) {
    lines[rows - 2]?.put(0, scroll.join('   '), D)
  }
  if (!view.searching && view.tiles.length === 0 && !view.error && view.tag) {
    lines[GRID_TOP + 1]?.put(
      0,
      view.preset === 'cutouts'
        ? `No transparent cutouts of ${view.tag} on ${where(view)} — c searches every post, tab tries ${view.nextSite}`
        : `No posts of ${view.tag} on ${where(view)} — tab tries ${view.nextSite}`,
      D,
    )
  }
  const stage = loading(view, waiting, shown)
  const lead = status(view, stage)
  foot(lines[rows - 1] as Line, cols, accent, {
    badge: 'IMAGE SEARCH',
    lead,
    keys:
      quiet && lead?.[0] === stage
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
    right: ['esc', 'back'],
  })
  return waiting
}

function trial(lines: Line[], images: Placement[], cols: number, rows: number, view: FindView, accent: string): void {
  const tile = view.tiles[view.focus]
  if (!tile) {
    return
  }
  const shown = view.shown?.id === tile.key ? view.shown : undefined
  const meta: Part[] = [
    badge(view, tile.site, tile.siteAnsi),
    ['  ', ''],
    ...reference(String(tile.id), B, tile.page || undefined, siteColor(tile.siteAnsi)),
    ['  ', ''],
    dims(tile),
  ]
  if (tile.score > 0) {
    meta.push([` · ★${tile.score}`, D])
  }
  if (shown) {
    meta.push([` · ${megabytes(shown.bytes)}`, D])
  }
  if (shown) {
    meta.push(['  ', ''], ...transparent(shown))
    if (view.coloring === 'original') {
      meta.push([' · own colors', D])
    }
  }
  lines[0]?.run(0, meta)
  if (tile.mates.length > 0) {
    lines[0]?.right(cols, [
      ['≈ ', accent],
      [tile.mates.join(' '), D],
    ])
  }
  credits(lines, 1, 2, view, accent)
  if (view.tuning) {
    tunePanel(lines, 8, 2, 2 + Math.min(cols - 4, 60), view, accent)
  } else if (view.details) {
    details(lines, 5, 2, Math.min(cols - 4, Math.max(48, Math.floor(cols * 0.55))), rows - 2, view)
  } else {
    specimen(lines, 7, 2, cols - 4, rows - 2, view, accent)
  }
  if (view.shown) {
    images.push({ id: TRY_ID + view.shown.id, path: view.shown.path, row: 0, col: 0, cols, rows, z: BELOW_BG })
  }
  if (view.tuning) {
    foot(lines[rows - 1] as Line, cols, accent, {
      badge: 'IMAGE EDIT',
      lead: status(view),
      keys: [
        ['↑↓', 'field'],
        ['←→', 'step'],
        ['=', 'reset'],
        ['+', 'reset all'],
        view.tuning.field === 1 ? ['1-9', 'place'] : ['⇧←→', '×10'],
        ['c', 'colors'],
        ['enter', 'keep'],
      ],
      right: ['esc', 'undo'],
    })
    return
  }
  const lead = status(view)
  foot(lines[rows - 1] as Line, cols, accent, {
    badge: 'IMAGE PREVIEW',
    lead,
    keys:
      view.installing === undefined
        ? [
            ['←→', 'browse'],
            ['enter', 'install'],
            ['t', 'tune'],
            ['c', 'colors'],
            ['i', 'details'],
            ...(view.details ? [] : [['⇧←→', 'example'] as [string, string]]),
            ...(view.shown?.cut === 'on' || view.shown?.cut === 'off' ? [['x', 'cut out'] as [string, string]] : []),
            ['?', 'keys'],
          ]
        : [],
    right: view.installing === undefined ? ['esc', 'grid'] : undefined,
  })
}

const TUNE_KEYS: [string, string][] = [
  ['Field', '↑↓  size, position, opacity'],
  ['Step', '←→  ·  ⇧←→ ×10'],
  ['Place', '1-9  the nine positions'],
  ['Reset', '=  this field back to its default  ·  +  every field'],
  ['Colors', "c  the palette's tone or its own colors, opacity back to its default"],
  ['Keep', 'enter  back to try, installed with the picture'],
  ['Undo', 'esc'],
  ['Close', '?  esc'],
]

const KEYS: Record<FindView['mode'], [string, string][]> = {
  grid: [
    ['Move', '←↑↓→  j k  home  end  pgup  pgdn'],
    ['Try on', 'enter'],
    ['Site', `tab  shift+tab  all, ${SITES.map((site) => site.name).join(', ')}`],
    ['Posts', 'c  cutouts or every post'],
    ['Search', '/  a tag, a post URL or an id'],
    ['Tags', "1-9  turn a tag of the tags row on or off — the palette's own, then danbooru's related characters"],
    ['Your own', 'ctrl+v or v  a picture from the clipboard · drop one on the window or paste its link'],
    ['Unfold', 'space  a set of ×N'],
    ['Open', 'o  the post page in a browser'],
    ['Settings', 's  rating, block, posts, solo, order, sets, remove bg'],
    ['Advanced', 'a or Advanced › in settings  min score, min size, sites, hide, hide tags, PNG only'],
    ['Back', 'esc returns to preview'],
    ['Close', '?  esc'],
  ],
  try: [
    ['Browse', '←→'],
    ['Install', 'enter'],
    ['Tune', 't  size, position and opacity, installed with the picture'],
    ['Colors', "c  the palette's tone or its own colors, installed with the picture"],
    ['Details', 'i  characters, series, tags, rating and file, under Post, Source and Artist'],
    ['Example', `⇧←→  ${SCENES.map((scene) => scene.name.toLowerCase()).join(', ')}`],
    ['Cut out', 'x  the background off or on, on an opaque picture'],
    ['Open', 'o  the post page in a browser'],
    ['Your own', 'ctrl+v or v  a picture from the clipboard · drop one on the window'],
    ['Grid', 'esc'],
    ['Close', '?  esc'],
  ],
}

export const DIGITS = 6
const TEXT_ROOM = 24

export function pageOf(view: Pick<FindView, 'settings' | 'advanced'>): number[] {
  return [
    ...view.settings.flatMap((row, i) => (Boolean(row.advanced) === view.advanced ? [i] : [])),
    view.settings.length,
  ]
}

function lowered(label: string): string {
  return label.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())
}

function pageAbout(view: Pick<FindView, 'settings' | 'advanced'>): string {
  const names = view.settings.filter((row) => Boolean(row.advanced) !== view.advanced).map((row) => lowered(row.label))
  return `${view.advanced ? 'Back to' : 'More filters:'} ${names.join(', ')} — enter opens the page, or a from any row`
}

export function stepped(choices: readonly string[], value: string, step: 1 | -1): string {
  const at = choices.indexOf(value)
  if (at !== -1) {
    return choices[(at + step + choices.length) % choices.length] as string
  }
  const n = Number(value) || 0
  const next =
    step > 0 ? choices.find((c) => (Number(c) || 0) > n) : [...choices].reverse().find((c) => (Number(c) || 0) < n)
  return next ?? (choices[step > 0 ? 0 : choices.length - 1] as string)
}

export function wrapped(text: string, room: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && width(line) + 1 + width(word) > room) {
      out.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  return line ? [...out, line] : out
}

interface Chip {
  text: string
  sgr: string
  choice?: string
}

function ordered(row: Row): string[] {
  if (row.entry !== 'number' || row.choices.includes(row.value)) {
    return row.choices
  }
  const at = row.choices.findIndex((choice) => (Number(choice) || 0) > Number(row.value))
  return at === -1 ? [...row.choices, row.value] : [...row.choices.slice(0, at), row.value, ...row.choices.slice(at)]
}

function chips(row: Row, focused: boolean, typing: string | undefined, ansi: number): Chip[] {
  const lit = `\x1b[7;${30 + ansi}m`
  const typed = focused && typing !== undefined
  if (row.entry === 'text') {
    const text = typed ? `${typing}█` : row.value || 'none'
    return [{ text: ` ${text} `, sgr: typed || (focused && row.value) ? lit : row.value ? '' : D }]
  }
  const on = typed ? [] : row.value.split(' ')
  const out = (typed ? row.choices : ordered(row)).map((choice, k): Chip => {
    const shown = on.includes(choice)
    const under = row.multi && focused && k === row.cursor ? '4;' : ''
    return {
      text: row.multi ? ` ${shown ? '[x]' : '[ ]'} ${choice} ` : ` ${choice} `,
      sgr: shown ? (focused ? `\x1b[${under}7;${30 + ansi}m` : '') : under ? `\x1b[4m${D}` : D,
      choice,
    }
  })
  return typed ? [...out, { text: ` ${typing}█ `, sgr: lit }] : out
}

function widest(row: Row): Chip[] {
  if (row.entry === 'text') {
    return [{ text: ' '.repeat(TEXT_ROOM), sgr: '' }]
  }
  const all = row.choices.map((choice) => ({ text: row.multi ? ` [x] ${choice} ` : ` ${choice} `, sgr: '' }))
  return row.entry === 'number' ? [...all, { text: ` ${'0'.repeat(DIGITS)}█ `, sgr: '' }] : all
}

function span(list: Chip[]): number {
  return list.reduce((n, chip) => n + width(chip.text) + 1, 0) - 1
}

function pack(list: Chip[], room: number): Chip[][] {
  const packed: Chip[][] = [[]]
  let used = 0
  for (const chip of list) {
    const shown =
      width(chip.text) > room
        ? {
            ...chip,
            text: ` …${Array.from(chip.text)
              .slice(-(room - 2))
              .join('')}`,
          }
        : chip
    if (used > 0 && used + width(shown.text) > room) {
      packed.push([])
      used = 0
    }
    packed[packed.length - 1]?.push(shown)
    used += width(shown.text) + 1
  }
  return packed
}

function standard(row: Row): string {
  if (row.multi && row.choices.every((choice) => row.default.split(' ').includes(choice))) {
    return 'Default all'
  }
  return `Default ${row.default && row.default !== row.multi?.none ? row.default : 'none'}`
}

function tally(view: FindView): string {
  if (!view.tag) {
    return ''
  }
  if (!view.counts) {
    return `${view.tag}: counting…`
  }
  const each = view.counts.map(
    ({ site, count }) => `${site} ${count === undefined ? 'no count' : count.toLocaleString('en-US')}`,
  )
  return `${view.tag}: ${each.join(' · ')}`
}

function panelKeys(view: FindView, row: Row | undefined): { keys: [string, string][]; right: [string, string] } {
  const page = view.advanced ? 'basic' : 'advanced'
  if (!row) {
    return {
      keys: [
        ['↑↓', 'setting'],
        ['enter', page],
        ['s', 'save'],
      ],
      right: ['esc', 'undo'],
    }
  }
  if (view.typing !== undefined) {
    return {
      keys: [
        ['⌫', 'erase'],
        ['enter', 'done'],
      ],
      right: ['esc', 'cancel'],
    }
  }
  if (row.entry) {
    return {
      keys: [
        ['↑↓', 'setting'],
        ...(row.entry === 'number' ? ([['←→', 'step']] as [string, string][]) : []),
        ['a', page],
        ['enter', 'type'],
        ['s', 'save'],
      ],
      right: ['esc', 'undo'],
    }
  }
  return {
    keys: [
      ['↑↓', 'setting'],
      ['←→', 'value'],
      ['a', page],
      ...(row.multi ? ([['space', 'toggle']] as [string, string][]) : []),
      ['enter', 'save'],
    ],
    right: ['esc', 'undo'],
  }
}

function panel(lines: Line[], cols: number, rows: number, view: FindView, accent: string): void {
  const at = view.panel ?? 0
  const link = view.settings.length
  const label = Math.max(...view.settings.map((row) => width(row.label)))
  const lead = 6 + label
  const said = Math.max(...view.settings.map((row) => width(standard(row))))
  const need = lead + Math.max(...view.settings.map((row) => span(widest(row)))) + said + 5
  const w = Math.min(cols - 2, Math.max(48, need))
  const room = w - lead - said - 5
  const text = w - 7
  const pages = [false, true].map((advanced) => ({
    advanced,
    rows: pageOf({ settings: view.settings, advanced }).slice(0, -1),
  }))
  const held = view.settings.map((row) => pack(widest(row), room).length)
  const body = Math.max(...pages.map((page) => page.rows.reduce((n, i) => n + (held[i] as number), 0)))
  const aboutRoom = Math.max(
    ...pages.map((page) => wrapped(pageAbout({ settings: view.settings, advanced: page.advanced }), text).length),
    ...view.settings.map((row) => wrapped(row.about, text).length),
  )
  const worst = `${view.tag}: ${SITES.map((site) => `${site.name} 0,000,000`).join(' · ')}`
  const countRoom = view.tag ? Math.max(wrapped(worst, text).length, wrapped(tally(view), text).length) : 0
  const h = body + aboutRoom + countRoom + 8
  const x = Math.floor((cols - w) / 2)
  const y = Math.max(1, Math.floor((rows - 1 - h) / 2))
  const lit = `\x1b[7;${30 + view.siteAnsi}m`
  lines[y]?.put(x, `╭─ Settings ${'─'.repeat(Math.max(0, w - 13))}╮`)
  for (let r = y + 1; r < y + h - 1; r++) {
    lines[r]?.put(x, `│${' '.repeat(w - 2)}│`)
  }
  let r = y + 2
  for (const i of pageOf(view).slice(0, -1)) {
    const row = view.settings[i] as Row
    const focused = i === at
    if (focused) {
      lines[r]?.put(x + 2, '▶', accent)
    }
    lines[r]?.mark(x + 2, lead - 3, { kind: 'setting', index: i })
    lines[r]?.put(x + 4, row.label, focused ? B : '')
    if (row.value !== row.default) {
      lines[r]?.right(x + w - 3, [[standard(row), D]])
    }
    pack(chips(row, focused, view.typing, view.siteAnsi), room).forEach((chipLine, k) => {
      let col = x + lead
      for (const chip of chipLine) {
        col = (lines[r + k] as Line).put(col, chip.text, chip.sgr, undefined, {
          kind: 'choice',
          index: i,
          choice: chip.choice,
        })
        col += 1
      }
    })
    r += held[i] as number
  }
  const other = pages.find((page) => page.advanced !== view.advanced)?.rows ?? []
  const linkLine = lines[y + 3 + body] as Line
  if (at === link) {
    linkLine.put(x + 2, '▶', accent)
  }
  const end = linkLine.put(x + 3, view.advanced ? ' ‹ Basic ' : ' Advanced › ', at === link ? lit : B, undefined, {
    kind: 'setting',
    index: link,
  })
  if (other.some((i) => view.settings[i]?.value !== view.settings[i]?.default)) {
    linkLine.put(end + 1, '•', D)
  }
  lines[y + 5 + body]?.put(x + 2, '─'.repeat(w - 4), D)
  wrapped(view.settings[at]?.about ?? pageAbout(view), text).forEach((line, k) => {
    lines[y + 6 + body + k]?.put(x + 4, line)
  })
  wrapped(tally(view), text).forEach((line, k) => {
    lines[y + 6 + body + aboutRoom + k]?.put(x + 4, line, D)
  })
  lines[y + h - 1]?.put(x, `╰${'─'.repeat(w - 2)}╯`)
  const { keys, right } = panelKeys(view, view.settings[at])
  foot(lines[rows - 1] as Line, cols, accent, { keys, right })
}

function help(lines: Line[], cols: number, rows: number, view: FindView, accent: string): void {
  const keys = view.tuning ? TUNE_KEYS : KEYS[view.mode]
  const w = Math.min(cols - 2, Math.max(50, ...keys.map(([, value]) => width(value) + 16)))
  const laid = keys.map(([label, value]) => ({ label, parts: wrapped(value, w - 16) }))
  const h = laid.reduce((n, { parts }) => n + parts.length, 0) + 4
  const x = Math.floor((cols - w) / 2)
  const y = Math.max(2, Math.floor((rows - h) / 2))
  lines[y]?.put(x, `╭─ Help ${'─'.repeat(w - 9)}╮`)
  for (let r = y + 1; r < y + h - 1; r++) {
    lines[r]?.put(x, `│${' '.repeat(w - 2)}│`)
  }
  let r = y + 2
  for (const { label, parts } of laid) {
    lines[r]?.put(x + 3, label, B)
    for (const part of parts) {
      lines[r]?.put(x + 13, part)
      r++
    }
  }
  lines[y + h - 1]?.put(x, `╰${'─'.repeat(w - 2)}╯`)
  foot(lines[rows - 1] as Line, cols, accent, { badge: 'HELP', right: ['? esc', 'close'] })
}

function suggestions(lines: Line[], view: FindView, accent: string): void {
  const list = view.suggest ?? []
  const said = list.map((item) => item.alias ?? (item.count > 0 ? String(item.count) : (item.palette ?? '0')))
  const wide = Math.max(...list.map((item) => width(item.value)))
  const note = Math.max(7, ...said.map(width))
  list.forEach((item, i) => {
    const on = i === view.pick
    const line = lines[1 + i]
    line?.run(0, [
      [on ? '▸ ' : '  ', accent, undefined, { kind: 'suggest', index: i }],
      [item.value, on ? B + accent : '', undefined, { kind: 'suggest', index: i }],
    ])
    line?.right(2 + wide + 2 + note, [[said[i] as string, D]])
  })
}

function zonesOf(lines: Line[], under: Zone[] = []): Zone[] {
  return [...under, ...lines.flatMap((line, row) => line.zones(row))]
}

export function renderFind(view: FindView, cols: number, rows: number): Frame {
  const lines = Array.from({ length: rows }, () => new Line(cols))
  const images: Placement[] = []
  const tiles: Zone[] = []
  const accent = fg(view.colors.cursor)
  beating = false
  if (cols < MIN.cols || rows < MIN.rows) {
    lines[0]?.put(0, 'ttheme find', B + accent)
    lines[1]?.put(0, `Needs ${MIN.cols}×${MIN.rows} — now ${cols}×${rows}`)
    lines[2]?.put(0, 'esc quits', D, undefined, { kind: 'key', key: 'esc' })
    return { lines: lines.map((l) => l.render()), images, zones: zonesOf(lines), loader: false, tick: false }
  }
  let waiting = false
  if (view.mode === 'try') {
    trial(lines, images, cols, rows, view, accent)
  } else {
    waiting = grid(lines, images, tiles, cols, rows, view, accent)
  }
  if (view.mode === 'grid' && view.editing !== undefined && view.suggest?.length) {
    for (let r = 1; r < rows - 1; r++) {
      lines[r] = new Line(cols)
    }
    suggestions(lines, view, accent)
    return { lines: lines.map((l) => l.render()), images: [], zones: zonesOf(lines), loader: false, tick: false }
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
    return { lines: lines.map((l) => l.render()), images: keep, zones: zonesOf(lines), loader: false, tick: false }
  }
  return {
    lines: lines.map((l) => l.render()),
    images,
    zones: zonesOf(lines, tiles),
    loader: waiting,
    tick: beating,
  }
}
