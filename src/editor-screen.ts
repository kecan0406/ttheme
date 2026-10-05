import { cells, fit, spread, wrapText } from './ansi.ts'
import { type Look, pictureArea, planeAt, renderBuilder } from './builder-screen.ts'
import { type Hex, type Oklch, oklch, rgb } from './color.ts'
import { brightDrift, hueGap, lookalikes, offRole, ROLE_HUES, roleOf } from './contrast.ts'
import type { Backdrop } from './editor-backdrop.ts'
import {
  channelSamples,
  contrastLine,
  detailChecks,
  type EditorSpot,
  fixHint,
  gateBox,
  gradient,
  heldOf,
  LEFT,
  lchTight,
  position,
  roleSgr,
  spot,
  used,
} from './editor-paint.ts'
import { typedDrop } from './find/attach.ts'
import type { Start } from './find/find.ts'
import { colorQuery, SLOT_CODES, slotColors } from './osc.ts'
import {
  BASE,
  CHANNELS,
  CONTRAST,
  colorsOf,
  type Edited,
  type EditorOptions,
  gatedOf,
  PAIRS,
  PaletteEditor,
  ROWS,
  SCOPES,
  SLOT_NAMES,
  slotLabel,
} from './palette-editor.ts'
import type { Art, PickerLayer } from './picker-art.ts'
import { SCENES, sceneAt, sceneParts } from './scenes.ts'
import type { Colors } from './seeds.ts'
import { grow, SEED_FIELDS, type Seeds } from './seeds.ts'
import { CLEAR } from './terminal.ts'
import { CELL_QUERY, CellProbe, type Mouse, PIXEL_QUERY, PixelProbe } from './tui/keys.ts'
import { boxEdge, boxed, checkOf, pillOf } from './tui/parts.ts'
import { Screen } from './tui/screen.ts'
import { FG_RESET, INK_RESET, MARKS, type Paint, painter, RESET, surfaceOf } from './tui/style.ts'
import { ALT_SCREEN, HIDE_CURSOR, NO_WRAP, PASTES, pointing, within } from './tui/terminal.ts'
import { type Hit, keyZone } from './tui/zones.ts'

export const MIN_COLS = 80
export const MIN_ROWS = 24
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
      n > 1 ? `${n} slots move by the same step, each keeping its own color` : 'This slot moves alone · a widens it',
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
  const lines = [p.dim(boxEdge(wide, 'top', [[2, ' Base ']]))]
  for (let row = 0; row < BASE.length; row++) {
    const here = row === e.row
    const label = (BASE[row] as string).padEnd(10)
    lines.push(
      boxed(
        p,
        `${spot({ kind: 'slot', slot: row }, `${gutter(here)}${here ? p.bold(label) : label}`)}${cell(row)}`,
        wide,
      ),
    )
  }
  lines.push(
    p.dim(
      boxEdge(wide, 'mid', [
        [2, ' ANSI '],
        [12, ' Normal 0–7 '],
        [29, ' Bright 8–15 '],
      ]),
    ),
  )
  for (let row = BASE.length; row < ROWS; row++) {
    const here = row === e.row
    const label = (PAIRS[row - BASE.length] as string).padEnd(10)
    const named = spot(
      { kind: 'slot', slot: row + (e.col === 1 ? 8 : 0) },
      `${gutter(here)}${here ? p.bold(label) : label}`,
    )
    lines.push(boxed(p, `${named}${cell(row)}${cell(row + 8)}`, wide))
  }
  lines.push(p.dim(boxEdge(wide, 'bottom')))
  const gate = gateBox(p, e, height - lines.length, wide)
  return [...lines, ...Array.from({ length: Math.max(0, height - lines.length - gate.length) }, () => ''), ...gate]
}

