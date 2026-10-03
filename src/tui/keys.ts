import { StringDecoder } from 'node:string_decoder'

export const ESC_WAIT = 30
const SEQUENCE_WAIT = 50

export interface Cell {
  w: number
  h: number
}

export type Inbound =
  | { kind: 'key'; key: string }
  | { kind: 'paste'; text: string }
  | { kind: 'osc'; code: string; meta: Record<string, string>; payload: string }
  | { kind: 'mode'; mode: number; value: number }
  | { kind: 'attributes' }
  | { kind: 'size'; of: 'cell' | 'window' | 'grid'; h: number; w: number }

export const CELL_QUERY = '\x1b]1337;ReportCellSize\x07\x1b[16t\x1b[14t\x1b[18t'

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
const OSC_CODE = /\](\d+)/y
const OSC_OPEN = /^\]\d*$/
const OSC_OPENED = /\]\d+;/y
const CELL_SIZE = /^1337;ReportCellSize=([\d.]+);([\d.]+)(?:;([\d.]+))?$/
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

type Step = { events: Inbound[]; end: number } | undefined

export function keyOf(ch: string): string | undefined {
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

function report(params: string, between: string, final: string): Inbound[] {
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

function csi(input: string, at: number, final: boolean): Step {
  CSI.lastIndex = at + 1
  const m = CSI.exec(input)
  if (!m) {
    return !final && CSI_OPEN.test(input.slice(at + 1)) ? undefined : lone(at)
  }
  const [whole, params = '', between = '', last = ''] = m
  const stop = at + 1 + whole.length
  if (params === '200' && last === '~') {
    const close = input.indexOf(PASTE_END, stop)
    if (close === -1) {
      return final ? { events: [{ kind: 'paste', text: input.slice(stop) }], end: input.length } : undefined
    }
    return { events: [{ kind: 'paste', text: input.slice(stop, close) }], end: close + PASTE_END.length }
  }
  return { events: report(params, between, last), end: stop }
}

function oscEvents(body: string): Inbound[] {
  const cell = CELL_SIZE.exec(body)
  if (cell) {
    const scale = Number(cell[3] ?? 1)
    return [
      { kind: 'size', of: 'cell', h: Math.round(Number(cell[1]) * scale), w: Math.round(Number(cell[2]) * scale) },
    ]
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

function sequence(input: string, at: number, final: boolean): Step {
  const next = input[at + 1]
  if (next === undefined) {
    return final ? lone(at) : undefined
  }
  if (next === '[') {
    return csi(input, at, final)
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

export function decode(input: string, final = false): { events: Inbound[]; rest: string } {
  const events: Inbound[] = []
  let at = 0
  while (at < input.length) {
    if (input[at] === '\x1b') {
      const step = sequence(input, at, final)
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
  private readonly utf8 = new StringDecoder('utf8')
  private readonly take: (events: Inbound[]) => void
  private readonly burst: (typed: string) => boolean

  constructor(take: (events: Inbound[]) => void, burst: (typed: string) => boolean = () => false) {
    this.take = take
    this.burst = burst
  }

  feed(chunk: Buffer | string): void {
    clearTimeout(this.timer)
    const text = typeof chunk === 'string' ? chunk : this.utf8.write(chunk)
    if (!this.held && !text.includes('\x1b') && this.burst(text)) {
      this.take([{ kind: 'paste', text }])
      return
    }
    if (long(this.held) && !ended(this.held, text)) {
      this.held += text
      return
    }
    const { events, rest } = decode(this.held + text)
    this.held = rest
    if (rest && !long(rest)) {
      this.timer = setTimeout(() => this.flush(), rest.length === 1 ? ESC_WAIT : SEQUENCE_WAIT)
    }
    if (events.length > 0) {
      this.take(events)
    }
  }

  flush(): void {
    clearTimeout(this.timer)
    const { events } = decode(this.held, true)
    this.held = ''
    if (events.length > 0) {
      this.take(events)
    }
  }

  stop(): void {
    clearTimeout(this.timer)
    this.held = ''
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
