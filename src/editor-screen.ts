import { ansiFg, cells, fit, spread, wrapText } from './ansi.ts'
import { takeInbound } from './attach.ts'
import { contrast, type Hex, luminance, type Oklch, oklch, rgb } from './color.ts'
import type { Start } from './find.ts'
import { decodeKeys } from './find-screen.ts'
import { inGamut, srgb } from './fix.ts'
import { slotOsc } from './osc.ts'
import {
  BASE,
  CHANNELS,
  type Channel,
  colorsOf,
  type Edited,
  type EditorOptions,
  gateRows,
  PAIRS,
  PaletteEditor,
  ROWS,
  SLOT_NAMES,
  slotChecks,
  slotLabel,
} from './palette-editor.ts'
import type { Colors } from './seeds.ts'
import { grow, SEED_FIELDS, type Seeds } from './seeds.ts'
import { CLEAR } from './terminal.ts'

export const MIN_COLS = 80
export const MIN_ROWS = 24
const LEFT = 48
const SEED_BAR = 11

interface Paint {
  color: boolean
  dim(s: string): string
  bold(s: string): string
  fg(hex: Hex): string
  bg(hex: Hex): string
}

function painter(color: boolean): Paint {
  return {
    color,
    dim: (s) => (color ? `\x1b[2m${s}\x1b[22m` : s),
    bold: (s) => (color ? `\x1b[1m${s}\x1b[22m` : s),
    fg: (hex) => (color ? ansiFg(hex) : ''),
    bg: (hex) => (color ? `\x1b[48;2;${rgb(hex).join(';')}m` : ''),
  }
}

function ink(hex: Hex): Hex {
  return luminance(hex) > 0.35 ? '#000000' : '#ffffff'
}

function gradient(p: Paint, samples: (Hex | undefined)[], at: number, lit: boolean): string {
  const i = Math.max(0, Math.min(samples.length - 1, at))
  if (!p.color) {
    return samples.map((_, k) => (k === i ? '●' : lit ? '━' : '─')).join('')
  }
  return samples
    .map((hex, k) => {
      const shown = hex ?? '#000000'
      if (k === i) {
        return `${p.bg(shown)}${p.fg(ink(shown))}●\x1b[39;49m`
      }
      return hex ? `${p.fg(hex)}█` : `${p.fg(lit ? '#777777' : '#555555')}░`
    })
    .join('')
    .concat('\x1b[39m')
}

function channelSamples(want: Oklch, channel: Channel, width: number): (Hex | undefined)[] {
  return Array.from({ length: width }, (_, k) => {
    const value = channel.min + ((channel.max - channel.min) * k) / (width - 1)
    const next = { ...want, [channel.key]: value }
    return srgb(next.l, next.c, next.h) ? inGamut(next.l, next.c, next.h) : undefined
  })
}

