import { THUMB_SIZES, WorkThumb } from '@/components/work-parts'
import type { FoundWork } from '@/lib/found'
import {
  type Filters,
  matches,
  ORDERS,
  type Ranked,
  type Searchable,
  SOURCES,
  type Sort,
  type Source,
  START,
  shelvesMatching,
} from '@/lib/gallery'
import { makePath, NAME_PAUSE, NAMES_PATH, type NamesAnswer, namesPath } from '@/lib/names'
import { html } from '@/lib/render'
import { plural } from '@/lib/utils'
import { WORN_FACETS, workPath } from '@/lib/works'
import { announce, fill, readJson, reducedMotion } from './dom'
import { composing, letter, typing } from './keys'
import { afterPaint } from './palettes'

const STALL_MS = 300

const SAY_MS = 500

const EDGE = 2

interface Market {
  id: string
  text: string
}

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

function rankOf(card: HTMLElement): Ranked {
  return { id: card.dataset.shelf ?? '', stars: Number(card.dataset.stars), pushedAt: card.dataset.pushed ?? '' }
}

abstract class Browse extends HTMLElement {
  protected filters: Filters = { ...START }
  protected answers = new Map<string, NamesAnswer>()
  protected naming = ''
  protected stalled = false
  #asking: AbortController | null = null
  #asked = ''
  #failed = ''
  #pause = 0
  #primed = false
  #request = ''
  #stall = 0
  #saying = 0

  #input = (event: Event) => {
    const target = event.target as HTMLInputElement

    if (target.name !== 'query') return
    this.filters = { ...this.filters, query: target.value, named: this.#namedFor(target.value) }
    this.#carry()
    this.#later()
    this.render()
    this.#say()
  }

