import { THUMB_SIZES, WorkThumb } from '@/components/work-parts'
import { alsoIn, type CategorySlug, categoriesFrom, GENRE_KEY, GENRES, genresFrom, placesLabel } from '@/lib/categories'
import type { FoundWork } from '@/lib/found'
import { type Filters, matches, ORDERS, type Ranked, type Searchable, type Sort, START } from '@/lib/gallery'
import { makePath, type NamesAnswer } from '@/lib/names'
import { html } from '@/lib/render'
import { said } from '@/lib/search'
import { plural } from '@/lib/utils'
import { WORN_FACETS, workPath } from '@/lib/works'
import { paletteNameOf } from '../../src/core/names.ts'
import { announce, fill, readJson, reducedMotion } from './dom'
import { NameLookup } from './names'
import { afterPaint } from './palettes'
import { tileScrub } from './tile-scrub'
import type { PressedChange } from './ui/change'
import { press } from './ui/pressed'

const EDGE = 2

interface Market {
  id: string
  text: string
}

function palettesOf(card: HTMLElement): Searchable[] {
  const works = card.dataset.work ? [card.dataset.work] : []

  return (card.dataset.search ?? '').split('\n').map((text) => ({ text, works }))
}

function rankOf(card: HTMLElement): Ranked {
  return { id: card.dataset.shelf ?? '', stars: Number(card.dataset.stars), pushedAt: card.dataset.pushed ?? '' }
}

abstract class Browse extends HTMLElement {
  protected filters: Filters = { ...START }
  protected names = new NameLookup((asked) => this.#answered(asked))
  #request = ''
  #unscrub = () => {}

  #change = (event: Event) => {
    const { name, value } = event.target as HTMLInputElement

    if (name === 'sort') this.order(value)
  }

  connectedCallback() {
    this.addEventListener('change', this.#change)
    this.#unscrub = tileScrub(this)
    const query = (new URLSearchParams(location.search).get('q') ?? '').trim()
    const order = this.querySelector<HTMLInputElement>('input[name="sort"]')

    if (order) order.checked = true
    this.filters = { ...START, query }
    this.#request = this.querySelector('[data-request]')?.getAttribute('href') ?? ''

    if (query) this.names.ask(query)
    this.#carry()
    this.#chip()
    this.render()
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.#change)
    this.#unscrub()
    this.names.stop()
  }

  protected abstract render(): void

  protected abstract order(sort: string): void

  protected abstract summary(): string

  protected get query(): string {
    return this.filters.query.trim()
  }

  protected get naming(): string {
    return this.names.naming
  }

  protected get stalled(): boolean {
    return this.names.stalled
  }

  protected get answers(): Map<string, NamesAnswer> {
    return this.names.answers
  }

  protected hint(text: string | null) {
    const hint = this.querySelector<HTMLElement>('[data-hint]')

    if (!hint) return
    hint.hidden = text === null
    const label = hint.querySelector('[data-hint-text]')

    if (label && text !== null) label.textContent = text
  }

  protected empty(shown: boolean, within = '') {
    const empty = this.querySelector('[data-empty]')

    if (shown) {
      empty?.toggleAttribute('hidden', true)

      return
    }

    const query = this.query
    const naming = query !== '' && this.naming === query
    const waiting = naming && !this.stalled

    empty?.toggleAttribute('hidden', waiting)

    if (waiting) return
    const answer = this.answers.get(query)
    const title = this.querySelector('[data-empty-title]')
    const text = this.querySelector<HTMLElement>('[data-empty-text]')
    const face = this.querySelector<HTMLElement>('[data-empty-face]')
    const ask = this.querySelector<HTMLElement>('[data-empty-ask]')
    const every = this.querySelector<HTMLElement>('[data-empty-every]')

    if (title)
      title.textContent = naming
        ? `looking up “${query}”…`
        : within
          ? `no ${within} work matches “${query}”`
          : query
            ? answer?.found.length
              ? `no palettes for “${answer.label}” yet`
              : `no work called “${answer?.label ?? query}” yet`
            : 'no palettes yet'

    if (every) every.hidden = naming

    if (text) {
      text.hidden = naming || within !== ''
      text.textContent =
        query && this.names.failed === query
          ? 'the name lookup did not answer — ask for one, or make it yourself.'
          : 'look for its work by title, ask for one, or make it yourself.'
    }

    if (face) face.hidden = naming

    if (ask) ask.hidden = naming || within !== ''
    this.querySelector('[data-request]')?.setAttribute('href', answer?.request ?? this.#requestOf(query))
    this.querySelector('[data-make]')?.setAttribute(
      'href',
      makePath(answer?.name ?? (query ? (paletteNameOf(query) ?? null) : null)),
    )
  }

  #requestOf(query: string): string {
    if (!query || !this.#request) return this.#request
    const url = new URL(this.#request)
    url.searchParams.set('character', query)

    return url.href
  }

  #carry() {
    const query = this.query

    for (const link of this.querySelectorAll<HTMLAnchorElement>('[data-lens], [data-hint-link], [data-keep-query]')) {
      const target = new URL(link.href)

      if (query) target.searchParams.set('q', query)
      else target.searchParams.delete('q')
      link.href = `${target.pathname}${target.search}`
    }
  }

  #chip() {
    const chip = this.querySelector<HTMLElement>('[data-clear]')

    if (!chip) return
    chip.hidden = this.query === ''
    const text = chip.querySelector('[data-clear-text]')

    if (text) text.textContent = `“${this.query}”`
  }

  #answered(asked: string) {
    if (asked !== this.query) return
    this.filters = { ...this.filters, named: this.names.named(asked) }
    this.render()

    if (this.naming !== asked) announce(this.summary())
  }
}