function position(value: number, min: number, max: number, width: number): number {
  return Math.round(((value - min) / (max - min)) * (width - 1))
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

function checkMark(p: Paint, ok: boolean | undefined): string {
  return ok === undefined ? p.dim('·') : ok ? p.dim('✓') : p.bold('✗')
}

function gateLines(p: Paint, e: PaletteEditor, room: number): string[] {
  const rows = gateRows(e.list, e.signature, e.waive).sort((a, b) => Number(a.ok !== false) - Number(b.ok !== false))
  const failing = rows.filter((r) => r.ok === false).length
  const head = `  ${p.dim('Gate')}  ${failing === 0 ? p.dim('passes') : p.bold(`${failing} ${failing === 1 ? 'miss' : 'misses'}`)}`
  const width = LEFT - 4
  return [
    head,
    ...rows.slice(0, Math.max(0, room - 1)).map((r) => {
      const tail = `${r.value} ${r.bound}`
      return `  ${checkMark(p, r.ok)} ${spread(r.ok === false ? r.label : p.dim(r.label), p.dim(tail), width - 2)}`
    }),
  ]
}

function slotPane(p: Paint, e: PaletteEditor, height: number): string[] {
  const bad = e.misses()
  const c = colorsOf(e.list)
  const focus = e.slot()
  const lit = (text: string) => (p.color ? `${p.bg(c.selection)}${p.fg(c.foreground)}${text}\x1b[39;49m` : `[${text}]`)
  const cell = (slot: number) => {
    const hex = e.list[slot] as Hex
    const focused = slot === focus
    const glyph = e.signature.includes(SLOT_NAMES[slot] as string) ? '◆' : p.color ? '■' : ' '
    const ratio =
      slot === 0 ? undefined : slot === 3 ? contrast(c.foreground, c.selection) : contrast(hex, c.background)
    const shown = ratio === undefined ? '' : ratio.toFixed(1)
    const mark = bad.has(slot) ? '✗' : ' '
    const sw = p.color ? `${p.fg(hex)}${glyph}${focused ? p.fg(c.foreground) : '\x1b[39m'} ` : `${glyph} `
    const text = `${sw}${hex} ${shown.padStart(4)}${mark}`
    return focused ? lit(` ${text} `) : ` ${text} `
  }
  const gutter = (here: boolean) => (here ? (p.color ? `${p.fg(c.cursor)}▌\x1b[39m ` : '▌ ') : '  ')
  const lines = [`  ${p.dim('Base')}`]
  for (let row = 0; row < BASE.length; row++) {
    const here = row === e.row
    const label = (BASE[row] as string).padEnd(10)
    lines.push(`${gutter(here)}${here ? p.bold(label) : label}${cell(row)}`)
  }
  lines.push('', `  ${p.dim(`${'ANSI'.padEnd(10)}  Normal${' '.repeat(11)}Bright`)}`)
  for (let row = BASE.length; row < ROWS; row++) {
    const here = row === e.row
    const label = (PAIRS[row - BASE.length] as string).padEnd(10)
    lines.push(`${gutter(here)}${here ? p.bold(label) : label}${cell(row)}${cell(row + 8)}`)
  }
  lines.push('')
  return [...lines, ...gateLines(p, e, height - lines.length)]
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
    const gutter = here ? (p.color ? `${p.fg(c.cursor)}▌\x1b[39m ` : '▌ ') : '  '
    const label = field.label.padEnd(17)
    lines.push(
      `${gutter}${here ? p.bold(label) : label}${bar} ${shown}  ${p.color ? `${p.fg(hex)}■\x1b[39m ` : ''}${p.dim(hex)}`,
    )
  })
  lines.push('')
  for (const line of wrapText(
    'Seven seeds grow all twenty colors, each accent on the hue its ANSI role reads as — whatever the seeds, they pass the gate. enter moves on to tune each slot.',
    LEFT - 4,
  )) {
    lines.push(`  ${p.dim(line)}`)
  }
  lines.push('')
  return [...lines, ...gateLines(p, e, height - lines.length)]
}

export function specimen(p: Paint, c: Colors, width: number): string[] {
  const a = (i: number) => p.fg(c.ansi[i] as Hex)
  const f = p.fg(c.foreground)
  const base = `${p.bg(c.background)}${f}`
  const b = (s: string) => (p.color ? `\x1b[1m${s}\x1b[22m` : s)
  const pr = `${a(2)}❯${f} `
  const cw = Math.max(2, Math.min(4, Math.floor((width - 9) / 8)))
  const strip = Array.from(
    { length: 8 },
    (_, i) => `${p.fg(c.ansi[i] as Hex)}${p.bg(c.ansi[i + 8] as Hex)}${(p.color ? '▀' : '#').repeat(cw)}${base} `,
  ).join('')
  const lines = [
    strip,
    '',
    `${b(`${a(4)}~/code/demo`)}${f} on ${a(5)}main${a(2)} +2${a(3)} ~1${f}`,
    `${pr}git status -sb`,
    `## ${a(2)}main${f}...${a(1)}origin/main${a(3)} [ahead 1]${f}`,
    `${a(1)} M${f} src/main.rs   ${a(1)}??${f} notes.md`,
    `${pr}git diff`,
    `${a(6)}@@ -12,2 +12,2 @@${f}`,
    `${a(1)}- let size = 12;${f}`,
    `${a(2)}+ let size = 14;${f}`,
    `${pr}cargo test`,
    `${a(2)} ✓${f} parses config`,
    `${a(1)} ✗${f} renders frame  ${a(8)}expected 3, received 2${f}`,
    `${a(11)} ⚠ 1 warning${f}  ${a(12)}ℹ 2 notes${f}  ${a(13)}λ${f} ${a(14)}~${f}  ${a(9)}✗${f}  ${a(10)}✓${f}`,
    `${pr}ls`,
    `${b(`${a(4)}docs`)}  ${b(`${a(4)}src`)}  ${a(2)}run.sh${f}  ${a(6)}link${f}  Cargo.toml`,
    `${pr}echo ${p.bg(c.selection)}selected text${base} ${p.bg(c.cursor)} ${base}`,
    `${a(7)}ansi 7 text${f}  ${a(15)}ansi 15 text${f}  ${a(8)}# ansi 8 comment${f}`,
  ]
  return lines.map((line) => `${base} ${fit(line, width - 2)} ${p.color ? '\x1b[0m' : ''}`)
}