  #enter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || (event.target as HTMLInputElement).name !== 'query' || composing(event)) return
    event.preventDefault()
    this.#ask(this.query)
  }

  #focus = (event: FocusEvent) => {
    if ((event.target as HTMLInputElement).name === 'query') this.#warm()
  }

  #warm = () => {
    if (this.#primed) return
    this.#primed = true
    fetch(NAMES_PATH, { priority: 'low' }).catch(() => undefined)
  }

  #change = (event: Event) => {
    const { name, value } = event.target as HTMLInputElement

    if (name === 'sort') this.order(value)

    if (name !== 'source') return
    this.filters = { ...this.filters, source: value as Source }
    this.render()
    this.#say()
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

  connectedCallback() {
    this.addEventListener('input', this.#input)
    this.addEventListener('change', this.#change)
    this.addEventListener('keydown', this.#enter)
    this.addEventListener('focusin', this.#focus)
    window.addEventListener('keydown', this.#find)
    const field = this.querySelector<HTMLInputElement>('input[name="query"]')
    const asked = new URLSearchParams(location.search).get('q')

    if (field && asked) field.value = asked
    const query = field?.value ?? ''
    const start = this.querySelector<HTMLInputElement>(`input[name="source"][value="${START.source}"]`)
    const order = this.querySelector<HTMLInputElement>('input[name="sort"]')

    if (start) start.checked = true

    if (order) order.checked = true
    this.filters = { ...START, query }
    this.#request = this.querySelector('[data-request]')?.getAttribute('href') ?? ''

    if (query.trim()) {
      this.#primed = true
      this.#ask(query.trim())
    } else afterPaint(this.#warm)

    this.#carry()
    this.render()
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#input)
    this.removeEventListener('change', this.#change)
    this.removeEventListener('keydown', this.#enter)
    this.removeEventListener('focusin', this.#focus)
    window.removeEventListener('keydown', this.#find)
    window.clearTimeout(this.#pause)
    window.clearTimeout(this.#stall)
    window.clearTimeout(this.#saying)
    this.#asking?.abort()
  }

  protected abstract render(): void

  protected abstract order(sort: string): void

  protected abstract summary(): string

  protected get query(): string {
    return this.filters.query.trim()
  }

  protected counts(values: Record<Source, number>) {
    for (const source of SOURCES) {
      const label = this.querySelector(`[data-count="${source}"]`)

      if (label) label.textContent = String(values[source])
    }
  }

  protected hint(text: string | null) {
    const hint = this.querySelector<HTMLElement>('[data-hint]')

    if (!hint) return
    hint.hidden = text === null
    const label = hint.querySelector('[data-hint-text]')

    if (label && text !== null) label.textContent = text
  }

  protected empty(shown: boolean, elsewhere: boolean) {
    const empty = this.querySelector('[data-empty]')

    if (shown) {
      empty?.toggleAttribute('hidden', true)

      return
    }

    const query = this.query
    const waiting = !elsewhere && query !== '' && this.naming === query && !this.stalled

    empty?.toggleAttribute('hidden', waiting)

    if (waiting) return
    const answer = this.answers.get(query)
    const state = !query || elsewhere ? 'filters' : this.naming === query ? 'naming' : 'none'
    const title = this.querySelector('[data-empty-title]')
    const text = this.querySelector<HTMLElement>('[data-empty-text]')
    const face = this.querySelector<HTMLElement>('[data-empty-face]')
    const ask = this.querySelector<HTMLElement>('[data-empty-ask]')

    if (title)
      title.textContent =
        state === 'naming'
          ? `looking up “${query}”…`
          : state === 'none'
            ? `no palettes of “${answer?.label ?? query}” yet`
            : `no palette matches${query ? ` “${query}”` : ' these filters'}`

    if (text) {
      text.hidden = state === 'naming'
      text.textContent =
        state === 'filters'
          ? 'clear a filter to see the rest.'
          : this.#failed === query
            ? 'the name lookup did not answer — ask for one, or make it yourself.'
            : 'ask for one, or make it yourself.'
    }

    if (face) face.hidden = state === 'naming'

    if (ask) ask.hidden = state !== 'none'
    this.querySelector('[data-request]')?.setAttribute('href', answer?.request ?? this.#request)
    this.querySelector('[data-make]')?.setAttribute('href', makePath(answer?.name ?? null))
  }

  #namedFor(value: string): string[] {
    return this.answers.get(value.trim())?.works.map((work) => work.id) ?? []
  }

  #carry() {
    const query = this.query

    for (const link of this.querySelectorAll<HTMLAnchorElement>('[data-lens], [data-hint-link]')) {
      const target = new URL(link.href)

      if (query) target.searchParams.set('q', query)
      else target.searchParams.delete('q')
      link.href = `${target.pathname}${target.search}`
    }
  }

  #remember() {
    const url = new URL(location.href)
    const query = this.query

    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')

    if (url.href !== location.href) history.replaceState(history.state, '', url)
  }

  #later() {
    window.clearTimeout(this.#pause)
    const query = this.query

    if (this.#asked && this.#asked !== query) {
      this.#asking?.abort()
      window.clearTimeout(this.#stall)
      this.stalled = false
    }

    this.naming = query && !this.answers.has(query) ? query : ''
    this.#pause = window.setTimeout(() => {
      this.#remember()

      if (this.naming === query && this.#asked !== query) this.#ask(query)
    }, NAME_PAUSE)
  }

  #ask(query: string) {
    window.clearTimeout(this.#pause)

    if (!query || this.answers.has(query) || this.#asked === query) return
    this.#asking?.abort()
    const asking = new AbortController()
    this.#asking = asking
    this.#asked = query
    this.naming = query
    window.clearTimeout(this.#stall)
    this.stalled = false
    this.#stall = window.setTimeout(() => {
      this.stalled = true
      this.render()
    }, STALL_MS)
    fetch(namesPath(query), { signal: asking.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))

        return response.json() as Promise<NamesAnswer>
      })
      .then(
        (answer) => {
          this.answers.set(query, answer)
          this.#answered(asking, query, '')
        },
        () => this.#answered(asking, query, asking.signal.aborted ? '' : query),
      )
  }

  #answered(asking: AbortController, query: string, failed: string) {
    if (this.#asking === asking) {
      this.#asking = null
      this.#asked = ''
      window.clearTimeout(this.#stall)
      this.stalled = false
    }

    if (asking.signal.aborted || this.query !== query) return
    this.naming = ''
    this.#failed = failed
    this.filters = { ...this.filters, named: this.#namedFor(query) }
    this.render()
    this.#say(true)
  }

  #say(now = false) {
    window.clearTimeout(this.#saying)
    const query = this.query

    if (query && this.naming === query) return
    const speak = () => announce(this.summary())

    if (now) speak()
    else this.#saying = window.setTimeout(speak, SAY_MS)
  }
}

class BrowseWorks extends Browse {
  #markets: Market[] = []
  #shown = 0

  connectedCallback() {
    this.#markets = readJson<Market[]>(this, 'script[data-markets]')
    super.connectedCallback()
  }

  #items(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[data-tiles] > [data-work]:not([data-found])')]
  }

  #place(found: readonly FoundWork[]) {
    const list = this.querySelector('[data-tiles]')

    if (!list) return
    const shown = new Set(found.map((work) => work.id))

    for (const tile of list.querySelectorAll<HTMLElement>(':scope > [data-found]'))
      tile.hidden = !shown.has(tile.dataset.work ?? '')

    const tiles = found.map((work) => {
      const known = list.querySelector<HTMLElement>(`:scope > [data-found][data-work="${CSS.escape(work.id)}"]`)

      if (known) return known
      const tile = document.createElement('li')
      tile.className = 'grid'
      tile.dataset.work = work.id
      tile.dataset.found = ''
      fill(
        tile,
        html(
          WorkThumb({
            href: workPath(work.id),
            name: work.name,
            native: work.native,
            lang: work.lang,
            count: 0,
            art: work.art,
            facets: WORN_FACETS,
            sizes: THUMB_SIZES,
          }),
        ),
      )

      return tile
    })

    const tail = [...list.children].slice(-tiles.length)

    if (tiles.some((tile, at) => tail[at] !== tile)) list.append(...tiles)

    for (const tile of tiles) tile.hidden = false
  }

  #said(item: HTMLElement): boolean {
    const query = this.query.toLowerCase()

    return !query || (item.dataset.search ?? '').includes(query)
  }

  #hit(item: HTMLElement, source: Source): boolean {
    if (source === 'builtin' && !item.hasAttribute('data-builtin')) return false

    if (source === 'community' && !item.hasAttribute('data-community')) return false

    return this.#said(item) || this.filters.named.includes(item.dataset.work ?? '')
  }

  protected render() {
    const items = this.#items()
    const source = this.filters.source
    const query = this.query

    this.counts({
      all: items.filter((item) => this.#hit(item, 'all')).length,
      builtin: items.filter((item) => this.#hit(item, 'builtin')).length,
      community: items.filter((item) => this.#hit(item, 'community')).length,
    })

    const answer = this.answers.get(query)
    const reads: string[] = []
    let shown = 0

    for (const item of items) {
      const on = this.#hit(item, source)

      item.hidden = !on

      if (!on) continue
      shown += 1
      const read = this.#said(item) ? undefined : answer?.works.find((work) => work.id === item.dataset.work)?.read

      if (read) reads.push(read)
    }

    this.#shown = shown
    const summary = this.querySelector<HTMLElement>('[data-summary]')

    if (summary) {
      const count = summary.querySelector('[data-summary-count]')
      const text = summary.querySelector('[data-summary-text]')

      summary.hidden = query === '' || shown === 0

      if (count) count.textContent = String(shown)

      if (text)
        text.textContent = `${shown === 1 ? 'work' : 'works'} for “${query}”${reads.length === 1 ? ` · ${reads[0]}` : ''}`
      summary.querySelector('[data-pending]')?.toggleAttribute('hidden', !(this.stalled && this.naming === query))
    }

    const lower = query.toLowerCase()
    const markets = lower.length > 1 ? this.#markets.filter((market) => market.text.includes(lower)) : []

    this.hint(
      markets.length === 0
        ? null
        : markets.length === 1
          ? `${markets[0]?.id ?? ''} is a marketplace`
          : `${plural(markets.length, 'marketplace')} match “${query}”`,
    )

    const elsewhere = items.some((item) => this.#hit(item, 'all'))

    this.#place(shown === 0 && !elsewhere ? (answer?.found ?? []) : [])
    this.empty(shown > 0, source !== 'all' && elsewhere)
  }

  protected order(sort: string) {
    const list = this.querySelector('[data-tiles]')

    if (!list) return
    const at = (item: HTMLElement) => Number(item.dataset.order)
    const items = this.#items()

    list.append(
      ...(sort === 'palettes'
        ? items.toSorted((a, b) => Number(b.dataset.palettes) - Number(a.dataset.palettes) || at(a) - at(b))
        : items.toSorted((a, b) => at(a) - at(b))),
      ...list.querySelectorAll(':scope > [data-found]'),
    )
  }

  protected summary(): string {
    return this.#shown > 0
      ? plural(this.#shown, 'work')
      : (this.querySelector('[data-empty-title]')?.textContent ?? 'no work matches')
  }
}

class BrowseMarketplaces extends Browse {
  #shown = 0

  #scroll = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-scroll]')
    const rail = button?.closest('[data-shelf]')?.querySelector<HTMLElement>('[data-rail]')

    if (!button || !rail) return
    rail.scrollBy({
      left: Number(button.dataset.scroll) * rail.clientWidth * 0.8,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }

  #moved = (event: Event) => {
    const rail = event.target

    if (rail instanceof HTMLElement && rail.hasAttribute('data-rail')) this.#edges(rail)
  }

  #measure = () => {
    for (const rail of this.querySelectorAll<HTMLElement>('[data-rail]')) this.#edges(rail)
  }

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener('click', this.#scroll)
    this.addEventListener('scroll', this.#moved, { capture: true, passive: true })
    window.addEventListener('resize', this.#measure, { passive: true })
    afterPaint(this.#measure)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('click', this.#scroll)
    this.removeEventListener('scroll', this.#moved, { capture: true })
    window.removeEventListener('resize', this.#measure)
  }

  #edges(rail: HTMLElement) {
    const start = rail.scrollLeft <= EDGE
    const end = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - EDGE

    rail.toggleAttribute('data-at-end', end)

    for (const button of rail.closest('[data-shelf]')?.querySelectorAll<HTMLButtonElement>('[data-scroll]') ?? [])
      button.disabled = button.dataset.scroll === '-1' ? start : end
  }

  protected render() {
    const shelves = [...this.querySelectorAll<HTMLElement>('[data-shelves] > [data-shelf]')]
    const covers = [...this.querySelectorAll<HTMLElement>('[data-covers] > [data-shelf]')]
    const cards = shelves.map((shelf) => [...shelf.querySelectorAll<HTMLElement>('[data-stack]')])
    const members = cards.map((group) => group.map(palettesOf))
    const found = members.map((group) => merged(group.flat()))
    const filtering = this.query !== ''
    const works = new Set<string>()
    let shown = 0

    this.counts({
      all: shelvesMatching(found, { ...this.filters, source: 'all' }),
      builtin: shelvesMatching(found, { ...this.filters, source: 'builtin' }),
      community: shelvesMatching(found, { ...this.filters, source: 'community' }),
    })

    for (const [index, shelf] of shelves.entries()) {
      const group = cards[index] ?? []
      let visible = 0

      for (const [at, card] of group.entries()) {
        const on = (members[index]?.[at] ?? []).some((palette) => matches(palette, this.filters))

        card.hidden = !on

        if (!on) continue
        visible += 1

        if (card.dataset.work) works.add(card.dataset.work)
      }

      const count = shelf.querySelector('[data-works-count]')

      if (count) count.textContent = filtering ? `${visible} of ${group.length}` : String(group.length)
      shelf.hidden = visible === 0
      const cover = covers.find((one) => one.dataset.shelf === shelf.dataset.shelf)

      if (cover) cover.hidden = visible === 0

      if (visible > 0) shown += 1
    }

    this.#shown = shown
    this.hint(
      filtering && works.size > 0 ? `${plural(works.size, 'work')} for “${this.query}” in these marketplaces` : null,
    )
    this.empty(
      shown > 0,
      this.filters.source !== 'all' && shelvesMatching(found, { ...this.filters, source: 'all' }) > 0,
    )
    this.#measure()
  }

  protected order(sort: string) {
    for (const list of this.querySelectorAll('[data-shelves], [data-covers]')) {
      const cards = [...list.querySelectorAll<HTMLElement>(':scope > [data-shelf]')]
      const rest = [...list.querySelectorAll<HTMLElement>(':scope > :not([data-shelf])')]

      list.append(...cards.toSorted((a, b) => ORDERS[sort as Sort](rankOf(a), rankOf(b))), ...rest)
    }
  }

  protected summary(): string {
    return this.#shown > 0
      ? plural(this.#shown, 'marketplace')
      : (this.querySelector('[data-empty-title]')?.textContent ?? 'no marketplace matches')
  }
}

customElements.define('browse-works', BrowseWorks)

customElements.define('browse-marketplaces', BrowseMarketplaces)
