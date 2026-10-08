import { performance } from 'node:perf_hooks'
import { StringDecoder } from 'node:string_decoder'

export const ESC_WAIT = 30
const SEQUENCE_WAIT = 50
export const CLICK_GAP = 500
const WHEEL_GAP = 5
const LEGACY = Buffer.from('\x1b[M')

export interface Cell {
  w: number
  h: number
}

export type Button = 'left' | 'middle' | 'right'

export interface Mouse {
  kind: 'mouse'
  action: 'press' | 'release' | 'drag' | 'move' | 'wheel'
  button: Button | undefined
  wheel: -1 | 0 | 1
  sideways: boolean
  row: number
  col: number
  shift: boolean
  alt: boolean
  ctrl: boolean
  count: number
  fx?: number
  fy?: number
}

export type Inbound =
  | { kind: 'key'; key: string }
  | { kind: 'paste'; text: string }
  | { kind: 'osc'; code: string; meta: Record<string, string>; payload: string }
  | { kind: 'color'; code: string; value: string }
  | { kind: 'mode'; mode: number; value: number }
  | { kind: 'attributes' }
  | { kind: 'size'; of: 'cell' | 'window' | 'grid'; h: number; w: number }
  | Mouse

export const CELL_QUERY = '\x1b]1337;ReportCellSize\x07\x1b[16t\x1b[14t\x1b[18t'
export const PIXEL_QUERY = '\x1b[?1016$p\x1b[16t'

const CSI_KEYS: Record<string, string> = {
  A: 'up',
  B: 'down',
  C: 'right',
  D: 'left',
  H: 'home',
  F: 'end',
  '1~': 'home',
  '7~': 'home',
  '3~': 'delete',
  '4~': 'end',
  '8~': 'end',
  '5~': 'pgup',
  '6~': 'pgdn',
  I: 'focus-in',
  O: 'focus-out',
  Z: 'shift-tab',
  '1;2C': 'shift-right',
  '1;2D': 'shift-left',
}

const NAMED: Record<string, string> = {
  '\r': 'enter',
  '\n': 'enter',
  '\t': 'tab',
  '\b': 'backspace',
  '\x7f': 'backspace',
  '\x1b': 'esc',
  '\x00': 'ctrl-space',
}

const CSI = /\[([0-?]*)([ -/]*)([@-~])/y
const CSI_OPEN = /^\[[0-?]*[ -/]*$/
const SGR_MOUSE = /\[(<-?\d+;-?\d+;-?\d+)([Mm])/y
const SGR_OPEN = /^\[<[-\d;]*$/
const OSC_CODE = /\](\d+)/y
const OSC_OPEN = /^\]\d*$/
const OSC_OPENED = /\]\d+;/y
const CELL_SIZE = /^1337;ReportCellSize=([\d.]+);([\d.]+)(?:;([\d.]+))?$/
const COLOR = /^(1[0-2]|17|4;\d{1,3});(rgba?:[0-9a-fA-F/]+)$/
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

type Step = { events: Inbound[]; end: number } | undefined

function keyOf(ch: string): string | undefined {
  const named = NAMED[ch]
  if (named) {
    return named
  }
  const code = ch.codePointAt(0) ?? 0
  if (code < 27) {
    return `ctrl-${String.fromCharCode(code + 96)}`
  }
  return code < 32 ? undefined : ch
}

function key(name: string): Inbound {
  return { kind: 'key', key: name }
}

function lone(at: number): { events: Inbound[]; end: number } {
  return { events: [key('esc')], end: at + 1 }
}

function metadata(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of text.split(':')) {
    const at = pair.indexOf('=')
    if (at > 0) {
      out[pair.slice(0, at)] = pair.slice(at + 1)
    }
  }
  return out
}

const BUTTONS: (Button | undefined)[] = ['left', 'middle', 'right', undefined]

