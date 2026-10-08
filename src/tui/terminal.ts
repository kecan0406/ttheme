import type { Readable, Writable } from 'node:stream'
import { type Cell, type Inbound, Keys } from './keys.ts'

interface Mode {
  on: string
  off: string
}

export const ALT_SCREEN: Mode = { on: '\x1b[?1049h', off: '\x1b[?1049l' }
export const HIDE_CURSOR: Mode = { on: '\x1b[?25l', off: '\x1b[?25h' }
export const NO_WRAP: Mode = { on: '\x1b[?7l', off: '\x1b[?7h' }
export const PASTES: Mode = { on: '\x1b[?2004h', off: '\x1b[?2004l' }
export const FOCUS: Mode = { on: '\x1b[?1004h', off: '\x1b[?1004l' }
const MOUSE: Mode = { on: '\x1b[?1000h\x1b[?1002h\x1b[?1006h', off: '\x1b[?1006l\x1b[?1002l\x1b[?1000l' }
const PIXELS: Mode = { on: '\x1b[?1016h', off: '\x1b[?1016l\x1b[?1006h' }

export function pointing(env: Record<string, string | undefined> = process.env): Mode[] {
  return env.TTHEME_MOUSE === 'off' ? [] : [MOUSE]
}

const SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGTERM: 15 } as const
const LINGER = 3000

type Input = Readable & { isTTY?: boolean; setRawMode?: (on: boolean) => unknown }
type Output = Writable & { isTTY?: boolean; columns?: number; rows?: number }

interface TerminalOptions {
  input?: Input
  output?: Output
  modes?: Mode[]
  assume?: Mode[]
  burst?: (typed: string) => boolean
}

export class Signalled extends Error {
  readonly exit: number

  constructor(signal: keyof typeof SIGNALS) {
    super(signal)
    this.exit = 128 + SIGNALS[signal]
  }
}

const opened: Terminal[] = []
const held = new Map<Mode, number>()
const raw = new Map<Input, number>()
let pixelCell: Cell | undefined

function topFor(input: Input): Terminal | undefined {
  return opened.findLast((terminal) => terminal.input === input)
}

let lingering: NodeJS.Timeout | undefined

function failAll(error: unknown): void {
  for (const terminal of [...opened].reverse()) {
    terminal.abort(error)
  }
  if (!lingering) {
    lingering = setTimeout(() => {
      exiting()
      process.exit(error instanceof Signalled ? error.exit : 1)
    }, LINGER).unref()
  }
}

const onSignal = Object.fromEntries(
  Object.keys(SIGNALS).map((name) => [name, () => failAll(new Signalled(name as keyof typeof SIGNALS))]),
)

function exiting(): void {
  for (const terminal of [...opened].reverse()) {
    terminal.close()
  }
}

function continued(): void {
  for (const terminal of opened) {
    terminal.reassert()
  }
  opened.at(-1)?.redraw()
}

function guard(on: boolean): void {
  const method = on ? 'on' : 'off'
  for (const [name, handler] of Object.entries(onSignal)) {
    process[method](name, handler)
  }
  process[method]('uncaughtException', failAll)
  process[method]('exit', exiting)
  if (process.platform !== 'win32') {
    process[method]('SIGCONT', continued)
  }
}

function ignore(): void {}

export class Terminal {
  readonly input: Input
  readonly output: Output
  readonly failed: Promise<never>
  private readonly modes: Mode[] = []
  private readonly assumed: Mode[]
  private readonly owned: Mode[] = []
  private readonly keys: Keys
  private readonly tty: boolean
  private take: ((events: Inbound[]) => void) | undefined
  private resized: (() => void) | undefined
  private queued: Inbound[] = []
  private asking: { pick: (event: Inbound) => boolean; hold: boolean } | undefined
  private reject: (error: unknown) => void = ignore
  private open = true
  private aborted = false

  constructor(options: TerminalOptions = {}) {
    this.input = options.input ?? process.stdin
    this.output = options.output ?? process.stdout
    this.tty = this.output.isTTY === true && this.input.isTTY === true
    this.assumed = options.assume ?? []
    this.keys = new Keys(
      (events) => this.deliver(events),
      options.burst,
      () => (held.has(PIXELS) ? pixelCell : undefined),
    )
    this.failed = new Promise<never>((_, reject) => {
      this.reject = reject
    })
    this.failed.catch(ignore)
    if (this.tty && !opened.some((terminal) => terminal.tty)) {
      guard(true)
    }
    opened.push(this)
    let out = ''
    for (const mode of this.assumed) {
      if (!held.has(mode)) {
        out += mode.on
      }
    }
    for (const mode of options.modes ?? []) {
      out += this.claim(mode)
    }
    this.write(out)
    const rawCount = raw.get(this.input) ?? 0
    if (rawCount === 0) {
      this.input.setRawMode?.(true)
    }
    raw.set(this.input, rawCount + 1)
    this.input.on('data', this.received)
    this.input.resume()
    this.output.on('resize', this.resizing)
    this.output.on('error', ignore)
  }

