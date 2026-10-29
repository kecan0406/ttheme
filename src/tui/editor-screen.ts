import { type Hex, type Oklch, oklch, rgb } from '../core/color.ts'
import { brightDrift, confusions, hueGap, lookalikes, offRole, ROLE_HUES, roleOf } from '../core/contrast.ts'
import { SCENES, sceneAt, sceneParts } from '../core/scenes.ts'
import type { Colors } from '../core/seeds.ts'
import { grow, SEED_FIELDS, type Seeds } from '../core/seeds.ts'
import { BASE, colorsOf, gatedOf, lchTight, PAIRS, SLOT_NAMES, slotLabel } from '../core/slots.ts'
import { cells } from '../core/text.ts'
import { colorQuery, SLOT_CODES, slotColors } from '../terminals/osc.ts'
import { CLEAR } from '../terminals/terminal.ts'
import { fit, spread, wrapText } from './ansi.ts'
import { barLine, type Hint, toned } from './bar.ts'
import { type Look, onBase, pictureArea, planeAt, renderBuilder } from './builder-screen.ts'
import type { Backdrop } from './editor-backdrop.ts'
import {
  baseButton,
  channelSamples,
  contrastLine,
  detailChecks,
  type EditorSpot,
  fixHint,
  gateBox,
  gateMisses,
  gradient,
  heldOf,
  LEFT,
  position,
  quitDialog,
  roleSgr,
  spot,
  used,
} from './editor-paint.ts'
import { type Start, typedDrop } from './find/attach.ts'
import { type Help, type HelpSpot, overlay } from './help.ts'
import { capped } from './keycaps.ts'
import { CELL_QUERY, type Cell, CellProbe, type Mouse, PIXEL_QUERY, PixelProbe } from './keys.ts'
import { CHANNELS, CONTRAST, type Edited, type EditorOptions, PaletteEditor, SCOPES } from './palette-editor.ts'
import { boxEdge, boxed, checkOf, contrastOf, hintOf, moreOf, pillOf, SEP } from './parts.ts'
import type { Chart, Drawn, PickerLayer } from './picker-art.ts'
import { Screen } from './screen.ts'
import { FG_RESET, grounded, INK_RESET, MARKS, type Paint, painter, RESET, surfaceOf } from './style.ts'
import { ALT_SCREEN, HIDE_CURSOR, NO_WRAP, PASTES, pointing, within } from './terminal.ts'
import { cover, type Hit, keyZone } from './zones.ts'

const MIN_COLS = 80
const MIN_ROWS = 24
const SEED_BAR = 11

function channelLines(p: Paint, e: PaletteEditor, at: Oklch, barWidth: number): string[] {
  const held = heldOf(e, at)

  return CHANNELS.map((channel, i) => {
    const here = e.mode === 'tune' && i === e.channel
    const value = at[channel.key]
    const shown = `${value.toFixed(channel.digits)}${channel.wraps ? '°' : ''}`.padStart(6)

    const bar = gradient(
      p,
      channelSamples(at, channel, barWidth),
      position(value, channel.min, channel.max, barWidth),
      here,
      channel.key === 'c' && held !== undefined ? position(held, channel.min, channel.max, barWidth) : undefined,
    )

    const label = channel.key.toUpperCase()
    const grip: EditorSpot = { kind: 'channel', channel: i }

    return `${spot(grip, here ? p.bold(`▸${label}`) : p.dim(` ${label}`))} ${spot({ kind: 'bar', channel: i }, bar)} ${spot(grip, here ? p.bold(shown) : p.dim(shown))}`
  })
}

function scopeLines(p: Paint, e: PaletteEditor): string[] {
  if (e.mode !== 'tune' || e.slot() < BASE.length) {
    return []
  }

  const items = SCOPES.map((scope) =>
    spot({ kind: 'scope', scope }, scope !== e.scope ? p.dim(scope) : pillOf(p, scope)),
  )

  const n = e.scoped().length

  return [
    `${p.dim('Scope')}  ${items.join('  ')}`,
    p.dim(
      n > 1 ? `${n} colors move by the same step, each keeping its own color` : 'This color moves alone — a adds more',
    ),
  ]
}

const SEED_SHOWS: Record<keyof Seeds, (c: Colors) => Hex> = {
  background: (c) => c.background,
  foreground: (c) => c.foreground,
  hue: (c) => c.cursor,
  tint: (c) => c.background,
  lightness: (c) => c.ansi[4] as Hex,
  chroma: (c) => c.ansi[1] as Hex,
  brights: (c) => c.ansi[12] as Hex,
}

function oklchText(at: Oklch): string {
  return `oklch ${at.l.toFixed(3)} ${at.c.toFixed(3)} ${at.h.toFixed(0)}°`
}

function lchLine(p: Paint, at: Oklch): string {
  return `${p.dim('oklch')} ${p.bold(`${at.l.toFixed(3)} ${at.c.toFixed(3)} ${at.h.toFixed(0)}°`)}`
}