function detailPane(p: Paint, e: PaletteEditor, width: number, height: number): string[] {
  const slot = e.slot()
  const hex = e.list[slot] as Hex
  const want = e.lch[slot] as Oklch
  const real = oklch(hex)
  const was = e.start[slot] as Hex
  const { name, about } = slotLabel(slot)
  const sig = e.signature.includes(SLOT_NAMES[slot] as string)
  const lines = [spread(`${p.bold(name)}  ${p.dim(about)}`, sig ? p.dim('◆ signature') : '', width), '']
  const block = p.color ? `${p.fg(hex)}${'█'.repeat(8)}\x1b[39m  ` : ''
  const typed = e.typing !== undefined ? `${p.bold(`${e.typing}▏`)}` : undefined
  const [r, g, b] = rgb(hex)
  const top =
    typed ?? `${p.bold(hex)}${was !== hex ? p.dim(`  was ${p.color ? `${p.fg(was)}■\x1b[39m ` : ''}${was}`) : ''}`
  lines.push(`${block}${top}`)
  lines.push(`${block}${p.dim(`rgb ${r} ${g} ${b}`)}`)
  lines.push(`${block}${p.dim(`oklch ${real.l.toFixed(3)} ${real.c.toFixed(3)} ${real.h.toFixed(0)}°`)}`)
  lines.push('')
  const barWidth = Math.max(8, Math.min(64, width - 12))
  CHANNELS.forEach((channel, i) => {
    const here = e.mode === 'tune' && i === e.channel
    const value = want[channel.key]
    const shown = `${value.toFixed(channel.digits)}${channel.wraps ? '°' : ''}`.padStart(6)
    const bar = gradient(
      p,
      channelSamples(want, channel, barWidth),
      position(value, channel.min, channel.max, barWidth),
      here,
    )
    const label = channel.key.toUpperCase()
    lines.push(`${here ? p.bold(`▸${label}`) : p.dim(` ${label}`)} ${bar} ${here ? p.bold(shown) : p.dim(shown)}`)
  })
  lines.push('')
  const checks = slotChecks(e.list, e.signature, e.waive, slot)
  if (real.c < want.c - 0.005) {
    checks.push({ ok: undefined, text: `Chroma held at the sRGB edge — ${real.c.toFixed(3)} of ${want.c.toFixed(3)}` })
  }
  for (const check of checks) {
    wrapText(check.text, width - 2).forEach((line, i) => {
      lines.push(`${i === 0 ? checkMark(p, check.ok) : ' '} ${check.ok === false ? line : p.dim(line)}`)
    })
  }
  const room = height - lines.length - 1
  if (room >= 3) {
    lines.push('', ...specimen(p, colorsOf(e.shown()), width).slice(0, room))
  }
  return lines
}

function seedSide(p: Paint, e: PaletteEditor, width: number, height: number): string[] {
  return [
    spread(`${p.bold('Specimen')}  ${p.dim('what the seeds grow')}`, '', width),
    '',
    ...specimen(p, colorsOf(e.list), width).slice(0, height - 2),
  ]
}

const KEYS: [string, string][] = [
  ['Slots', '↑↓ slot · ←→ normal or bright · home end · pgup the base colors · pgdn the ANSI ones'],
  ['Tune', 'tab · ↑↓ lightness, chroma or hue · ←→ step · ⇧←→ ×5, hue ×10 · 0-9 jump · enter keeps · esc undoes'],
  ['Type', '# then #rrggbb, rgb(r g b) or oklch(l c h) — a paste works too'],
  ['Slot', 'c copies · v pastes · r puts it back · = the bright follows its normal · * marks it a signature color'],
  ['Palette', 'f moves the colors the gate misses · o takes another palette’s colors · s goes back to the seeds'],
  ['History', 'u undo · ctrl+r redo'],
  [
    'Pictures',
    'p finds one on the boorus, tried on in these colors · drop a picture on the window, or paste one, its path or its link · ctrl+v takes the clipboard’s',
  ],
  ['Compare', 'space shows the colors you started from, on the terminal too'],
  ['Save', 'enter saves · esc cancels, asking first when something changed'],
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
      ? `${p.bg(c.background)} ${[...c.ansi].map((hex) => `${p.fg(hex)}■`).join('')} ${p.fg(c.foreground)}Aa \x1b[0m`
      : ''
    const gutter = here ? '▌ ' : '  '
    const label = choice.name.padEnd(nameWidth)
    lines.push(`${gutter}${here ? p.bold(label) : label}  ${swatches}`)
  })
  if (choices.length === 0) {
    lines.push(`  ${p.dim(`No palettes match '${e.filter}'`)}`)
  }
  return lines
}