  hold(mode: Mode): void {
    this.write(this.claim(mode))
  }

  pixels(cell: Cell): void {
    pixelCell = cell
    this.hold(PIXELS)
  }

  get cols(): number {
    return this.output.columns || 80
  }

  get rows(): number {
    return this.output.rows || 24
  }

  write(text: string): void {
    if (text && this.open) {
      this.output.write(text)
    }
  }

  listen(take: (events: Inbound[]) => void): void {
    this.take = take
    const queued = this.queued
    this.queued = []
    if (queued.length > 0) {
      take(queued)
    }
  }

  onResize(resized: () => void): void {
    this.resized = resized
  }

  until<T>(work: Promise<T>): Promise<T> {
    return Promise.race([work, this.failed])
  }

  loop<T>(take: (event: Inbound) => T | undefined, after: () => void = () => {}): Promise<T> {
    return this.until(
      new Promise<T>((resolve) => {
        let over = false
        this.listen((events) => {
          for (const event of events) {
            const done = over ? undefined : take(event)
            if (done !== undefined) {
              over = true
              resolve(done)
            }
          }
          if (!over) {
            after()
          }
        })
      }),
    )
  }

  ask<T>(query: string, pick: (event: Inbound) => T | undefined, wait: number, hold = true): Promise<T | undefined> {
    return new Promise((resolve) => {
      const asking = {
        hold,
        pick: (event: Inbound) => {
          const value = pick(event)
          if (value === undefined) {
            return false
          }
          done(value)
          return true
        },
      }
      const done = (value: T | undefined) => {
        clearTimeout(timer)
        if (this.asking === asking) {
          this.asking = undefined
        }
        resolve(value)
        this.release()
      }
      const timer = setTimeout(() => done(undefined), wait)
      this.asking = asking
      this.write(query)
    })
  }

  abort(error: unknown): void {
    if (this.aborted) {
      return
    }
    this.aborted = true
    this.keys.stop()
    this.reject(error)
  }

  redraw(): void {
    this.resized?.()
  }

  reassert(): void {
    if (this.open) {
      this.input.setRawMode?.(true)
      this.write([...this.assumed, ...this.owned].map((mode) => mode.on).join(''))
    }
  }

  close(): void {
    if (!this.open) {
      return
    }
    this.keys.stop()
    this.input.off('data', this.received)
    this.output.off('resize', this.resizing)
    let out = ''
    for (const mode of [...this.modes].reverse()) {
      const count = (held.get(mode) ?? 1) - 1
      if (count === 0) {
        held.delete(mode)
        out += mode.off
      } else {
        held.set(mode, count)
      }
    }
    this.write(out)
    this.open = false
    const rawCount = (raw.get(this.input) ?? 1) - 1
    if (rawCount === 0) {
      raw.delete(this.input)
      this.input.setRawMode?.(false)
      this.input.pause()
    } else {
      raw.set(this.input, rawCount)
    }
    this.output.off('error', ignore)
    opened.splice(opened.indexOf(this), 1)
    if (this.tty && !opened.some((terminal) => terminal.tty)) {
      guard(false)
    }
  }

  private readonly received = (chunk: Buffer | string): void => {
    if (topFor(this.input) === this && !this.aborted) {
      this.keys.feed(chunk)
    }
  }

  private readonly resizing = (): void => {
    if (topFor(this.input) === this) {
      this.resized?.()
    }
  }

  private claim(mode: Mode): string {
    this.modes.push(mode)
    const count = held.get(mode) ?? 0
    held.set(mode, count + 1)
    if (count > 0) {
      return ''
    }
    this.owned.push(mode)
    return mode.on
  }

  private deliver(events: Inbound[]): void {
    const asking = this.asking
    const passed = asking ? events.filter((event) => !asking.pick(event)) : events
    if (passed.length === 0) {
      return
    }
    if (!this.take || this.asking?.hold) {
      this.queued.push(...passed)
      return
    }
    this.take(passed)
  }

  private release(): void {
    if (this.take && this.queued.length > 0) {
      const queued = this.queued
      this.queued = []
      this.take(queued)
    }
  }
}

export async function within<T>(options: TerminalOptions, body: (terminal: Terminal) => Promise<T>): Promise<T> {
  const terminal = new Terminal(options)
  try {
    return await body(terminal)
  } finally {
    terminal.close()
  }
}