function pointer(code: number, col: number, row: number, released: boolean): Mouse | undefined {
  if (!Number.isInteger(code) || code < 0 || code >= 128 || !(col >= 0) || !(row >= 0)) {
    return undefined
  }
  const low = code & 3
  const at = {
    kind: 'mouse' as const,
    row,
    col,
    shift: (code & 4) !== 0,
    alt: (code & 8) !== 0,
    ctrl: (code & 16) !== 0,
  }
  if (code & 64) {
    return { ...at, action: 'wheel', button: undefined, wheel: low % 2 === 0 ? -1 : 1, sideways: low >= 2, count: 0 }
  }
  const button = BUTTONS[low]
  const action = code & 32 ? (button ? 'drag' : 'move') : released || !button ? 'release' : 'press'
  return { ...at, action, button, wheel: 0, sideways: false, count: action === 'press' ? 1 : 0 }
}

function x10(input: string, stop: number, final: boolean): Step {
  const codes: number[] = []
  let end = stop
  while (codes.length < 3 && end < input.length) {
    const code = input.codePointAt(end) as number
    codes.push(code)
    end += code > 0xffff ? 2 : 1
  }
  if (codes.length < 3) {
    return final ? { events: [], end: input.length } : undefined
  }
  const [code = 0, x = 0, y = 0] = codes
  const mouse = Math.max(code, x, y) < 0x80 ? pointer(code - 32, x - 33, y - 33, false) : undefined
  return { events: mouse ? [mouse] : [], end }
}

function pixelled(code: number, x: number, y: number, released: boolean, cell: Cell): Mouse | undefined {
  const across = Math.max(0, x) / cell.w
  const down = Math.max(0, y) / cell.h
  const col = Math.floor(across)
  const row = Math.floor(down)
  const mouse = pointer(code, col, row, released)
  return mouse && { ...mouse, fx: across - col, fy: down - row }
}

function report(params: string, between: string, final: string, cell: Cell | undefined): Inbound[] {
  if ((final === 'M' || final === 'm') && between === '' && params.startsWith('<')) {
    const [code = -1, x = 0, y = 0] = params.slice(1).split(';').map(Number)
    const mouse = cell ? pixelled(code, x, y, final === 'm', cell) : pointer(code, x - 1, y - 1, final === 'm')
    return mouse ? [mouse] : []
  }
  if (final === 't' && between === '') {
    const [code, a = 0, b = 0] = params.split(';').map(Number)
    const of = code === 6 ? 'cell' : code === 4 ? 'window' : code === 8 ? 'grid' : undefined
    return of ? [{ kind: 'size', of, h: a, w: b }] : []
  }
  if (final === 'y' && between === '$' && params.startsWith('?')) {
    const [mode = 0, value = 0] = params.slice(1).split(';').map(Number)
    return [{ kind: 'mode', mode, value }]
  }
  if (final === 'c' && params.startsWith('?')) {
    return [{ kind: 'attributes' }]
  }
  const name = between === '' ? CSI_KEYS[`${params}${final}`] : undefined
  return name ? [key(name)] : []
}

function csi(input: string, at: number, final: boolean, cell: Cell | undefined): Step {
  SGR_MOUSE.lastIndex = at + 1
  const mouse = SGR_MOUSE.exec(input)
  if (mouse) {
    return { events: report(mouse[1] as string, '', mouse[2] as string, cell), end: at + 1 + mouse[0].length }
  }
  CSI.lastIndex = at + 1
  const m = CSI.exec(input)
  if (!m) {
    const rest = input.slice(at + 1)
    return !final && (CSI_OPEN.test(rest) || SGR_OPEN.test(rest)) ? undefined : lone(at)
  }
  const [whole, params = '', between = '', last = ''] = m
  const stop = at + 1 + whole.length
  if (params === '' && between === '' && last === 'M') {
    return x10(input, stop, final)
  }
  if (params === '200' && last === '~') {
    const close = input.indexOf(PASTE_END, stop)
    if (close === -1) {
      return final ? { events: [{ kind: 'paste', text: input.slice(stop) }], end: input.length } : undefined
    }
    return { events: [{ kind: 'paste', text: input.slice(stop, close) }], end: close + PASTE_END.length }
  }
  return { events: report(params, between, last, cell), end: stop }
}

function oscEvents(body: string): Inbound[] {
  const cell = CELL_SIZE.exec(body)
  if (cell) {
    const scale = Number(cell[3] ?? 1)
    return [
      { kind: 'size', of: 'cell', h: Math.round(Number(cell[1]) * scale), w: Math.round(Number(cell[2]) * scale) },
    ]
  }
  const color = COLOR.exec(body)
  if (color) {
    return [{ kind: 'color', code: color[1] as string, value: color[2] as string }]
  }
  const [code = '', meta = '', ...rest] = body.split(';')
  return [{ kind: 'osc', code, meta: metadata(meta), payload: rest.join(';') }]
}