function footer(p: Paint, e: PaletteEditor, width: number): string {
  const accent = p.fg(e.list[2] as Hex)
  let badge = ''
  let lead = ''
  let keys: [string, string][] = []
  let right = ''
  if (e.quitting) {
    badge = 'QUIT'
    lead =
      e.added > 0 ? `Discard changes and ${e.added} ${e.added === 1 ? 'picture' : 'pictures'}?` : 'Discard changes?'
    keys = [
      ['y', 'discard'],
      ['n', 'keep editing'],
    ]
  } else if (e.typing !== undefined) {
    badge = 'TYPE'
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
    badge = 'OPEN'
    keys = [
      ['↑↓', 'palette'],
      ['a-z', 'filter'],
      ['enter', 'take its colors'],
    ]
    right = 'esc close'
  } else if (e.compare) {
    badge = 'BEFORE'
    lead = 'The colors you started from'
    keys = [['space', 'back to yours']]
    right = 'esc back'
  } else if (e.mode === 'seeds') {
    badge = 'SEEDS'
    keys = [
      ['↑↓', 'seed'],
      ['←→', 'step'],
      ['⇧←→', '×5'],
      ['enter', 'tune slots'],
      ['o', 'open a palette'],
      ['p', 'picture'],
      ['?', 'keys'],
    ]
    right = e.fresh && !e.dirty() ? 'esc cancel' : 'esc back'
  } else if (e.mode === 'tune') {
    badge = 'IMAGE EDIT'
    keys = [
      ['↑↓', 'L C H'],
      ['←→', 'step'],
      ['⇧←→', 'faster'],
      ['0-9', 'jump'],
      ['#', 'type'],
      ['enter', 'keep'],
    ]
    right = 'esc undo'
  } else {
    keys = [
      ['↑↓', 'slot'],
      ['←→', 'normal or bright'],
      ['tab', 'tune'],
      ['#', 'type'],
      ['f', 'fix'],
      ['p', 'picture'],
      ['u', 'undo'],
      ['enter', 'save'],
      ['?', 'keys'],
    ]
    right = 'esc cancel'
  }
  if (!e.options.find) {
    keys = keys.filter(([key]) => key !== 'p')
  }
  if (e.notice) {
    lead = p.color ? `\x1b[33m${e.notice}\x1b[39m` : e.notice
    keys = []
  }
  const tag = badge ? (p.color ? `\x1b[7;1m${accent} ${badge} \x1b[0m  ` : `[${badge}] `) : ''
  const shownRight = right
    ? `${p.bold(right.split(' ')[0] as string)} ${p.dim(right.split(' ').slice(1).join(' '))}`
    : ''
  for (;;) {
    const segments = [lead, ...keys.map(([k, label]) => `${p.bold(k)} ${p.dim(label)}`)].filter(Boolean)
    const line = `${tag}${segments.join('   ')}`
    if (cells(line) + cells(right) + 3 <= width || keys.length <= 1) {
      return right ? spread(line, shownRight, width) : fit(line, width)
    }
    keys = [...keys.slice(0, -2), ...keys.slice(-1)]
  }
}

export function renderEditor(e: PaletteEditor, cols: number, rows: number, color: boolean): string[] {
  const p = painter(color)
  if (cols < MIN_COLS || rows < MIN_ROWS) {
    const small = [
      p.bold('ttheme palette editor'),
      `Needs ${MIN_COLS}×${MIN_ROWS} — now ${cols}×${rows}`,
      p.dim('esc cancels'),
    ]
    return Array.from({ length: rows }, (_, i) => fit(small[i] ?? '', cols))
  }
  const failing = e.failing().length
  const gate = failing === 0 ? '✓ Passes the gate' : `✗ ${failing} ${failing === 1 ? 'miss' : 'misses'} in the gate`
  const shelf = e.pictures > 0 ? p.dim(`▣ ${e.pictures} ${e.pictures === 1 ? 'picture' : 'pictures'}   `) : ''
  const state = `${e.dirty() ? `${p.color ? '\x1b[33m●\x1b[39m' : '●'} unsaved   ` : ''}${shelf}${p.dim(gate)}`
  const accent = p.fg(e.list[2] as Hex)
  const title = `${accent}◆${p.color ? '\x1b[39m' : ''} ${p.bold(e.options.title)} ${p.dim(`· ${e.options.name}`)}`
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
  return lines
}