function seedPane(p: Paint, e: PaletteEditor, height: number): string[] {
  const c = colorsOf(e.list)
  const lines = [`  ${p.dim('Seeds')}`]
  SEED_FIELDS.forEach((field, i) => {
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
    lines.push(
      `${spot(grip, `${gutter}${here ? p.bold(label) : label}`)}${spot({ kind: 'seed', field: i }, bar)}${spot(grip, ` ${shown}  ${p.color ? `${p.fg(hex)}${MARKS.swatch}${FG_RESET} ` : ''}${p.dim(hex)}`)}`,
    )
  })
  lines.push('')
  for (const line of wrapText(
    'Seven seeds grow all twenty colors, each accent on the hue its ANSI role reads as — whatever the seeds, they pass the gate. enter moves on to tune each slot, and the seeds stay behind.',
    LEFT - 4,
  )) {
    lines.push(`  ${p.dim(line)}`)
  }
  lines.push('')
  return [...lines, ...gateBox(p, e, height - lines.length, LEFT)]
}

function sample(p: Paint, c: Colors, width: number, room: number, scene: number, slot: number): string[] {
  const at = SCENES.indexOf(sceneAt(scene))
  const tabs = SCENES.map((one, i) =>
    spot({ kind: 'scene', scene: i }, i !== at ? p.dim(one.name) : pillOf(p, one.name)),
  ).join('  ')
  const lines = [spread(tabs, p.dim('⇧←→'), width)]
  const base = `${p.bg(c.background)}${p.fg(c.foreground)}`
  for (const text of sceneAt(scene).lines) {
    const parts = sceneParts(text, width - 2)
    if (!parts) {
      continue
    }
    if (lines.length >= room) {
      break
    }
    const line = p.color
      ? parts.map(([t, role]) => `${roleSgr(p, c, role, used(slot, role))}${t}${RESET}${base}`).join('')
      : parts.map(([t]) => t).join('')
    lines.push(`${base} ${fit(line, width - 2)} ${p.color ? RESET : ''}`)
  }
  return lines
}

const SHORT = ['Bk', 'Rd', 'Gr', 'Ye', 'Bl', 'Ma', 'Cy', 'Wh']

