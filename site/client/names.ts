import { NAME_PAUSE, NAMES_PATH, type NamesAnswer, namesPath } from '@/lib/names'

const STALL_MS = 300

type Naming =
  | { state: 'idle' }
  | { state: 'waiting'; query: string; timer: number }
  | { state: 'asking'; query: string; stop: AbortController; timer: number }
  | { state: 'stalled'; query: string; stop: AbortController }
  | { state: 'failed'; query: string }

export class NameLookup {
  readonly answers = new Map<string, NamesAnswer>()
  #naming: Naming = { state: 'idle' }
  #primed = false
  readonly #changed: (asked: string) => void

  constructor(changed: (asked: string) => void) {
    this.#changed = changed
  }

  get naming(): string {
    const now = this.#naming

    return now.state === 'idle' || now.state === 'failed' ? '' : now.query
  }

  get stalled(): boolean {
    return this.#naming.state === 'stalled'
  }

  get failed(): string {
    return this.#naming.state === 'failed' ? this.#naming.query : ''
  }

  warm() {
    if (this.#primed) return
    this.#primed = true
    fetch(NAMES_PATH, { priority: 'low' }).catch(() => undefined)
  }

  named(query: string): string[] {
    return this.answers.get(query.trim())?.works ?? []
  }

  later(query: string) {
    const asked = query.trim()

    if (this.#asking(asked)) return

    if (!asked || this.answers.has(asked)) return this.#turn({ state: 'idle' })
    this.#turn({ state: 'waiting', query: asked, timer: window.setTimeout(() => this.ask(asked), NAME_PAUSE) })
  }

  ask(query: string) {
    const asked = query.trim()

    if (!asked || this.answers.has(asked) || this.#asking(asked)) return
    this.#primed = true
    const stop = new AbortController()

    const timer = window.setTimeout(() => {
      if (!this.#mine(stop)) return
      this.#turn({ state: 'stalled', query: asked, stop }, false)
      this.#changed(asked)
    }, STALL_MS)

    this.#turn({ state: 'asking', query: asked, stop, timer })
    fetch(namesPath(asked), { signal: stop.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))

        return response.json() as Promise<NamesAnswer>
      })
      .then(
        (answer) => {
          this.answers.set(asked, answer)
          this.#answered(stop, asked, { state: 'idle' })
        },
        () => this.#answered(stop, asked, { state: 'failed', query: asked }),
      )
  }

  stop() {
    this.#turn({ state: 'idle' })
  }

  #asking(asked: string): boolean {
    const now = this.#naming

    return (now.state === 'asking' || now.state === 'stalled') && now.query === asked
  }

  #mine(stop: AbortController): boolean {
    const now = this.#naming

    return (now.state === 'asking' || now.state === 'stalled') && now.stop === stop
  }

  #turn(next: Naming, abort = true) {
    const was = this.#naming

    if (was.state === 'waiting' || was.state === 'asking') window.clearTimeout(was.timer)

    if (abort && (was.state === 'asking' || was.state === 'stalled')) was.stop.abort()
    this.#naming = next
  }

  #answered(stop: AbortController, asked: string, next: Naming) {
    if (!this.#mine(stop)) return
    this.#turn(next, false)
    this.#changed(asked)
  }
}