function osc(input: string, at: number, final: boolean): Step {
  OSC_CODE.lastIndex = at + 1
  const code = OSC_CODE.exec(input)
  const after = code ? input[at + 1 + code[0].length] : undefined
  if (after !== ';' && after !== '\x07' && after !== '\x1b') {
    return !final && OSC_OPEN.test(input.slice(at + 1)) ? undefined : lone(at)
  }
  const ends = [input.indexOf('\x07', at), input.indexOf('\x1b\\', at + 2)].filter((end) => end !== -1)
  if (ends.length === 0) {
    return final ? { events: [], end: input.length } : undefined
  }
  const end = Math.min(...ends)
  return { events: oscEvents(input.slice(at + 2, end)), end: end + (input[end] === '\x07' ? 1 : 2) }
}

function ss3(input: string, at: number, final: boolean): Step {
  const last = input[at + 2]
  if (last === undefined) {
    return final ? lone(at) : undefined
  }
  if (!/^[A-Za-z]$/.test(last)) {
    return lone(at)
  }
  const name = CSI_KEYS[last]
  return { events: name ? [key(name)] : [], end: at + 3 }
}

function sequence(input: string, at: number, final: boolean, cell: Cell | undefined): Step {
  const next = input[at + 1]
  if (next === undefined) {
    return final ? lone(at) : undefined
  }
  if (next === '[') {
    return csi(input, at, final, cell)
  }
  if (next === ']') {
    return osc(input, at, final)
  }
  if (next === 'O') {
    return ss3(input, at, final)
  }
  if (next === '\x7f') {
    return { events: [key('alt-backspace')], end: at + 2 }
  }
  if (/^[a-z]$/.test(next)) {
    return { events: [key(`alt-${next}`)], end: at + 2 }
  }
  return lone(at)
}

export function decode(input: string, final = false, cell?: Cell): { events: Inbound[]; rest: string } {
  const events: Inbound[] = []
  let at = 0
  while (at < input.length) {
    if (input[at] === '\x1b') {
      const step = sequence(input, at, final, cell)
      if (!step) {
        return { events, rest: input.slice(at) }
      }
      events.push(...step.events)
      at = step.end
      continue
    }
    const ch = String.fromCodePoint(input.codePointAt(at) as number)
    const name = keyOf(ch)
    if (name) {
      events.push(key(name))
    }
    at += ch.length
  }
  return { events, rest: '' }
}

export function keysOf(input: string): string[] {
  return decode(input, true).events.flatMap((event) => (event.kind === 'key' ? [event.key] : []))
}

function legacy(bytes: Buffer): { bytes: Buffer; carry: Buffer | undefined } {
  let at = bytes.indexOf(LEGACY)
  if (at === -1) {
    return { bytes, carry: undefined }
  }
  const parts: Buffer[] = []
  let from = 0
  while (at !== -1 && at + 6 <= bytes.length) {
    parts.push(bytes.subarray(from, at))
    const [code = 0, x = 0, y = 0] = bytes.subarray(at + 3, at + 6)
    if (x > 32 && y > 32) {
      parts.push(Buffer.from(`\x1b[<${code - 32};${x - 32};${y - 32}M`))
    }
    from = at + 6
    at = bytes.indexOf(LEGACY, from)
  }
  parts.push(bytes.subarray(from, at === -1 ? bytes.length : at))
  return { bytes: Buffer.concat(parts), carry: at === -1 ? undefined : bytes.subarray(at) }
}

function long(held: string): boolean {
  OSC_OPENED.lastIndex = 1
  return held.startsWith(PASTE_START) || (held.startsWith('\x1b]') && OSC_OPENED.test(held))
}

function ended(held: string, text: string): boolean {
  const seam = held.slice(-PASTE_END.length) + text
  return held.startsWith(PASTE_START) ? seam.includes(PASTE_END) : seam.includes('\x07') || seam.includes('\x1b\\')
}

