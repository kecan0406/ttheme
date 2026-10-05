import { fit } from './ansi.ts'
import { colorless } from './osc.ts'
import { BEAT } from './tui/screen.ts'
import { close, open, SPINNER } from './tui/style.ts'

const DELAY = 300

export interface Pending {
  set(text: string): void
  say(line: string): void
  done(): void
}

export function megabytes(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`
}

export function progress(got: number, size: number): string {
  if (!size) {
    return megabytes(got)
  }
  return size >= 1e6
    ? `${(got / 1e6).toFixed(1)}/${(size / 1e6).toFixed(1)} MB`
    : `${Math.round(got / 1e3)}/${Math.round(size / 1e3)} KB`
}

export interface Sink {
  say(line: string): void
  set(text: string): void
}

let sink: Sink | undefined

export async function into<T>(to: Sink, work: () => Promise<T>): Promise<T> {
  sink = to
  try {
    return await work()
  } finally {
    sink = undefined
  }
}

export function say(line: string): void {
  if (sink) {
    sink.say(line)
  } else {
    console.log(line)
  }
}

export function pending(text = ''): Pending {
  if (sink) {
    const to = sink
    to.set(text)
    return { set: (next) => to.set(next), say: (line) => to.say(line), done: () => to.set('') }
  }
  const out = process.stdout
  if (!out.isTTY || process.env.TERM === 'dumb') {
    return { set() {}, say: (line) => console.log(line), done() {} }
  }
  const [dim, undim] = colorless() ? ['', ''] : [open('dim'), close('dim')]
  let beat = 0
  let shown = false
  let ticker: NodeJS.Timeout | undefined
  const draw = (): void => {
    out.write(
      `\r\x1b[2K${dim}${fit(`${SPINNER[beat % SPINNER.length]} ${text}`, (out.columns || 80) - 1, false)}${undim}`,
    )
  }
  const start = setTimeout(() => {
    shown = true
    draw()
    ticker = setInterval(() => {
      beat++
      draw()
    }, BEAT)
    ticker.unref()
  }, DELAY)
  start.unref()
  return {
    set(next) {
      text = next
      if (shown) {
        draw()
      }
    },
    say(line) {
      if (shown) {
        out.write('\r\x1b[2K')
      }
      console.log(line)
      if (shown) {
        draw()
      }
    },
    done() {
      clearTimeout(start)
      clearInterval(ticker)
      if (shown) {
        out.write('\r\x1b[2K')
        shown = false
      }
    },
  }
}
