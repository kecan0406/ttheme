import { performance } from 'node:perf_hooks'
import { fit } from '../ansi.ts'
import type { Mouse } from './keys.ts'
import { RESET } from './style.ts'
import { type Hit, lifted, marking, Pointer, type Zone } from './zones.ts'

const FRAME_GAP = 16
export const BEAT = 80

const BEGIN = '\x1b[?2026h'
const END = '\x1b[?2026l'

export interface Frame {
  lines: string[]
  after?: (rewritten: ReadonlySet<number>) => string
  cursor?: string
  ticking?: boolean
  zones?: Zone[]
}

export interface ScreenOptions {
  write: (text: string) => void
  view: () => Frame | undefined
  beat?: () => void
}

export class Screen {
  private shown: string[] = []
  private readonly pointer = new Pointer()
  private cursor = ''
  private wipe = ''
  private immediate: NodeJS.Immediate | undefined
  private delayed: NodeJS.Timeout | undefined
  private ticker: NodeJS.Timeout | undefined
  private last = Number.NEGATIVE_INFINITY
  private stopped = false
  private readonly write: (text: string) => void
  private readonly view: () => Frame | undefined
  private readonly beat: () => void

  constructor(options: ScreenOptions) {
    this.write = options.write
    this.view = options.view
    this.beat = options.beat ?? (() => {})
  }

  request(): void {
    if (this.stopped || this.immediate || this.delayed) {
      return
    }
    const wait = this.last + FRAME_GAP - performance.now()
    if (wait > 0) {
      this.delayed = setTimeout(this.paint, wait)
    } else {
      this.immediate = setImmediate(this.paint)
    }
  }

  soon(): void {
    if (this.stopped || this.immediate) {
      return
    }
    clearTimeout(this.delayed)
    this.delayed = undefined
    this.immediate = setImmediate(this.paint)
  }

  now(): void {
    this.cancel()
    this.paint()
  }

  reset(wipe = ''): void {
    this.shown = []
    this.cursor = ''
    this.wipe = wipe
  }

  stop(): void {
    this.stopped = true
    this.cancel()
    clearInterval(this.ticker)
    this.ticker = undefined
  }

  point(event: Mouse): Hit | undefined {
    return this.pointer.point(event)
  }

  drop(): void {
    this.pointer.drop()
  }

  private cancel(): void {
    clearImmediate(this.immediate)
    clearTimeout(this.delayed)
    this.immediate = undefined
    this.delayed = undefined
  }

  private readonly paint = (): void => {
    this.immediate = undefined
    this.delayed = undefined
    if (this.stopped) {
      return
    }
    const { drawn: frame, targets } = marking(() => this.view())
    if (!frame) {
      return
    }
    this.last = performance.now()
    const { lines, zones } = lifted(frame.lines, targets)
    this.pointer.zones = [...(frame.zones ?? []), ...zones]
    let out = this.wipe
    this.wipe = ''
    const rewritten = new Set<number>()
    const count = Math.max(lines.length, this.shown.length)
    for (let row = 0; row < count; row++) {
      const line = lines[row]
      if (line !== this.shown[row]) {
        out += `\x1b[${row + 1};1H${RESET}\x1b[2K${line ?? ''}`
        rewritten.add(row)
      }
    }
    this.shown = lines
    const after = frame.after?.(rewritten) ?? ''
    const cursor = frame.cursor ?? ''
    const moved = cursor !== '' && (out !== '' || after !== '' || cursor !== this.cursor)
    this.cursor = cursor
    if (out || after || moved) {
      this.write(`${BEGIN}${out}${after}${RESET}${moved ? cursor : ''}${END}`)
    }
    this.tick(frame.ticking === true)
  }

  private tick(on: boolean): void {
    if (on && !this.ticker) {
      this.ticker = setInterval(() => {
        this.beat()
        this.request()
      }, BEAT)
    } else if (!on && this.ticker) {
      clearInterval(this.ticker)
      this.ticker = undefined
    }
  }
}

export class Inline {
  private shown: string[] = []
  private readonly write: (text: string) => void
  private readonly cols: () => number

  constructor(write: (text: string) => void, cols: () => number) {
    this.write = write
    this.cols = cols
  }

  draw(frame: string[]): void {
    this.put(frame, '')
  }

  redraw(frame: string[]): void {
    const back = `${this.shown.length > 1 ? `\x1b[${this.shown.length - 1}A` : ''}${this.shown.length > 0 ? '\r\x1b[J' : ''}`
    this.shown = []
    this.put(frame, back)
  }

  end(frame: string[]): void {
    this.put(frame, '')
    this.write('\n')
    this.shown = []
  }

  private put(frame: string[], back: string): void {
    const lines = frame.map((line) => fit(line, this.cols() - 1, false))
    let first = 0
    while (first < lines.length && first < this.shown.length && lines[first] === this.shown[first]) {
      first++
    }
    if (first === lines.length && lines.length === this.shown.length) {
      return
    }
    if (first === lines.length) {
      first = Math.max(0, lines.length - 1)
    }
    let out = ''
    if (this.shown.length === 0) {
      out = lines.join('\n')
    } else if (first >= this.shown.length) {
      out = `\n${lines.slice(first).join('\n')}`
    } else {
      const up = this.shown.length - 1 - first
      out = `${up > 0 ? `\x1b[${up}A` : ''}\r\x1b[J${lines.slice(first).join('\n')}`
    }
    this.shown = lines
    this.write(`${BEGIN}${back}${out}${END}`)
  }
}