export class Keys {
  private held = ''
  private timer: NodeJS.Timeout | undefined
  private carry: Buffer | undefined
  private pressed: { at: number; button: Button; row: number; col: number; count: number } | undefined
  private wheeled: { at: number; way: number } | undefined
  private readonly utf8 = new StringDecoder('utf8')
  private readonly burst: (typed: string) => boolean
  private readonly cell: () => Cell | undefined
  private readonly take: (events: Inbound[]) => void

  constructor(
    take: (events: Inbound[]) => void,
    burst: (typed: string) => boolean = () => false,
    cell: () => Cell | undefined = () => undefined,
  ) {
    this.burst = burst
    this.cell = cell
    this.take = (events) => {
      const kept = this.counted(events)
      if (kept.length > 0) {
        take(kept)
      }
    }
  }

  private counted(events: Inbound[]): Inbound[] {
    const now = performance.now()
    return events.filter((event) => {
      if (event.kind !== 'mouse') {
        return true
      }
      if (event.action === 'wheel') {
        const way = event.wheel * (event.sideways ? 2 : 1)
        const last = this.wheeled
        if (last !== undefined && last.way === way && now - last.at < WHEEL_GAP) {
          return false
        }
        this.wheeled = { at: now, way }
        return true
      }
      if (event.action === 'release') {
        event.count = this.pressed?.count ?? 0
      }
      if (event.action !== 'press' || !event.button) {
        return true
      }
      const last = this.pressed
      const again =
        last !== undefined &&
        last.button === event.button &&
        last.row === event.row &&
        Math.abs(last.col - event.col) <= 1 &&
        now - last.at <= CLICK_GAP
      event.count = again ? last.count + 1 : 1
      this.pressed = { at: now, button: event.button, row: event.row, col: event.col, count: event.count }
      return true
    })
  }

  feed(chunk: Buffer | string): void {
    clearTimeout(this.timer)
    const text = typeof chunk === 'string' ? chunk : this.bytes(chunk)
    if (this.carry) {
      this.wait(SEQUENCE_WAIT)
    }
    if (!this.held && !text.includes('\x1b') && this.burst(text)) {
      this.take([{ kind: 'paste', text }])
      return
    }
    if (long(this.held) && !ended(this.held, text)) {
      this.held += text
      return
    }
    const { events, rest } = decode(this.held + text, false, this.cell())
    this.held = rest
    if (rest && !long(rest)) {
      this.wait(rest.length === 1 ? ESC_WAIT : SEQUENCE_WAIT)
    }
    if (events.length > 0) {
      this.take(events)
    }
  }

  private bytes(chunk: Buffer): string {
    const { bytes, carry } = legacy(this.carry ? Buffer.concat([this.carry, chunk]) : chunk)
    this.carry = carry
    return this.utf8.write(bytes)
  }

  private wait(ms: number): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), ms)
  }

  flush(): void {
    clearTimeout(this.timer)
    this.carry = undefined
    const { events } = decode(this.held, true, this.cell())
    this.held = ''
    if (events.length > 0) {
      this.take(events)
    }
  }

  stop(): void {
    clearTimeout(this.timer)
    this.held = ''
    this.carry = undefined
  }
}

export class CellProbe {
  private window: { h: number; w: number } | undefined
  private grid: { h: number; w: number } | undefined

  see(event: Inbound): Cell | undefined {
    if (event.kind !== 'size') {
      return undefined
    }
    if (event.of === 'cell') {
      return { w: event.w, h: event.h }
    }
    if (event.of === 'window') {
      this.window = event
    } else {
      this.grid = event
    }
    const shown = this.window
    const grid = this.grid
    return shown && grid && grid.h > 0 && grid.w > 0
      ? { h: Math.floor(shown.h / grid.h), w: Math.floor(shown.w / grid.w) }
      : undefined
  }
}

export class PixelProbe {
  private known = false
  private cell: Cell | undefined

  see(event: Inbound): { cell: Cell | undefined } | undefined {
    if (event.kind === 'mode' && event.mode === 1016) {
      this.known = event.value === 1 || event.value === 2
    } else if (event.kind === 'size' && event.of === 'cell' && event.w > 0 && event.h > 0) {
      this.cell = { w: event.w, h: event.h }
    } else if (event.kind === 'attributes') {
      return { cell: this.known ? this.cell : undefined }
    }
    return undefined
  }
}
