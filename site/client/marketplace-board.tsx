import { type FoundWork, WorkResults } from '@/components/work-results'
import {
  FIRST_SORT,
  type Filters,
  matches,
  ORDERS,
  type Peek,
  type Ranked,
  type Searchable,
  SOURCES,
  type Sort,
  type Source,
  START,
  shelvesMatching,
  WORKS_PATH,
} from '@/lib/gallery'
import { makePath, type NamesAnswer, namesPath, plainAnswer } from '@/lib/names'
import { html } from '@/lib/render'
import { isBuiltin } from '@/lib/themes'
import type { RowPalette, WorkRow } from '@/lib/works'
import { NAME_PAUSE, requestUrl } from '../../src/core/names.ts'
import { fill, readJson, reducedMotion, tally } from './dom'
import { composing, letter, typing } from './keys'
import type { OpenChange } from './ui/change'

const TURN_MS = 2000

function palettesOf(card: HTMLElement): Searchable[] {
  const builtin = card.hasAttribute('data-builtin')
  const works = card.dataset.work ? [card.dataset.work] : []

  return (card.dataset.search ?? '').split('\n').map((text) => ({ text, builtin, works }))
}

function merged(palettes: Searchable[]): Searchable[] {
  const byText = new Map<string, Searchable>()

  for (const palette of palettes) {
    const seen = byText.get(palette.text)

    byText.set(palette.text, seen ? { ...seen, works: [...seen.works, ...palette.works] } : palette)
  }

  return [...byText.values()]
}

function inSource(palette: RowPalette, source: Source): boolean {
  return source === 'all' || (source === 'builtin') === isBuiltin(palette)
}

function shelfOf(element: Element): string {
  return element.closest<HTMLElement>('[data-shelf]')?.dataset.shelf ?? ''
}

function rankOf(card: HTMLElement): Ranked {
  return { id: card.dataset.shelf ?? '', stars: Number(card.dataset.stars), pushedAt: card.dataset.pushed ?? '' }
}

class MarketplaceBoard extends HTMLElement {
  #filters: Filters = { ...START }
  #open = new Set<string>()
  #peeks: Record<string, Peek[]> = {}
  #at = new Map<string, number>()
  #held = new Set<string>()
  #seen = new Set<HTMLElement>()
  #turn = 0
  #timer = 0
  #observer: IntersectionObserver | null = null
  #rows: WorkRow[] | null = null
  #loading = false
  #answers = new Map<string, NamesAnswer>()
  #asking: AbortController | null = null
  #asked = ''
  #naming = ''
  #failed = ''
  #pause = 0
  #shown = ''

  #input = (event: Event) => {
    const target = event.target as HTMLInputElement

    if (target.name !== 'query') return
    this.#filters = { ...this.#filters, query: target.value, named: this.#namedFor(target.value) }
    this.#later()
    tally(this.#render())
  }