export interface Screen {
  only?: readonly number[]
  look?: (shown: readonly Hex[]) => void
  color: boolean
}

export async function runEditor(options: EditorOptions, screen: Screen): Promise<Edited | undefined> {
  const editor = new PaletteEditor(options)
  const { stdin, stdout } = process
  let cols = stdout.columns || MIN_COLS
  let rows = stdout.rows || MIN_ROWS
  let drawn: string[] = []
  const painted: (Hex | undefined)[] = []
  let looked = ''
  let input = ''
  let timer: NodeJS.Timeout | undefined
  const write = (text: string) => stdout.write(text)
  const paint = () => {
    timer = undefined
    if (screen.look) {
      const shown = editor.shown()
      if (shown.join(' ') !== looked) {
        looked = shown.join(' ')
        screen.look(shown)
      }
      return
    }
    let out = ''
    editor.shown().forEach((hex, slot) => {
      if (painted[slot] !== hex && screen.only?.includes(slot)) {
        out += slotOsc(slot, hex)
        painted[slot] = hex
      }
    })
    if (out) {
      write(out)
    }
  }
  const draw = () => {
    const lines = renderEditor(editor, cols, rows, screen.color)
    let out = ''
    lines.forEach((line, r) => {
      if (drawn[r] !== line) {
        out += `\x1b[${r + 1};1H\x1b[0m\x1b[2K${line}`
      }
    })
    drawn = lines
    if (out) {
      write(`\x1b[?2026h${out}\x1b[0m\x1b[?2026l`)
    }
    if (screen.only || screen.look) {
      timer ??= setTimeout(paint, 33)
    }
  }
  let onData: ((chunk: Buffer) => void) | undefined
  let onResize: (() => void) | undefined
  let away = false
  const enter = () => {
    write(`\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[?2004h${CLEAR}`)
    stdin.setRawMode(true)
    stdin.resume()
  }
  const listen = (on: boolean) => {
    if (onData && onResize) {
      stdin[on ? 'on' : 'off']('data', onData)
      stdout[on ? 'on' : 'off']('resize', onResize)
    }
  }
  enter()
  try {
    return await new Promise<Edited | undefined>((resolve) => {
      const visit = async (start: Start | undefined) => {
        const find = options.find
        if (!find) {
          return
        }
        away = true
        listen(false)
        clearTimeout(timer)
        timer = undefined
        try {
          editor.found(await find(editor.edited(), start))
        } catch (error) {
          editor.notice = error instanceof Error ? error.message : String(error)
        }
        away = false
        enter()
        listen(true)
        cols = stdout.columns || cols
        rows = stdout.rows || rows
        drawn = []
        painted.length = 0
        looked = ''
        draw()
      }
      onResize = () => {
        cols = stdout.columns || cols
        rows = stdout.rows || rows
        drawn = []
        write(CLEAR)
        draw()
      }
      onData = (chunk: Buffer) => {
        input += chunk.toString('utf8')
        const taken = takeInbound(input)
        input = taken.pending
        for (const event of taken.events) {
          if (event.kind === 'paste') {
            editor.paste(event.text)
          }
        }
        if (taken.keys.length > 8 && /^(?:\/|~\/|file:|https?:)/.test(taken.keys) && editor.typing === undefined) {
          editor.paste(taken.keys)
        } else {
          for (const key of decodeKeys(taken.keys)) {
            editor.press(key)
            if (editor.result || editor.wants) {
              break
            }
          }
        }
        if (editor.result) {
          resolve(editor.result === 'saved' ? editor.edited() : undefined)
          return
        }
        const wants = editor.wants
        if (wants && !away) {
          editor.wants = undefined
          void visit(wants.start)
          return
        }
        draw()
      }
      listen(true)
      draw()
    })
  } finally {
    clearTimeout(timer)
    listen(false)
    stdin.setRawMode(false)
    stdin.pause()
    write('\x1b[?2004l\x1b[?7h\x1b[?25h\x1b[?1049l')
  }
}