function slotPane(p: Paint, e: PaletteEditor, height: number, wide = LEFT): string[] {
  const bad = e.misses()
  const c = colorsOf(e.list)
  const focus = e.slot()

  const cell = (slot: number) => {
    const hex = e.list[slot] as Hex
    const focused = slot === focus
    const glyph = e.signature.includes(SLOT_NAMES[slot] as string) ? MARKS.signature : p.color ? MARKS.swatch : ' '
    const mark = bad.has(slot) ? MARKS.miss : e.tone && e.changed(slot) ? MARKS.on : ' '
    const sw = p.color ? `${p.fg(hex)}${glyph}${focused ? p.fg(c.foreground) : FG_RESET} ` : `${glyph} `
    const text = `${sw}${lchTight(e.lch[slot] as Oklch)}${mark}`

    if (!focused) {
      return spot({ kind: 'slot', slot }, ` ${text}`)
    }

    return spot(
      { kind: 'slot', slot },
      p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)} ${text}${INK_RESET}` : `›${text}`,
    )
  }

  const gutter = (here: boolean) =>
    here ? (p.color ? `${p.fg(c.cursor)}${MARKS.gutter}${FG_RESET} ` : `${MARKS.gutter} `) : '  '

  const lines = [
    p.dim(boxEdge(wide, 'top', [[2, ' Base ']])),
    ...BASE.map((name, row) => {
      const here = row === e.row
      const label = name.padEnd(10)

      return boxed(
        p,
        `${spot({ kind: 'slot', slot: row }, `${gutter(here)}${here ? p.bold(label) : label}`)}${cell(row)}`,
        wide,
      )
    }),
    p.dim(
      boxEdge(wide, 'mid', [
        [2, ' ANSI '],
        [13, ' Normal 0–7 '],
        [30, ' Bright 8–15 '],
      ]),
    ),
    ...PAIRS.map((name, k) => {
      const row = BASE.length + k
      const here = row === e.row
      const label = name.padEnd(10)

      const named = spot(
        { kind: 'slot', slot: row + (e.col === 1 ? 8 : 0) },
        `${gutter(here)}${here ? p.bold(label) : label}`,
      )

      return boxed(p, `${named}${cell(row)}${cell(row + 8)}`, wide)
    }),
    p.dim(boxEdge(wide, 'bottom')),
  ]

  const gate = gateBox(p, e, height - lines.length, wide)

  return [...lines, ...Array.from({ length: Math.max(0, height - lines.length - gate.length) }, () => ''), ...gate]
}

function seedPane(p: Paint, e: PaletteEditor, height: number): string[] {
  const c = colorsOf(e.list)

  const lines = [
    `  ${p.dim('Seeds')}`,
    ...SEED_FIELDS.map((field, i) => {
      const here = i === e.field
      const value = e.seeds[field.key]

      const samples = Array.from({ length: SEED_BAR }, (_, k) => {
        const v = field.min + ((field.max - field.min) * k) / (SEED_BAR - 1)

        return SEED_SHOWS[field.key](grow({ ...e.seeds, [field.key]: v }))
      })

      const bar = gradient(p, samples, position(value, field.min, field.max, SEED_BAR), here)
      const shown = `${value.toFixed(field.digits)}${field.wraps ? '°' : ''}`.padStart(6)
      const hex = SEED_SHOWS[field.key](c)
      const gutter = here ? (p.color ? `${p.fg(c.cursor)}${MARKS.gutter}${FG_RESET} ` : `${MARKS.gutter} `) : '  '
      const label = field.label.padEnd(17)
      const grip: EditorSpot = { kind: 'field', field: i }

      return `${spot(grip, `${gutter}${here ? p.bold(label) : label}`)}${spot({ kind: 'seed', field: i }, bar)}${spot(grip, ` ${shown}  ${p.color ? `${p.fg(hex)}${MARKS.swatch}${FG_RESET} ` : ''}${p.dim(hex)}`)}`
    }),
    '',
    ...wrapText(
      capped(
        'Seven seeds grow all twenty colors, each accent on the hue its ANSI role reads as. Whatever the seeds, they pass every contrast check. enter moves on to tune each color, and the seeds stay behind.',
      ),
      LEFT - 4,
    ).map((line) => `  ${p.dim(line)}`),
    '',
  ]

  return [...lines, ...gateBox(p, e, height - lines.length, LEFT - 1)]
}

function sample(p: Paint, c: Colors, width: number, room: number, scene: number, slot: number): string[] {
  const at = SCENES.indexOf(sceneAt(scene))

  const tabs = SCENES.map((one, i) =>
    spot({ kind: 'scene', scene: i }, i !== at ? p.dim(one.name) : pillOf(p, one.name)),
  ).join('  ')

  const base = `${p.bg(c.background)}${p.fg(c.foreground)}`

  return [
    spread(tabs, p.dim('⇧←→'), width),
    ...sceneAt(scene)
      .lines.values()
      .map((text) => sceneParts(text, width - 2))
      .filter((parts) => parts !== undefined)
      .take(Math.max(0, room - 1))
      .map((parts) => {
        const line = p.color
          ? parts.map(([t, role]) => `${roleSgr(p, c, role, used(slot, role))}${t}${RESET}${base}`).join('')
          : parts.map(([t]) => t).join('')

        return `${base} ${fit(line, width - 2)} ${p.color ? RESET : ''}`
      }),
  ]
}

const SHORT = ['Bk', 'Rd', 'Gr', 'Ye', 'Bl', 'Ma', 'Cy', 'Wh']

const PLOT = 6
const SPAN = 40

function chart(
  p: Paint,
  e: PaletteEditor,
  shown: Hex[],
  pick: (o: Oklch) => number,
  top: number,
  bottom: number,
  rows: number,
  pictured: boolean,
): string[] {
  const step = (top - bottom) / (rows - 1)
  const lit = litColumns(e)
  const c = colorsOf(shown)
  const at = (hex: Hex) => Math.min(rows - 1, Math.max(0, Math.round((top - pick(oklch(hex))) / step)))

  return Array.from({ length: rows }, (_, r) => {
    const label = r % 2 === 0 ? (top - step * r).toFixed(top >= 1 ? 1 : 2).replace(/^0(?=\.\d\d)/, '') : ''

    if (pictured) {
      return `${label.padStart(4)} ${p.dim(r % 2 === 0 ? '┤' : '│')}${' '.repeat(SPAN)}`
    }

    const columns = Array.from({ length: 8 }, (_, k) => {
      const marks = [' ', ' ', ' ', ' ', ' ']
      const normal = c.ansi[k] as Hex
      const bright = c.ansi[k + 8] as Hex
      const n = at(normal) === r
      const b = at(bright) === r

      const cellOf = (j: number) => {
        if (j === 1 && n) return p.color ? `${p.fg(normal)}${MARKS.on}` : MARKS.on

        if (j === 3 && b) return p.color ? `${p.fg(bright)}${MARKS.off}` : MARKS.off

        return marks[j] as string
      }

      const cells = [0, 1, 2, 3, 4].map(cellOf).join('')

      return lit.has(k)
        ? p.color
          ? `${p.bg(c.selection)}${cells}${INK_RESET}`
          : cells
        : `${cells}${p.color ? FG_RESET : ''}`
    })

    return `${label.padStart(4)} ${p.dim(r % 2 === 0 ? '┤' : '│')}${columns.join('')}`
  })
}

function litColumns(e: PaletteEditor): Set<number> {
  const slots = e.mode === 'tune' ? e.scoped() : [e.slot()]

  return new Set(slots.filter((slot) => slot >= BASE.length).map((slot) => (slot - BASE.length) % 8))
}

function axisLabels(p: Paint, e: PaletteEditor): string {
  const lit = litColumns(e)

  return `      ${SHORT.map((name, k) => (lit.has(k) ? p.bold(` ${name}  `) : p.dim(` ${name}  `))).join('')}`
}

function bandAt(angle: number): number {
  let best = -1
  let gap = 999

  for (const [role, hue] of ROLE_HUES) {
    const d = hueGap(angle, hue.center)

    if (d <= hue.width && d < gap) {
      gap = d
      best = role
    }
  }

  return best
}

function hueLines(p: Paint, shown: Hex[], pictured: boolean): string[] {
  const c = colorsOf(shown)
  const head = `${p.bold('Hue')}   ${p.dim('0°        90°       180°      270°      360°')}`

  if (pictured) {
    return [head, `${p.dim('bands')} ${' '.repeat(SPAN)}`, '', '']
  }

  const band = Array.from({ length: SPAN }, (_, cell) => {
    const best = bandAt(cell * 9 + 4.5)

    return best < 0 ? ' ' : p.color ? `${p.fg(c.ansi[best] as Hex)}─` : '─'
  }).join('')

  const dots = (offset: number, glyph: string) => {
    const cells = Array.from({ length: SPAN }, () => ' ')

    for (const role of ROLE_HUES.keys()) {
      const hex = c.ansi[role + offset] as Hex
      const at = Math.min(SPAN - 1, Math.round(oklch(hex).h / 9))
      cells[at] = p.color ? `${p.fg(hex)}${glyph}${FG_RESET}` : glyph
    }

    return `      ${cells.join('')}`
  }

  return [head, `${p.dim('bands')} ${band}${p.color ? FG_RESET : ''}`, dots(0, MARKS.on), dots(8, MARKS.off)]
}

function levelChart(
  name: 'lightness' | 'chroma',
  e: PaletteEditor,
  shown: Hex[],
  pick: (o: Oklch) => number,
  span: { top: number; bottom: number; rows: number },
  ink: Hex,
  row: number,
): Chart {
  const c = colorsOf(shown)
  const { top, bottom, rows } = span
  const yOf = (hex: Hex) => 0.5 + Math.min(1, Math.max(0, (top - pick(oklch(hex))) / (top - bottom))) * (rows - 1)
  const dots: Chart['dots'] = []
  const links: Chart['links'] = []

  for (let k = 0; k < 8; k++) {
    const normal = c.ansi[k] as Hex
    const bright = c.ansi[k + 8] as Hex
    const from = { x: k * 5 + 1.5, y: yOf(normal) }
    const to = { x: k * 5 + 3.5, y: yOf(bright) }
    links.push({ from, to, color: ink, alpha: 0.3 })
    dots.push({ ...from, color: normal, ring: false }, { ...to, color: bright, ring: true })
  }

  return {
    name,
    box: { row, col: PLOT, cols: SPAN, rows },
    ink,
    rules: Array.from({ length: Math.ceil(rows / 2) }, (_, i) => i * 2 + 0.5),
    ticks: [],
    lit: [...litColumns(e)].map((k) => ({ x: k * 5, w: 5, color: c.selection })),
    bars: [],
    links,
    dots,
  }
}

function hueChart(shown: Hex[], ink: Hex, row: number): Chart {
  const c = colorsOf(shown)
  const bars: Chart['bars'] = []
  const dots: Chart['dots'] = []
  const links: Chart['links'] = []
  const across = (degrees: number) => (degrees * SPAN) / 360
  let from = 0
  let held = bandAt(0)

  for (let degrees = 0.25; degrees <= 360; degrees += 0.25) {
    const role = degrees === 360 ? -2 : bandAt(degrees)

    if (role !== held) {
      if (held >= 0) {
        bars.push({ x0: across(from), x1: across(degrees), y: 0.5, color: c.ansi[held] as Hex })
      }

      from = degrees
      held = role
    }
  }

  for (const role of ROLE_HUES.keys()) {
    const normal = c.ansi[role] as Hex
    const bright = c.ansi[role + 8] as Hex
    const a = { x: across(oklch(normal).h), y: 1.5 }
    const b = { x: across(oklch(bright).h), y: 2.5 }

    if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) {
      continue
    }

    if (Math.abs(a.x - b.x) <= SPAN / 2) {
      links.push({ from: a, to: b, color: normal, alpha: 0.55 })
    } else {
      const [low, high] = a.x < b.x ? [a, b] : [b, a]
      const seam = low.y + ((high.y - low.y) * low.x) / (low.x + SPAN - high.x)
      links.push(
        { from: low, to: { x: 0, y: seam }, color: normal, alpha: 0.55 },
        { from: { x: SPAN, y: seam }, to: high, color: normal, alpha: 0.55 },
      )
    }

    dots.push({ ...a, color: normal, ring: false }, { ...b, color: bright, ring: true })
  }

  return {
    name: 'hue',
    box: { row, col: PLOT, cols: SPAN, rows: 3 },
    ink,
    rules: [],
    ticks: [0, 90, 180, 270, 360].map(across),
    lit: [],
    bars,
    links,
    dots,
  }
}

function relationNotes(p: Paint, e: PaletteEditor, shown: Hex[]): string[] {
  const theme = gatedOf(shown, e.signature)
  const name = (ansi: number) => slotLabel(BASE.length + ansi).name
  const hue = (ansi: number) => oklch(shown[BASE.length + ansi] as Hex).h.toFixed(0)

  const notes = [
    ...brightDrift(theme)
      .filter(({ gap }) => gap > 25)
      .map(
        ({ normal, gap }) =>
          `${name(normal)} ${hue(normal)}° → bright ${hue(normal + 8)}°${SEP}${gap.toFixed(0)}° apart${SEP}≤ 25°`,
      ),
    ...offRole(theme).map(({ slot, over }) => {
      const band = ROLE_HUES.get(roleOf(slot)) as { name: string; center: number; width: number }

      return `${name(slot)} ${hue(slot)}°${SEP}${over.toFixed(0)}° outside ${band.name} ${band.center}±${band.width}°`
    }),
    ...lookalikes(theme).map(([a, b]) => `${name(a)} and ${name(b).toLowerCase()} read as one color`),
    ...confusions(theme).map(([a, b]) => `${name(a)} and ${name(b).toLowerCase()} read as one to a deuteranope`),
  ]

  return notes.length > 0
    ? notes.map((note) => `${p.bold(MARKS.miss)} ${note}`)
    : [p.dim(`${MARKS.ok} Every accent keeps its role and its bright`)]
}

interface Plotted {
  lines: string[]
  charts: Chart[]
}

function relations(
  p: Paint,
  e: PaletteEditor,
  width: number,
  height: number,
  full: boolean,
  ink: Hex | undefined,
): Plotted {
  const shown = e.shown()
  const maxC = Math.max(...shown.slice(BASE.length).map((hex) => oklch(hex).c))
  const topC = Math.max(0.2, Math.ceil(maxC / 0.05) * 0.05)
  const lines = [spread(p.bold('Lightness'), p.dim('● normal  ○ bright'), width)]
  const charts: Chart[] = []
  const pictures = (rows: number) => (width >= PLOT + SPAN && lines.length + rows <= height ? ink : undefined)

  const level = (
    name: 'lightness' | 'chroma',
    pick: (o: Oklch) => number,
    top: number,
    bottom: number,
    rows: number,
  ) => {
    const drawn = pictures(rows)

    if (drawn) {
      charts.push(levelChart(name, e, shown, pick, { top, bottom, rows }, drawn, lines.length))
    }

    lines.push(...chart(p, e, shown, pick, top, bottom, rows, drawn !== undefined))
  }

  level('lightness', (o) => o.l, 1, 0.3, 8)
  lines.push(axisLabels(p, e))

  if (full) {
    lines.push('', p.bold('Chroma'))
    level('chroma', (o) => o.c, topC, 0, 5)
    lines.push('')
    const drawn = pictures(4)

    if (drawn) {
      charts.push(hueChart(shown, drawn, lines.length + 1))
    }

    lines.push(...hueLines(p, shown, drawn !== undefined))
  }

  return { lines: [...lines, ...relationNotes(p, e, shown)].slice(0, height), charts }
}

function moved(charts: readonly Chart[], rows: number, cols: number): Chart[] {
  return charts.map((chart) => ({
    ...chart,
    box: { ...chart.box, row: chart.box.row + rows, col: chart.box.col + cols },
  }))
}

function viewTabs(p: Paint, e: PaletteEditor, width: number): string {
  const tab = (name: string, view: PaletteEditor['view']) =>
    spot({ kind: 'view', view }, e.view !== view ? p.dim(` ${name} `) : pillOf(p, name))

  return spread(
    `${tab('Slot', 'slot')}${tab('Relations', 'relations')}`,
    keyZone('g', `${p.bold('g')} ${p.dim('switch')}`),
    width,
  )
}

function detailPane(p: Paint, e: PaletteEditor, width: number, height: number, ink: Hex | undefined): Plotted {
  const slot = e.slot()
  const hex = e.list[slot] as Hex
  const at = e.lch[slot] as Oklch
  const base = e.original[slot] as Hex
  const { name, about } = slotLabel(slot)
  const sig = e.signature.includes(SLOT_NAMES[slot] as string)
  const barWidth = Math.max(8, Math.min(64, width - 12))

  if (e.view === 'relations' && e.mode !== 'tune') {
    const plotted = relations(p, e, width, height - 2, true, ink)

    return { lines: [viewTabs(p, e, width), '', ...plotted.lines], charts: moved(plotted.charts, 2, 0) }
  }

  const right = slot >= BASE.length ? p.dim('Uses underlined below') : sig ? p.dim(`${MARKS.signature} signature`) : ''
  const lines = [spread(`${p.bold(name)}  ${p.dim(about)}`, e.view === 'relations' ? '' : right, width), '']
  const block = p.color ? `${p.fg(hex)}${'█'.repeat(8)}${FG_RESET}  ` : ''
  const typed = e.typing !== undefined ? `${p.bold(`${e.typing}▏`)}` : undefined
  const [r, g, b] = rgb(hex)
  lines.push(`${block}${typed ?? lchLine(p, at)}`, `${block}${p.dim(`${hex}${SEP}rgb ${r} ${g} ${b}`)}`)

  if (e.view !== 'relations') {
    const room = width - cells(block)
    const value = `${oklchText(e.lchOf(base)).slice(6)}${SEP}${base}`
    lines.push(`${block}${e.changed(slot) ? baseButton(p, e, room, value) : p.dim(e.based())}`)
  }

  lines.push('', ...channelLines(p, e, at, barWidth), contrastLine(p, e, barWidth), ...scopeLines(p, e))

  if (e.view === 'relations') {
    lines.push('')
    const plotted = relations(p, e, width, height - lines.length, false, ink)
    const charts = moved(plotted.charts, lines.length, 0)
    lines.push(...plotted.lines)

    return { lines, charts }
  }

  lines.push(
    '',
    ...detailChecks(e, slot, at).flatMap((check) =>
      wrapText(check.text, width - 2).map(
        (line, i) => `${i === 0 ? checkOf(p, check.ok) : ' '} ${check.ok === false ? line : p.dim(line)}`,
      ),
    ),
  )
  const hint = fixHint(e, slot)

  if (hint) {
    lines.push(...wrapText(hint, width - 2).map((line) => p.dim(`  ${line}`)))
  }

  const room = height - lines.length - 1

  if (room >= 3) {
    lines.push('', ...sample(p, colorsOf(e.shown()), width, room, e.scene, slot))
  }

  return { lines, charts: [] }
}

function seedSide(p: Paint, e: PaletteEditor, width: number, height: number): string[] {
  return [
    spread(`${p.bold('Sample')}  ${p.dim('what the seeds grow')}`, '', width),
    '',
    ...sample(p, colorsOf(e.list), width, height - 2, e.scene, -1),
  ]
}

function openPane(p: Paint, e: PaletteEditor, width: number, height: number): string[] {
  const choices = e.choices()
  const all = e.options.palettes?.length ?? 0
  const filter = e.filter ? `${p.bold(e.filter)}▏` : p.dim('Type to filter')
  const room = height - 2
  const span = choices.length <= room ? room : room - 1
  const top = Math.max(0, Math.min(e.pick - Math.floor(span / 2), choices.length - span))
  const below = Math.max(0, choices.length - top - span)
  const nameWidth = Math.min(40, Math.max(12, ...choices.map((c) => cells(c.name))))

  return [
    spread(`  ${p.bold('Take colors from')}  ${filter}`, p.dim(`${choices.length}/${all}`), width),
    top > 0 ? `  ${p.dim(moreOf(-1, top))}` : '',
    ...choices.slice(top, top + span).map((choice, k) => {
      const here = top + k === e.pick
      const c = choice.colors

      const swatches = p.color
        ? `${p.bg(c.background)} ${c.ansi.map((hex) => `${p.fg(hex)}${MARKS.swatch}`).join('')} ${p.fg(c.foreground)}Aa ${INK_RESET}`
        : ''

      const gutter = here ? '▌ ' : '  '
      const label = choice.name.padEnd(nameWidth)

      return spot({ kind: 'choice', index: top + k }, `${gutter}${here ? p.bold(label) : label}  ${swatches}`)
    }),
    ...(below > 0 ? [`  ${p.dim(moreOf(1, below))}`] : []),
    ...(choices.length === 0 ? [`  ${p.dim(`No palettes match '${e.filter}'`)}`] : []),
  ]
}

const KEEP = ['s', 'g', 'a', 'i']
const QUITTING = ['y', 'n']

function footer(p: Paint, e: PaletteEditor, width: number): string {
  if (e.help) {
    return barLine(p, e.help.bar(), width)
  }

  let badge = 'EDIT'
  let lead = ''
  let keys: Hint[] = []
  let right: Hint | undefined

  if (e.quitting) {
    badge = 'EDIT (QUIT)'
    lead = 'Save changes?'
    keys = [
      ['←→', 'choose'],
      ['enter', 'confirm'],
      ['y', 'save'],
      ['n', 'discard'],
    ]
    right = ['esc', 'keep editing']
  } else if (e.typing !== undefined) {
    badge = 'EDIT (TYPE)'
    lead = p.dim('#rrggbb, rgb(r g b) or oklch(l c h)')
    keys = [
      ['enter', 'set'],
      ['ctrl+u', 'clear'],
    ]
    right = ['esc', 'back']
  } else if (e.overlay === 'open') {
    badge = 'EDIT (OPEN)'
    keys = [
      ['↑↓', 'palette'],
      ['a-z', 'filter'],
      ['enter', 'take its colors'],
    ]
    right = ['esc', 'close']
  } else if (e.menu) {
    badge = e.menu === 'export' ? 'EDIT (EXPORT)' : 'EDIT (IMPORT)'
    keys = [
      ['↑↓', 'move'],
      ['enter', 'choose'],
    ]
    right = ['esc', 'close']
  } else if (e.compare) {
    badge = 'EDIT (BEFORE)'
    lead = 'The colors you started from'
    keys = [['space', 'back to yours']]
    right = ['esc', 'back']
  } else if (e.mode === 'seeds') {
    badge = 'EDIT (SEEDS)'
    keys = [
      ['↑↓', 'move'],
      ['←→', 'change'],
      ['⇧←→', 'by 5'],
      ['enter', 'tune colors'],
      ['o', 'open a palette'],
      ['p', 'find picture'],
      ['?', 'keys'],
    ]
    right = ['esc', 'cancel']
  } else if (e.mode === 'tune') {
    badge = 'EDIT (TUNE)'
    keys = [
      ['↑↓', 'L'],
      ['←→', e.channel === CONTRAST ? 'ratio' : 'C'],
      ['⇧←→', 'H'],
      ['u', 'undo'],
      ['r', 'reset'],
      ['tab', MARKS.contrast],
      ...(e.slot() >= BASE.length ? ([['a', 'scope']] as Hint[]) : []),
      [e.channel === CONTRAST ? '1-9' : '0-9', e.channel === CONTRAST ? 'ratio' : 'jump'],
      ['#', 'type'],
      ['enter', 'keep'],
    ]
    right = ['esc', 'cancel']
  } else if (e.inspect) {
    badge = 'EDIT (INSPECT)'
    keys = [
      ['←→↑↓', 'move'],
      ['⇧←→', 'tab'],
      ['enter', 'go to color'],
      ['i', 'back'],
    ]
    right = ['esc', 'back']
  } else {
    keys = [
      ['↑↓', 'move'],
      ['←→', 'normal or bright'],
      ['enter', 'tune'],
      ['#', 'type'],
      ['g', e.view === 'slot' ? 'relations' : 'colors'],
      ['p', 'find picture'],
      ['s', 'save'],
      ['?', 'keys'],
    ]
    right = ['esc', 'cancel']
  }

  if (!e.options.find) {
    keys = keys.filter(([key]) => key !== 'p')
  }

  if (!e.roomy) {
    keys = keys.filter(([key]) => key !== 'i')
  }

  if (e.notice) {
    lead = toned(p, e.noticeTone, e.notice)
  }

  return barLine(p, { badge, lead, keys, ...(right ? { right } : {}), keep: e.quitting ? QUITTING : KEEP }, width)
}

export function renderEditor(e: PaletteEditor, cols: number, rows: number, color: boolean, look: Look = {}): string[] {
  return drawEditor(e, cols, rows, color, look).lines
}

export function drawEditor(e: PaletteEditor, cols: number, rows: number, color: boolean, look: Look = {}): Drawn {
  const drawn = drawFrame(e, cols, rows, color, look)

  if (cols < MIN_COLS || rows < MIN_ROWS) {
    return drawn
  }

  const p = painter(color)
  const ground = (drawn.mock || drawn.charts) && look.chrome?.[0] ? p.bg(look.chrome[0]) : ''
  const solid = (box: string[]) => (ground ? box.map((line) => grounded(line, ground)) : box)

  if (e.help) {
    return {
      ...drawn,
      lines: overlay(drawn.lines, solid(e.help.box(p, cols, rows - 1)), cols, rows, 1),
      art: undefined,
    }
  }

  if (!e.quitting) {
    return drawn
  }

  const dialog = solid(quitDialog(p, e, cols))
  const col = Math.floor((cols - cells(dialog[0] as string)) / 2)
  const top = Math.max(0, Math.floor((drawn.lines.length - dialog.length) / 2))

  const lines = drawn.lines.map((line, i) => {
    const part = dialog[i - top]

    return part === undefined ? line : cover(line, col, part)
  })

  return { ...drawn, lines }
}

function drawFrame(e: PaletteEditor, cols: number, rows: number, color: boolean, look: Look): Drawn {
  const p = painter(color)

  if (cols < MIN_COLS || rows < MIN_ROWS) {
    const small = [
      p.bold('ttheme palette editor'),
      `Needs ${MIN_COLS}×${MIN_ROWS} — now ${cols}×${rows}`,
      e.quitting
        ? `Save changes?   ${[hintOf(p, 'y', 'save'), hintOf(p, 'n', 'discard'), hintOf(p, 'esc', 'keep editing')].join('   ')}`
        : p.dim(capped('esc cancel')),
    ]

    return { lines: Array.from({ length: rows }, (_, i) => fit(small[i] ?? '', cols)), art: undefined }
  }

  e.viewport(cols, rows)

  if (!e.overlay && e.mode !== 'seeds' && e.view === 'slot') {
    const built = renderBuilder(e, cols, rows, color, look)

    if (built) {
      return { ...built, lines: [...built.lines, footer(p, e, cols)] }
    }
  }

  const failing = gateMisses(e)
  const gate = `${failing === 0 ? MARKS.ok : MARKS.miss} ${contrastOf(failing)}`
  const shown = `${MARKS.pictures} ${e.pictures} ${e.pictures === 1 ? 'picture' : 'pictures'}`
  const shelf = e.pictures > 0 ? p.dim(`${shown}   `) : ''
  const reset = e.resettable() ? `${keyZone('R', p.dim('Reset'))}   ` : ''
  const state = `${e.dirty() ? `${p.warn(MARKS.on)} unsaved   ` : ''}${reset}${shelf}${failing === 0 ? p.ok(gate) : p.dim(gate)}`
  const title = `${p.accent(MARKS.current)} ${p.bold(e.options.title)}  ${p.dim(e.options.name)}`
  const height = rows - 4
  const ink = color && look.art === true ? look.chrome?.[1] : undefined
  let body: string[]
  let charts: Chart[] = []

  if (e.overlay === 'open') {
    body = openPane(p, e, cols, height)
  } else {
    const right = cols - LEFT - 2
    const left = e.mode === 'seeds' ? seedPane(p, e, height) : slotPane(p, e, height, LEFT - 1)

    const side =
      e.mode === 'seeds' ? { lines: seedSide(p, e, right, height), charts: [] } : detailPane(p, e, right, height, ink)

    charts = moved(side.charts, 2, LEFT + 2)
    body = Array.from(
      { length: height },
      (_, i) => `${fit(left[i] ?? '', LEFT)}${p.dim('│')} ${fit(side.lines[i] ?? '', right)}`,
    )
  }

  const lines = [
    spread(title, state, cols),
    '',
    ...Array.from({ length: height }, (_, i) => fit(body[i] ?? '', cols)),
    '',
    footer(p, e, cols),
  ]

  return charts.length > 0 ? { lines, art: undefined, charts } : { lines, art: undefined }
}

const PICKER_KEYS = new Set(['tab', 'a', '#', 'l', 'u', 'r', 'enter', 'esc'])
const PICKER_SPOTS = new Set(['picker', 'plane', 'bar', 'channel', 'format', 'scope', 'open', 'slot'])

function closesPicker(target: EditorSpot | undefined): boolean {
  if (!target) {
    return true
  }

  return target.kind === 'key' ? !PICKER_KEYS.has(target.key) : !PICKER_SPOTS.has(target.kind)
}

function pointHelp(e: PaletteEditor, help: Help, hit: Hit | undefined, event: Mouse): void {
  const target = hit?.target as EditorSpot | HelpSpot | undefined

  if (event.action === 'wheel') {
    help.wheel(event.wheel)
  } else if (event.action === 'press' && event.button === 'left' && target?.kind === 'topic') {
    help.point(target.index)
  } else if (event.action === 'release' && target?.kind === 'key' && hit?.inside) {
    e.press(target.key)
  } else if (event.action === 'release' && target?.kind === 'topic') {
    if (hit?.inside && event.count >= 2 && help.point(target.index)) {
      e.press('enter')
    }
  } else if (event.action === 'release' && target?.kind !== 'help') {
    e.help = undefined
  }
}

function pointEditor(e: PaletteEditor, hit: Hit | undefined, event: Mouse): void {
  if (e.help) {
    pointHelp(e, e.help, hit, event)

    return
  }

  if (event.action === 'wheel') {
    if (!event.sideways) {
      e.scroll(event.wheel)
    }

    return
  }

  if ((event.action === 'press' || event.action === 'drag') && event.button !== 'left') {
    return
  }

  const target = hit?.target as EditorSpot | undefined

  if (event.action === 'press' && e.mode === 'tune' && e.roomy && !e.overlay && closesPicker(target)) {
    e.dismiss()
  }

  if (!hit || !target) {
    return
  }

  const along = hit.width > 1 ? (hit.exact.x - 0.5) / (hit.width - 1) : 0

  if (event.action === 'release') {
    if (!hit.inside) {
      return
    }

    if (target.kind === 'key') {
      e.press(target.key)
    } else if (target.kind === 'entry') {
      e.choose(target.index)
    } else if (event.count === 2 && target.kind === 'slot' && e.mode === 'list') {
      e.press('enter')
    } else if (event.count === 2 && target.kind === 'choice' && e.overlay === 'open') {
      e.press('enter')
    }

    return
  }

  if ((target.kind === 'plane' || target.kind === 'bar') && event.action === 'press') {
    e.touch()

    if (e.mode === 'tune' && e.roomy && onBase(e, target, hit.x, hit.width)) {
      e.press('r')

      return
    }
  }

  if (target.kind === 'plane') {
    const at = planeAt(target.row + hit.exact.y, target.rows, hit.exact.x, hit.width, (e.lch[e.slot()] as Oklch).h)
    e.plane(at.lightness, at.chroma)
  } else if (target.kind === 'bar') {
    e.slide(target.channel, along)
  } else if (target.kind === 'seed') {
    e.sow(target.field, along)
  } else if (event.action !== 'press') {
    return
  } else if (target.kind === 'slot') {
    e.select(target.slot)
  } else if (target.kind === 'open') {
    e.openSlot(target.slot)
  } else if (target.kind === 'run') {
    e.point(target.spot)
  } else if (target.kind === 'entry') {
    e.entry = target.index
  } else if (target.kind === 'format') {
    e.format = target.format
  } else if (target.kind === 'channel') {
    e.grip(target.channel)
  } else if (target.kind === 'scope') {
    e.scopeTo(target.scope)
  } else if (target.kind === 'choice') {
    if (e.overlay === 'open') {
      e.pick = target.index
    }
  } else if (e.typing === undefined && !e.overlay && !e.quitting) {
    if (target.kind === 'field' && e.mode === 'seeds') {
      e.field = target.field
    } else if (target.kind === 'view' && e.mode !== 'seeds') {
      e.view = target.view
    } else if (target.kind === 'scene') {
      e.scene = target.scene
    }
  }
}

interface Surface {
  backdrop?: Backdrop
  layer?: PickerLayer
  color: boolean
  hosted?: true
}

const MODES = [ALT_SCREEN, HIDE_CURSOR, NO_WRAP, PASTES]

export async function runEditor(options: EditorOptions, surface: Surface): Promise<Edited | undefined> {
  const editor = new PaletteEditor(options)
  const backdrop = surface.backdrop
  const layer = surface.layer
  const burst = (typed: string) => editor.typing === undefined && typedDrop(typed)

  const terminalOptions = surface.hosted
    ? { modes: [PASTES, ...pointing()], assume: [HIDE_CURSOR, NO_WRAP], burst }
    : { modes: [...MODES, ...pointing()], burst }

  return within(terminalOptions, async (terminal) => {
    let away = false
    let over = false
    const own = new Map<string, string>()
    const pixels = new PixelProbe()
    const sizes = new CellProbe()
    let measured: Cell | undefined

    const seen = await terminal.ask(
      `${colorQuery(SLOT_CODES, '')}${backdrop || layer ? CELL_QUERY : ''}${pointing().length > 0 ? PIXEL_QUERY : ''}\x1b[c`,
      (event) => {
        if (event.kind === 'color') {
          own.set(event.code, event.value)

          return undefined
        }

        measured = sizes.see(event)

        return pixels.see(event)
      },
      1000,
    )

    if (seen?.cell) {
      terminal.pixels(seen.cell)
    }

    const answered = slotColors(own) as (Hex | undefined)[]
    const chrome = answered.map((hex, slot) => hex ?? (editor.start[slot] as Hex))
    const [ground, ink] = chrome as [Hex, Hex]

    if (!answered[3]) {
      chrome[3] = surfaceOf(ground, ink, 'selection')
    }

    const screen = new Screen({
      write: (text) => terminal.write(text),
      view: () => {
        if (away) {
          return undefined
        }

        const { lines, art, mock, charts } = drawEditor(editor, terminal.cols, terminal.rows, surface.color, {
          behind: editor.pic && backdrop?.laid === true,
          art: layer?.ready === true,
          mock: layer?.ready === true,
          chrome,
        })

        return {
          lines,
          after: () =>
            `${
              (editor.pic
                ? backdrop?.draw(
                    editor.shown(),
                    terminal.cols,
                    terminal.rows,
                    pictureArea(terminal.cols, terminal.rows),
                  )
                : backdrop?.clear()) ?? ''
            }${layer?.draw(art, mock, charts) ?? ''}`,
        }
      },
    })

    const changed = (keyed = false) => {
      if (keyed) {
        screen.soon()
      } else {
        screen.request()
      }
    }

    const visit = async (start: Start | undefined) => {
      const find = options.find

      if (!find) {
        return
      }

      away = true
      terminal.write(`${backdrop?.clear() ?? ''}${layer?.clear() ?? ''}`)

      try {
        editor.found(await find(editor.edited(), start))
      } catch (error) {
        editor.say(error instanceof Error ? error.message : String(error), 'error')
      }

      if (over) {
        return
      }

      away = false
      backdrop?.load()
      screen.reset(CLEAR)
      changed()
    }

    terminal.write(CLEAR)
    terminal.onResize(() => {
      backdrop?.resized()
      layer?.resized()
      screen.reset(CLEAR)
      screen.request()
    })

    if (backdrop) {
      backdrop.load()
      backdrop.ready = () => screen.request()
    }

    if (measured) {
      backdrop?.measured(measured)
      layer?.measured(measured)
    } else if (backdrop || layer) {
      const probe = new CellProbe()
      void terminal
        .ask(CELL_QUERY, (event) => probe.see(event), 1000)
        .then((cell) => {
          if (cell) {
            backdrop?.measured(cell)
            layer?.measured(cell)
          }

          screen.request()
        })
    }

    changed()

    try {
      const { edited } = await terminal.loop(
        (event): { edited: Edited | undefined } | undefined => {
          if (away) {
            return undefined
          }

          if (event.kind === 'paste') {
            editor.paste(event.text)
          } else if (event.kind === 'key') {
            editor.press(event.key)
          } else if (event.kind === 'mouse') {
            pointEditor(editor, screen.point(event), event)
          }

          if (editor.copied !== undefined) {
            terminal.write(`\x1b]52;c;${Buffer.from(editor.copied).toString('base64')}\x07`)
            editor.copied = undefined
          }

          if (editor.result) {
            return { edited: editor.result === 'saved' ? editor.edited() : undefined }
          }

          const wants = editor.wants

          if (wants) {
            editor.wants = undefined
            void visit(wants.start)
          }

          return undefined
        },
        () => {
          if (!away) {
            changed(true)
          }
        },
      )

      return edited
    } finally {
      over = true
      screen.stop()
      terminal.write(`${backdrop?.close() ?? ''}${layer?.clear() ?? ''}`)
    }
  })
}