  #enter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || (event.target as HTMLInputElement).name !== 'query' || composing(event)) return
    event.preventDefault()
    this.#ask(this.#filters.query.trim())
  }

  #focus = (event: FocusEvent) => {
    if ((event.target as HTMLInputElement).name === 'query') this.#loadRows()
  }

  #change = (event: Event) => {
    const { name, value } = event.target as HTMLInputElement

    if (name === 'sort') this.#sort(value as Sort)

    if (name !== 'source') return
    this.#filters = { ...this.#filters, source: value as Source }
    tally(this.#render())
  }

  #toggle = (event: CustomEvent<OpenChange>) => {
    const details = event.target

    if (!(details instanceof HTMLDetailsElement) || event.detail.reason !== 'trigger-press' || this.#filtering()) return
    const key = shelfOf(details)

    if (event.detail.open) this.#open.add(key)
    else this.#open.delete(key)
  }

  #click = (event: MouseEvent) => {
    const step = (event.target as Element).closest<HTMLElement>('[data-peek-step]')
    const peek = step?.closest<HTMLElement>('[data-peek]')

    if (!step || !peek) return
    this.#held.add(peek.dataset.peek ?? '')
    this.#move(peek, Number(step.dataset.peekStep))
  }

  #find = (event: KeyboardEvent) => {
    if (!letter(event, 'k') || event.metaKey === event.ctrlKey || event.altKey || event.shiftKey) return

    if (event.defaultPrevented || composing(event) || typing(event.target)) return
    const field = this.querySelector<HTMLInputElement>('input[name="query"]')

    if (!field) return
    event.preventDefault()
    field.focus()
    field.select()
  }

  #tick = () => {
    if (document.hidden) return

    const waiting = [...this.#seen].filter(
      (peek) => !this.#held.has(peek.dataset.peek ?? '') && !peek.closest<HTMLElement>('[data-shelf]')?.hidden,
    )

    const peek = waiting[this.#turn % Math.max(waiting.length, 1)]
    this.#turn += 1

    if (peek) this.#move(peek, 1)
  }

  connectedCallback() {
    this.addEventListener('input', this.#input)
    this.addEventListener('change', this.#change)
    this.addEventListener('openchange', this.#toggle)
    this.addEventListener('click', this.#click)
    this.addEventListener('keydown', this.#enter)
    this.addEventListener('focusin', this.#focus)
    window.addEventListener('keydown', this.#find)

    for (const details of this.querySelectorAll<HTMLDetailsElement>('[data-shelf] details[open]'))
      this.#open.add(shelfOf(details))
    const field = this.querySelector<HTMLInputElement>('input[name="query"]')
    const asked = new URLSearchParams(location.search).get('q')

    if (field && asked) field.value = asked
    const query = field?.value ?? ''
    const start = this.querySelector<HTMLInputElement>(`input[name="source"][value="${START.source}"]`)
    const order = this.querySelector<HTMLInputElement>(`input[name="sort"][value="${FIRST_SORT}"]`)

    if (start) start.checked = true

    if (order) order.checked = true
    this.#filters = { ...START, query }

    if (query.trim()) {
      this.#loadRows()
      this.#ask(query.trim())
    }

    this.#render()
    this.#peeks = readJson<Record<string, Peek[]>>(this, 'script[data-peeks]')

    if (reducedMotion()) return
    this.#observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const peek = entry.target as HTMLElement

        if (entry.isIntersecting) this.#seen.add(peek)
        else this.#seen.delete(peek)
      }
    })

    for (const peek of this.querySelectorAll<HTMLElement>('[data-peek]')) this.#observer.observe(peek)
    this.#timer = window.setInterval(this.#tick, TURN_MS)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('keydown', this.#enter)
    this.removeEventListener('focusin', this.#focus)
    window.removeEventListener('keydown', this.#find)
    window.clearInterval(this.#timer)
    window.clearTimeout(this.#pause)
    this.#asking?.abort()
    this.#observer?.disconnect()
  }

  #filtering(): boolean {
    return this.#filters.query.trim() !== ''
  }

  #namedFor(value: string): string[] {
    return this.#answers.get(value.trim())?.works.map((work) => work.id) ?? []
  }

  #loadRows() {
    if (this.#rows || this.#loading) return
    this.#loading = true
    fetch(WORKS_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))

        return response.json() as Promise<WorkRow[]>
      })
      .then(
        (rows) => {
          this.#rows = rows

          if (this.#filtering()) tally(this.#render())
        },
        () => {
          this.#loading = false
        },
      )
  }

  #later() {
    window.clearTimeout(this.#pause)
    const query = this.#filters.query.trim()

    if (this.#asked && this.#asked !== query) this.#asking?.abort()
    this.#naming = query && !this.#answers.has(query) ? query : ''

    if (!this.#naming || this.#asked === query) return
    this.#loadRows()
    this.#pause = window.setTimeout(() => this.#ask(query), NAME_PAUSE)
  }

  #ask(query: string) {
    window.clearTimeout(this.#pause)

    if (!query || this.#answers.has(query) || this.#asked === query) return
    this.#asking?.abort()
    const asking = new AbortController()
    this.#asking = asking
    this.#asked = query
    this.#naming = query
    fetch(namesPath(query), { signal: asking.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))

        return response.json() as Promise<NamesAnswer>
      })
      .then(
        (answer) => {
          this.#answers.set(query, answer)
          this.#answered(asking, query, '')
        },
        () => this.#answered(asking, query, asking.signal.aborted ? '' : query),
      )
  }

  #answered(asking: AbortController, query: string, failed: string) {
    if (this.#asking === asking) {
      this.#asking = null
      this.#asked = ''
    }

    if (asking.signal.aborted || this.#filters.query.trim() !== query) return
    this.#naming = ''
    this.#failed = failed
    this.#filters = { ...this.#filters, named: this.#namedFor(query) }
    tally(this.#render())
  }

  #found(source: Source): FoundWork[] {
    const query = this.#filters.query.trim()

    if (!query || !this.#rows) return []
    const text = query.toLowerCase()
    const answer = this.#answers.get(query)
    const reads = new Map((answer?.works ?? []).map((work) => [work.id, work.read]))
    const byId = new Map(this.#rows.map((row) => [row.id, row]))
    const named = (answer?.works ?? []).flatMap((work) => byId.get(work.id) ?? [])
    const local = this.#rows.filter((row) => row.palettes.some((palette) => palette.search.includes(text)))

    return [...new Set([...named, ...local])].flatMap((row) => {
      const palettes = row.palettes.filter((palette) => inSource(palette, source))

      return palettes.length > 0 ? [{ row: { ...row, palettes }, read: reads.get(row.id) ?? null }] : []
    })
  }

  #works(found: FoundWork[]) {
    const section = this.querySelector<HTMLElement>('[data-works]')

    if (!section) return
    const markup = found.length > 0 ? html(<WorkResults found={found} query={this.#filters.query.trim()} />) : ''

    section.hidden = found.length === 0

    if (markup === this.#shown) return
    this.#shown = markup
    fill(section, markup)
  }

  #empty(elsewhere: boolean) {
    const query = this.#filters.query.trim()
    const answer = this.#answers.get(query) ?? plainAnswer(query)
    const state = !query || elsewhere ? 'filters' : this.#naming === query ? 'naming' : 'none'
    const title = this.querySelector('[data-empty-title]')
    const text = this.querySelector<HTMLElement>('[data-empty-text]')
    const face = this.querySelector<HTMLElement>('[data-empty-face]')
    const ask = this.querySelector<HTMLElement>('[data-empty-ask]')

    if (title)
      title.textContent =
        state === 'naming'
          ? `looking up “${query}”…`
          : state === 'none'
            ? `no palettes of “${answer.label}” yet`
            : `no palette matches${query ? ` “${query}”` : ' these filters'}`

    if (text) {
      text.hidden = state === 'naming'
      text.textContent =
        state === 'filters'
          ? 'clear a filter, or search for a work instead.'
          : this.#failed === query
            ? 'the name lookup did not answer — ask for one, or make it yourself.'
            : 'ask for one, or make it yourself.'
    }

    if (face) face.hidden = state === 'naming'

    if (ask) ask.hidden = state !== 'none'
    this.querySelector('[data-request]')?.setAttribute('href', requestUrl(answer.asked))
    this.querySelector('[data-make]')?.setAttribute('href', makePath(answer.name))
  }

  #sort(sort: Sort) {
    const list = this.querySelector('[data-shelves]')

    if (!list) return
    const cards = [...list.querySelectorAll<HTMLElement>(':scope > [data-shelf]')]

    list.append(...cards.toSorted((a, b) => ORDERS[sort](rankOf(a), rankOf(b))))
  }

  #move(peek: HTMLElement, delta: number) {
    const key = peek.dataset.peek ?? ''
    const list = this.#peeks[key] ?? []

    if (list.length < 2) return
    const at = ((((this.#at.get(key) ?? 0) + delta) % list.length) + list.length) % list.length
    const next = list[at]

    if (!next) return
    this.#at.set(key, at)
    peek.setAttribute('style', next.style)
    const title = peek.querySelector('[data-window-title]')

    if (title) title.textContent = next.title
    const use = peek.querySelector('[data-live="use"]')

    if (use) use.textContent = next.use
  }

  #render(): number {
    const shelves = [...this.querySelectorAll<HTMLElement>('[data-shelf]')]
    const cards = shelves.map((shelf) => [...shelf.querySelectorAll<HTMLElement>('[data-stack]')])
    const members = cards.map((group) => group.map(palettesOf))
    const found = members.map((group) => merged(group.flat()))

    for (const source of SOURCES) {
      const label = this.querySelector(`[data-count="${source}"]`)

      if (label) label.textContent = String(shelvesMatching(found, { ...this.#filters, source }))
    }

    const filtering = this.#filtering()
    let shown = 0

    for (const [index, shelf] of shelves.entries()) {
      const hit = (palettes: Searchable[]) => palettes.filter((palette) => matches(palette, this.#filters))

      for (const [at, card] of (cards[index] ?? []).entries())
        card.hidden = hit(members[index]?.[at] ?? []).length === 0
      const visible = hit(found[index] ?? []).length
      const total = found[index]?.length ?? 0
      const count = shelf.querySelector('[data-shelf-count]')

      if (count) count.textContent = filtering ? `${visible} of ${total}` : String(total)
      shelf.hidden = visible === 0
      const details = shelf.querySelector('details')

      if (details) details.open = filtering ? visible > 0 : this.#open.has(shelf.dataset.shelf ?? '')
      shown += visible
    }

    const rows = this.#found(this.#filters.source)
    this.#works(rows)
    const nothing = shown === 0 && rows.length === 0
    this.querySelector('[data-empty]')?.toggleAttribute('hidden', !nothing)

    if (nothing) {
      const all = { ...this.#filters, source: 'all' as const }

      this.#empty(this.#filters.source !== 'all' && (shelvesMatching(found, all) > 0 || this.#found('all').length > 0))
    }

    return shown
  }
}

customElements.define('marketplace-board', MarketplaceBoard)