function chart(
  p: Paint,
  e: PaletteEditor,
  shown: Hex[],
  pick: (o: Oklch) => number,
  top: number,
  bottom: number,
  rows: number,
): string[] {
  const step = (top - bottom) / (rows - 1)
  const lit = litColumns(e)
  const c = colorsOf(shown)
  const at = (hex: Hex) => Math.min(rows - 1, Math.max(0, Math.round((top - pick(oklch(hex))) / step)))
  return Array.from({ length: rows }, (_, r) => {
    const label = r % 2 === 0 ? (top - step * r).toFixed(top >= 1 ? 1 : 2).replace(/^0(?=\.\d\d)/, '') : ''
    let line = `${label.padStart(4)} ${p.dim(r % 2 === 0 ? '┤' : '│')}`
    for (let k = 0; k < 8; k++) {
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
      line += lit.has(k)
        ? p.color
          ? `${p.bg(c.selection)}${cells}${INK_RESET}`
          : cells
        : `${cells}${p.color ? FG_RESET : ''}`
    }
    return line
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

function hueLines(p: Paint, shown: Hex[]): string[] {
  const c = colorsOf(shown)
  const band = Array.from({ length: 40 }, (_, cell) => {
    const angle = cell * 9 + 4.5
    let best = -1
    let gap = 999
    for (const [role, hue] of Object.entries(ROLE_HUES)) {
      const d = hueGap(angle, hue.center)
      if (d <= hue.width && d < gap) {
        gap = d
        best = Number(role)
      }
    }
    return best < 0 ? ' ' : p.color ? `${p.fg(c.ansi[best] as Hex)}─` : '─'
  }).join('')
  const dots = (offset: number, glyph: string) => {
    const cells = Array.from({ length: 40 }, () => ' ')
    for (const role of Object.keys(ROLE_HUES).map(Number)) {
      const hex = c.ansi[role + offset] as Hex
      const at = Math.min(39, Math.round(oklch(hex).h / 9))
      cells[at] = p.color ? `${p.fg(hex)}${glyph}${FG_RESET}` : glyph
    }
    return `      ${cells.join('')}`
  }
  return [
    `${p.bold('Hue')}   ${p.dim('0°        90°       180°      270°      360°')}`,
    `${p.dim('bands')} ${band}${p.color ? FG_RESET : ''}`,
    dots(0, MARKS.on),
    dots(8, MARKS.off),
  ]
}

function relationNotes(p: Paint, e: PaletteEditor, shown: Hex[]): string[] {
  const theme = gatedOf(shown, e.signature, e.waive)
  const name = (ansi: number) => slotLabel(BASE.length + ansi).name
  const hue = (ansi: number) => oklch(shown[BASE.length + ansi] as Hex).h.toFixed(0)
  const notes = [
    ...brightDrift(theme)
      .filter(({ gap }) => gap > 25)
      .map(
        ({ normal, gap }) =>
          `${name(normal)} ${hue(normal)}° → bright ${hue(normal + 8)}° · ${gap.toFixed(0)}° apart · ≤ 25°`,
      ),
    ...offRole(theme).map(({ slot, over }) => {
      const band = ROLE_HUES[roleOf(slot)] as { name: string; center: number; width: number }
      return `${name(slot)} ${hue(slot)}° · ${over.toFixed(0)}° outside ${band.name} ${band.center}±${band.width}°`
    }),
    ...lookalikes(theme).map(([a, b]) => `${name(a)} and ${name(b).toLowerCase()} read as one color`),
  ]
  return notes.length > 0
    ? notes.map((note) => `${p.bold(MARKS.miss)} ${note}`)
    : [p.dim(`${MARKS.ok} Every accent keeps its role and its bright`)]
}

function relations(p: Paint, e: PaletteEditor, width: number, height: number, full: boolean): string[] {
  const shown = e.shown()
  const maxC = Math.max(...shown.slice(BASE.length).map((hex) => oklch(hex).c))
  const topC = Math.max(0.2, Math.ceil(maxC / 0.05) * 0.05)
  const lines = [
    spread(p.bold('Lightness'), p.dim('● normal  ○ bright'), width),
    ...chart(p, e, shown, (o) => o.l, 1, 0.3, 8),
    axisLabels(p, e),
  ]
  if (full) {
    lines.push('', p.bold('Chroma'), ...chart(p, e, shown, (o) => o.c, topC, 0, 5), '', ...hueLines(p, shown))
  }
  return [...lines, ...relationNotes(p, e, shown)].slice(0, height)
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

function detailPane(p: Paint, e: PaletteEditor, width: number, height: number): string[] {
  const slot = e.slot()
  const hex = e.list[slot] as Hex
  const at = e.lch[slot] as Oklch
  const was = e.start[slot] as Hex
  const { name, about } = slotLabel(slot)
  const sig = e.signature.includes(SLOT_NAMES[slot] as string)
  const barWidth = Math.max(8, Math.min(64, width - 12))
  if (e.view === 'relations' && e.mode !== 'tune') {
    return [viewTabs(p, e, width), '', ...relations(p, e, width, height - 2, true)]
  }
  const right = slot >= BASE.length ? p.dim('Uses underlined below') : sig ? p.dim('◆ signature') : ''
  const lines = [spread(`${p.bold(name)}  ${p.dim(about)}`, e.view === 'relations' ? '' : right, width), '']
  const block = p.color ? `${p.fg(hex)}${'█'.repeat(8)}${FG_RESET}  ` : ''
  const typed = e.typing !== undefined ? `${p.bold(`${e.typing}▏`)}` : undefined
  const [r, g, b] = rgb(hex)
  lines.push(`${block}${typed ?? lchLine(p, at)}`)
  lines.push(`${block}${p.dim(`${hex} · rgb ${r} ${g} ${b}`)}`)
  if (e.view !== 'relations') {
    const swatch = p.color ? `${p.fg(was)}${MARKS.swatch}${FG_RESET} ` : ''
    lines.push(
      `${block}${was !== hex ? p.dim(`was ${swatch}${oklchText(e.lchOf(was)).slice(6)} · ${was}`) : p.dim('as it opened')}`,
    )
  }
  lines.push('')
  lines.push(...channelLines(p, e, at, barWidth), contrastLine(p, e, barWidth))
  const scope = scopeLines(p, e)
  if (scope.length > 0) {
    lines.push(...scope)
  }
  if (e.view === 'relations') {
    lines.push('', ...relations(p, e, width, height - lines.length - 1, false))
    return lines
  }
  lines.push('')
  for (const check of detailChecks(e, slot, at)) {
    wrapText(check.text, width - 2).forEach((line, i) => {
      lines.push(`${i === 0 ? checkOf(p, check.ok) : ' '} ${check.ok === false ? line : p.dim(line)}`)
    })
  }
  const hint = fixHint(e, slot)
  if (hint) {
    lines.push(p.dim(`  ${hint}`))
  }
  const room = height - lines.length - 1
  if (room >= 3) {
    lines.push('', ...sample(p, colorsOf(e.shown()), width, room, e.scene, slot))
  }
  return lines
}

function seedSide(p: Paint, e: PaletteEditor, width: number, height: number): string[] {
  return [
    spread(`${p.bold('Sample')}  ${p.dim('what the seeds grow')}`, '', width),
    '',
    ...sample(p, colorsOf(e.list), width, height - 2, e.scene, -1),
  ]
}

const KEYS: [string, string][] = [
  [
    'Slots',
    '↑↓ slot · ←→ normal or bright · home end · pgup the base colors · pgdn the ANSI ones · n N the next and last miss',
  ],
  [
    'Tune',
    'enter or tab opens the picker over the list, under the slot · ↑↓ lightness · ←→ chroma · ⇧←→ hue by 5, , . by 1 · pgup pgdn lightness ×5 · tab ◐ contrast · home end the ends · 0-9 jump · enter keeps · esc undoes · a click outside it keeps',
  ],
  [
    'Contrast',
    '◐ moves lightness until the ratio to the color it is read against changes · home the gate’s floor · 1-9 that ratio',
  ],
  [
    'Chroma',
    'stops at the sRGB edge · what lightness or hue takes away comes back while you tune, where it fits again (○)',
  ],
  [
    'Scope',
    'a while tuning: this, pair, normals, brights or accents — the slots in it move by the same step, each keeping its own color',
  ],
  ['Relations', 'g shows the lightness, chroma and hue of every ANSI color at once, and the relations the gate checks'],
  ['Sample', '⇧←→ another tab · the slot under the cursor is underlined where it is used · w dims the rest'],
  [
    'Inspect',
    'i, or a click on the sample, finds the slots a spot uses · ←→↑↓ move · enter goes to the slot · esc leaves',
  ],
  [
    'Link',
    'l makes a bright follow its normal — tuning the normal moves it, tuning the bright alone unlinks it · = snaps it to its normal',
  ],
  ['Filter', 'm only the slots that changed · n and N walk the gate misses listed under the slots'],
  [
    'Export',
    'x copies the share code, an add command or the palette file · I takes colors from another palette or a share code',
  ],
  ['Type', '# then #rrggbb, rgb(r g b) or oklch(l c h) — a paste works too'],
  [
    'Slot',
    'c copies · v pastes · r puts it back as it opened, R all of them · = the bright follows its normal · * marks it a signature color',
  ],
  ['Palette', 'f moves the colors the gate misses · o takes another palette’s colors'],
  ['Gate', '✗ marks every slot whose own checks miss, and each miss names its slots'],
  ['History', 'u undo · ctrl+r redo'],
  [
    'Pictures',
    'p finds one on the boorus, tried on in these colors · b shows or hides it behind the editor · drop a picture on the window, or paste one, its path or its link · ctrl+v takes the clipboard’s',
  ],
  ['Compare', 'space shows the colors you started from, on the terminal too'],
  ['Save', 's saves · esc cancels, asking first when something changed'],
]

function keysPane(p: Paint, e: PaletteEditor, width: number): string[] {
  const lines = [`  ${p.bold('Help')}`, '']
  for (const [name, text] of KEYS.filter(([name]) => name !== 'Pictures' || e.options.find)) {
    wrapText(text, width - 16).forEach((line, i) => {
      lines.push(`  ${p.bold((i === 0 ? name : '').padEnd(11))}  ${line}`)
    })
  }
  return lines
}

function openPane(p: Paint, e: PaletteEditor, width: number, height: number): string[] {
  const choices = e.choices()
  const all = e.options.palettes?.length ?? 0
  const filter = e.filter ? `${p.bold(e.filter)}▏` : p.dim('type to filter')
  const lines = [spread(`  ${p.bold('Take colors from')}  ${filter}`, p.dim(`${choices.length}/${all}`), width), '']
  const room = height - 2
  const top = Math.max(0, Math.min(e.pick - Math.floor(room / 2), choices.length - room))
  const nameWidth = Math.min(40, Math.max(12, ...choices.map((c) => cells(c.name))))
  choices.slice(top, top + room).forEach((choice, k) => {
    const here = top + k === e.pick
    const c = choice.colors
    const swatches = p.color
      ? `${p.bg(c.background)} ${[...c.ansi].map((hex) => `${p.fg(hex)}${MARKS.swatch}`).join('')} ${p.fg(c.foreground)}Aa ${INK_RESET}`
      : ''
    const gutter = here ? '▌ ' : '  '
    const label = choice.name.padEnd(nameWidth)
    lines.push(spot({ kind: 'choice', index: top + k }, `${gutter}${here ? p.bold(label) : label}  ${swatches}`))
  })
  if (choices.length === 0) {
    lines.push(`  ${p.dim(`No palettes match '${e.filter}'`)}`)
  }
  return lines
}

const KEEP = new Set(['enter', 's', '?', 'g', 'a', 'i'])

function footer(p: Paint, e: PaletteEditor, width: number): string {
  let badge = 'EDIT'
  let lead = ''
  let keys: [string, string][] = []
  let right = ''
  if (e.quitting) {
    badge = 'EDIT (QUIT)'
    lead =
      e.added > 0 ? `Discard changes and ${e.added} ${e.added === 1 ? 'picture' : 'pictures'}?` : 'Discard changes?'
    keys = [
      ['y', 'discard'],
      ['n', 'keep editing'],
    ]
  } else if (e.typing !== undefined) {
    badge = 'EDIT (TYPE)'
    lead = p.dim('#rrggbb, rgb(r g b) or oklch(l c h)')
    keys = [
      ['enter', 'set'],
      ['ctrl+u', 'clear'],
    ]
    right = 'esc back'
  } else if (e.overlay === 'keys') {
    badge = 'HELP'
    right = 'any key closes'
  } else if (e.overlay === 'open') {
    badge = 'EDIT (OPEN)'
    keys = [
      ['↑↓', 'palette'],
      ['a-z', 'filter'],
      ['enter', 'take its colors'],
    ]
    right = 'esc close'
  } else if (e.menu) {
    badge = e.menu === 'export' ? 'EDIT (EXPORT)' : 'EDIT (IMPORT)'
    keys = [
      ['↑↓', 'item'],
      ['enter', 'choose'],
    ]
    right = 'esc close'
  } else if (e.compare) {
    badge = 'EDIT (BEFORE)'
    lead = 'The colors you started from'
    keys = [['space', 'back to yours']]
    right = 'esc back'
  } else if (e.mode === 'seeds') {
    badge = 'EDIT (SEEDS)'
    keys = [
      ['↑↓', 'seed'],
      ['←→', 'step'],
      ['⇧←→', '×5'],
      ['enter', 'tune the slots'],
      ['o', 'open a palette'],
      ['p', 'picture'],
      ['?', 'keys'],
    ]
    right = 'esc cancel'
  } else if (e.mode === 'tune') {
    badge = 'EDIT (TUNE)'
    keys = [
      ['↑↓', 'L'],
      ['←→', e.channel === CONTRAST ? 'ratio' : 'C'],
      ['⇧←→', 'H'],
      ['tab', '◐'],
      ...(e.slot() >= BASE.length ? ([['a', 'scope']] as [string, string][]) : []),
      [e.channel === CONTRAST ? '1-9' : '0-9', e.channel === CONTRAST ? 'ratio' : 'jump'],
      ['#', 'type'],
      ['enter', 'keep'],
    ]
    right = 'esc undo'
  } else if (e.inspect) {
    badge = 'EDIT (INSPECT)'
    keys = [
      ['←→↑↓', 'spot'],
      ['tab', 'pane'],
      ['enter', 'its slot'],
      ['i', 'leave'],
    ]
    right = 'esc leave'
  } else {
    keys = [
      ['↑↓', 'slot'],
      ['←→', 'normal or bright'],
      ['enter', 'tune'],
      ['i', 'inspect'],
      ['l', 'link'],
      ['m', 'changed'],
      ['g', e.view === 'slot' ? 'relations' : 'slot'],
      ...(e.misses().size > 0 ? ([['n', 'next miss']] as [string, string][]) : []),
      ['#', 'type'],
      ['f', 'fix'],
      ['p', 'picture'],
      ['b', 'picture layer'],
      ['x', 'export'],
      ['u', 'undo'],
      ['s', 'save'],
      ['?', 'keys'],
    ]
    right = 'esc cancel'
  }
  if (!e.options.find) {
    keys = keys.filter(([key]) => key !== 'p' && key !== 'b')
  }
  if (!e.options.exports || !e.roomy) {
    keys = keys.filter(([key]) => key !== 'x')
  }
  if (!e.roomy) {
    keys = keys.filter(([key]) => key !== 'i' && key !== 'm')
  }
  if (e.notice) {
    lead = p.warn(e.notice)
    keys = []
  }
  const tag = `${pillOf(p, badge)}${p.color ? '  ' : ' '}`
  const shownRight = right
    ? keyZone(
        right.split(' ')[0] as string,
        `${p.bold(right.split(' ')[0] as string)} ${p.dim(right.split(' ').slice(1).join(' '))}`,
      )
    : ''
  for (;;) {
    const segments = [lead, ...keys.map(([k, label]) => keyZone(k, `${p.bold(k)} ${p.dim(label)}`))].filter(Boolean)
    const line = `${tag}${segments.join('   ')}`
    let drop = -1
    keys.forEach(([key], i) => {
      if (i > 0 && !KEEP.has(key)) {
        drop = i
      }
    })
    if (cells(line) + cells(right) + 3 <= width || drop < 0) {
      return right ? spread(line, shownRight, width) : fit(line, width)
    }
    keys = keys.filter((_, i) => i !== drop)
  }
}

export function renderEditor(e: PaletteEditor, cols: number, rows: number, color: boolean, look: Look = {}): string[] {
  return drawEditor(e, cols, rows, color, look).lines
}

export function drawEditor(
  e: PaletteEditor,
  cols: number,
  rows: number,
  color: boolean,
  look: Look = {},
): { lines: string[]; art: Art | undefined } {
  const p = painter(color)
  if (cols < MIN_COLS || rows < MIN_ROWS) {
    const small = [
      p.bold('ttheme palette editor'),
      `Needs ${MIN_COLS}×${MIN_ROWS} — now ${cols}×${rows}`,
      p.dim('esc cancels'),
    ]
    return { lines: Array.from({ length: rows }, (_, i) => fit(small[i] ?? '', cols)), art: undefined }
  }
  e.viewport(cols, rows)
  if (!e.overlay && e.mode !== 'seeds') {
    const built = renderBuilder(e, cols, rows, color, look)
    if (built) {
      return { lines: [...built.lines, footer(p, e, cols)], art: built.art }
    }
  }
  const failing = e.failing().length
  const gate = failing === 0 ? '✓ Passes the gate' : `✗ ${failing} ${failing === 1 ? 'miss' : 'misses'} in the gate`
  const shelf = e.pictures > 0 ? p.dim(`▣ ${e.pictures} ${e.pictures === 1 ? 'picture' : 'pictures'}   `) : ''
  const state = `${e.dirty() ? `${p.warn(MARKS.on)} unsaved   ` : ''}${shelf}${p.dim(gate)}`
  const title = `${p.accent(MARKS.current)} ${p.bold(e.options.title)} ${p.dim(`· ${e.options.name}`)}`
  const height = rows - 4
  let body: string[]
  if (e.overlay === 'keys') {
    body = keysPane(p, e, cols)
  } else if (e.overlay === 'open') {
    body = openPane(p, e, cols, height)
  } else {
    const right = cols - LEFT - 2
    const left = e.mode === 'seeds' ? seedPane(p, e, height) : slotPane(p, e, height)
    const side = e.mode === 'seeds' ? seedSide(p, e, right, height) : detailPane(p, e, right, height)
    body = Array.from(
      { length: height },
      (_, i) => `${fit(left[i] ?? '', LEFT)}${p.dim('│')} ${fit(side[i] ?? '', right)}`,
    )
  }
  const lines = [spread(title, state, cols), '']
  for (let i = 0; i < height; i++) {
    lines.push(fit(body[i] ?? '', cols))
  }
  lines.push('', footer(p, e, cols))
  return { lines, art: undefined }
}

const PICKER_KEYS = new Set(['tab', 'a', '#', 'l', 'enter', 'esc'])
const PICKER_SPOTS = new Set(['picker', 'plane', 'bar', 'channel', 'format', 'scope', 'open', 'slot'])

function closesPicker(target: EditorSpot | undefined): boolean {
  if (!target) {
    return true
  }
  return target.kind === 'key' ? !PICKER_KEYS.has(target.key) : !PICKER_SPOTS.has(target.kind)
}

export function pointEditor(e: PaletteEditor, hit: Hit | undefined, event: Mouse): void {
  if (event.action === 'wheel') {
    if (!event.sideways) {
      e.scroll(event.wheel)
    }
    return
  }
  if ((event.action === 'press' || event.action === 'drag') && event.button !== 'left') {
    return
  }
  if (event.action === 'press' && e.overlay === 'keys') {
    e.press('esc')
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

export interface Surface {
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
    const seen = await terminal.ask(
      `${colorQuery(SLOT_CODES, '')}${pointing().length > 0 ? PIXEL_QUERY : ''}\x1b[c`,
      (event) => {
        if (event.kind === 'color') {
          own.set(event.code, event.value)
          return undefined
        }
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
        const { lines, art } = drawEditor(editor, terminal.cols, terminal.rows, surface.color, {
          behind: editor.pic && backdrop?.laid === true,
          art: layer?.ready === true,
          chrome,
        })
        return {
          lines,
          after: () =>
            `${
              (editor.pic
                ? backdrop?.draw(
                    editor.shown(),
                    editor.signature,
                    editor.waive,
                    terminal.cols,
                    terminal.rows,
                    pictureArea(terminal.cols, terminal.rows),
                  )
                : backdrop?.clear()) ?? ''
            }${layer?.draw(art) ?? ''}`,
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
        editor.notice = error instanceof Error ? error.message : String(error)
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
      terminal.write(layer?.clear() ?? '')
      screen.reset(CLEAR)
      screen.request()
    })
    if (backdrop) {
      backdrop.load()
      backdrop.ready = () => screen.request()
    }
    if (backdrop || layer) {
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