class BrowseWorks extends Browse {
  #markets: Market[] = []
  #genres = new Set<string>()
  #shown = 0

  #pressed = (event: CustomEvent<PressedChange>) => {
    const genre = (event.detail.trigger as HTMLElement).dataset.value ?? ''

    if (event.detail.pressed) this.#genres.add(genre)
    else this.#genres.delete(genre)
    this.#rememberGenres()
    this.render()
    announce(this.summary())
  }

  connectedCallback() {
    this.#markets = readJson<Market[]>(this, 'script[data-markets]')
    const asked = new URLSearchParams(location.search).getAll(GENRE_KEY)

    for (const toggle of this.#genreToggles()) {
      const genre = toggle.dataset.value ?? ''
      const on = asked.includes(genre)

      press(toggle, on)

      if (on) this.#genres.add(genre)
    }

    this.addEventListener('pressedchange', this.#pressed)
    super.connectedCallback()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('pressedchange', this.#pressed)
  }

  #items(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[data-tiles] > [data-work]')]
  }

  #genreToggles(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[data-genre-filter] [data-slot="toggle"]')]
  }

  #rememberGenres() {
    const url = new URL(location.href)

    url.searchParams.delete(GENRE_KEY)

    for (const { slug } of GENRES) if (this.#genres.has(slug)) url.searchParams.append(GENRE_KEY, slug)

    if (url.href !== location.href) history.replaceState(history.state, '', url)
  }

  #genresOf(item: HTMLElement): string[] {
    return (item.dataset.genres ?? '').split(' ')
  }

  #wanted(item: HTMLElement): boolean {
    return this.#genres.size === 0 || this.#genresOf(item).some((genre) => this.#genres.has(genre))
  }

  #place(found: readonly FoundWork[]) {
    const list = this.querySelector<HTMLElement>('[data-found-tiles]')

    if (!list) return
    list.hidden = found.length === 0

    const tiles = found.map((work) => {
      const known = list.querySelector<HTMLElement>(`:scope > [data-work="${CSS.escape(work.id)}"]`)

      if (known) return known
      const tile = document.createElement('li')
      tile.className = 'grid'
      tile.dataset.work = work.id
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
            also: this.dataset.slug ? alsoIn(work.places, this.dataset.slug as CategorySlug) : placesLabel(work.places),
          }),
        ),
      )

      return tile
    })

    if (list.children.length !== tiles.length || tiles.some((tile, at) => list.children[at] !== tile))
      list.replaceChildren(...tiles)
  }

  #fits(work: FoundWork): boolean {
    const within = this.dataset.slug

    if (within === undefined) return true
    const held = genresFrom(work.places)

    return (
      categoriesFrom(work.places).some((category) => category === within) &&
      (this.#genres.size === 0 || held.some((genre) => this.#genres.has(genre)))
    )
  }

  #said(item: HTMLElement): boolean {
    const query = this.query.toLowerCase()

    return !query || said(item.dataset.search ?? '', (item.dataset.names ?? '').split('\n'), query)
  }

  #hit(item: HTMLElement): boolean {
    return this.#said(item) || this.filters.named.includes(item.dataset.work ?? '')
  }

  protected render() {
    const items = this.#items()
    const query = this.query
    const answer = this.answers.get(query)
    const within = this.dataset.category ?? ''
    const works = new Set<string>()
    const counts = new Map<string, number>()

    for (const item of items) {
      const hit = this.#hit(item)
      const on = hit && this.#wanted(item)

      item.hidden = !on

      if (on) works.add(item.dataset.work ?? '')

      if (hit) for (const genre of this.#genresOf(item)) counts.set(genre, (counts.get(genre) ?? 0) + 1)
    }

    for (const toggle of this.#genreToggles()) {
      const count = toggle.querySelector('[data-genre-count]')

      if (count) count.textContent = String(counts.get(toggle.dataset.value ?? '') ?? 0)
    }

    for (const group of this.querySelectorAll<HTMLElement>('[data-group]')) {
      const visible = [...group.querySelectorAll<HTMLElement>('[data-tiles] > [data-work]')].filter(
        (item) => !item.hidden,
      ).length

      group.hidden = visible === 0
      const count = group.querySelector('[data-group-count]')

      if (count) count.textContent = String(visible)
    }

    const shown = works.size

    this.#shown = shown
    const summary = this.querySelector<HTMLElement>('[data-summary]')

    if (summary) {
      const count = summary.querySelector('[data-summary-count]')
      const text = summary.querySelector('[data-summary-text]')

      summary.hidden = query === '' || shown === 0

      if (count) count.textContent = String(shown)

      if (text) text.textContent = `${shown === 1 ? 'work' : 'works'} for “${query}”`
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

    const found = shown === 0 ? (answer?.found ?? []).filter((work) => this.#fits(work)) : []

    this.#place(found)
    this.empty(shown > 0, found.length > 0 ? '' : within)
  }

  protected order(sort: string) {
    const at = (item: HTMLElement) => Number(item.dataset.order)

    for (const list of this.querySelectorAll('[data-tiles]')) {
      const items = [...list.querySelectorAll<HTMLElement>(':scope > [data-work]')]

      list.append(
        ...(sort === 'palettes'
          ? items.toSorted((a, b) => Number(b.dataset.palettes) - Number(a.dataset.palettes) || at(a) - at(b))
          : items.toSorted((a, b) => at(a) - at(b))),
      )
    }
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
    const rails = [...this.querySelectorAll<HTMLElement>('[data-rail]')].map(
      (rail) => [rail, this.#ends(rail)] as const,
    )

    for (const [rail, ends] of rails) this.#mark(rail, ends)
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
    this.#mark(rail, this.#ends(rail))
  }

  #ends(rail: HTMLElement): [boolean, boolean] {
    return [rail.scrollLeft <= EDGE, rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - EDGE]
  }

  #mark(rail: HTMLElement, [start, end]: readonly [boolean, boolean]) {
    rail.toggleAttribute('data-at-end', end)

    for (const button of rail.closest('[data-shelf]')?.querySelectorAll<HTMLButtonElement>('[data-scroll]') ?? [])
      button.disabled = button.dataset.scroll === '-1' ? start : end
  }

  protected render() {
    const shelves = [...this.querySelectorAll<HTMLElement>('[data-shelves] > [data-shelf]')]
    const covers = [...this.querySelectorAll<HTMLElement>('[data-covers] > [data-shelf]')]
    const cards = shelves.map((shelf) => [...shelf.querySelectorAll<HTMLElement>('[data-stack]')])
    const members = cards.map((group) => group.map(palettesOf))
    const filtering = this.query !== ''
    const works = new Set<string>()
    let shown = 0

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
    this.empty(shown > 0)
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
