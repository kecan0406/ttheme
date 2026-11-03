import { NAME_PAUSE, NAMES_PATH, type NamesAnswer, namesPath } from '@/lib/names'

const STALL_MS = 300

export class NameLookup {
  readonly answers = new Map<string, NamesAnswer>()
  naming = ''
  stalled = false
  failed = ''
  #asking: AbortController | null = null
  #asked = ''
  #pause = 0
  #stall = 0
  #primed = false
  readonly #changed: (asked: string) => void

  constructor(changed: (asked: string) => void) {
    this.#changed = changed
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

    window.clearTimeout(this.#pause)

    if (this.#asked && this.#asked !== asked) {
      this.#asking?.abort()
      window.clearTimeout(this.#stall)
      this.stalled = false
    }

    this.naming = asked && !this.answers.has(asked) ? asked : ''

    if (!this.naming) return
    this.#pause = window.setTimeout(() => {
      if (this.naming === asked && this.#asked !== asked) this.ask(asked)
    }, NAME_PAUSE)
  }

  ask(query: string) {
    const asked = query.trim()

    window.clearTimeout(this.#pause)

    if (!asked || this.answers.has(asked) || this.#asked === asked) return
    this.#primed = true
    this.#asking?.abort()
    const asking = new AbortController()
    this.#asking = asking
    this.#asked = asked
    this.naming = asked
    window.clearTimeout(this.#stall)
    this.stalled = false
    this.#stall = window.setTimeout(() => {
      this.stalled = true
      this.#changed(asked)
    }, STALL_MS)
    fetch(namesPath(asked), { signal: asking.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))

        return response.json() as Promise<NamesAnswer>
      })
      .then(
        (answer) => {
          this.answers.set(asked, answer)
          this.#answered(asking, asked, '')
        },
        () => this.#answered(asking, asked, asking.signal.aborted ? '' : asked),
      )
  }

  stop() {
    window.clearTimeout(this.#pause)
    window.clearTimeout(this.#stall)
    this.#asking?.abort()
  }

  #answered(asking: AbortController, asked: string, failed: string) {
    if (this.#asking === asking) {
      this.#asking = null
      this.#asked = ''
      window.clearTimeout(this.#stall)
      this.stalled = false
    }

    if (asking.signal.aborted) return

    if (this.naming === asked) this.naming = ''
    this.failed = failed
    this.#changed(asked)
  }
}
