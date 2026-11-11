import { SEARCH_POPUP, SearchFoot, SearchPreview, SearchRows, type SearchView } from '@/components/site-search'
import type { KeyArt } from '@/lib/art'
import { BROWSE_PATH } from '@/lib/gallery'
import { makePath } from '@/lib/names'
import { html } from '@/lib/render'
import { allWorks, type Hit, isWorn, marketsFor, type SearchIndex, SHOWN, searchWorks, type Worn } from '@/lib/search'
import { paletteNameOf, requestUrl } from '../../src/core/names.ts'
import { announce, fill, parsed, reducedMotion } from './dom'
import { composing, letter, typing } from './keys'
import { NameLookup } from './names'
import { heldIndex, indexFailed, searchIndex } from './search-index'
import type { ItemHighlighted, OpenChange } from './ui/change'
import { hide, show } from './ui/popover'
import { current, fallback, recall } from './wear'

const SAY_MS = 600

const CARD_MS = 260

const ART_MS = 520

const LEAVE_MS = 100

const DECODE_MS = 160

const SETTLE_MS = 60

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

const PREVIEWS = '(min-width: 720px)'

const warmed = new Set<string>()

function wornNow(): Worn {
  const name = current()
  const kept = recall() ?? fallback()

  return { name, work: kept?.name === name ? (kept.work?.id ?? null) : null }
}

function keyOf(hit: Hit | null, worn: Worn): string {
  return hit ? `${hit.work.id}:${hit.palette.name}:${isWorn(hit, worn)}` : ''
}

function previewing(): boolean {
  return matchMedia(PREVIEWS).matches
}

function decoded(card: Element | null | undefined): Promise<void> {
  const image = card?.querySelector('img')

  if (!image) return Promise.resolve()

  return Promise.race([
    image.decode().catch(() => {}),
    new Promise<void>((settle) => {
      window.setTimeout(settle, DECODE_MS)
    }),
  ])
}

function enter(card: HTMLElement, way: number) {
  const still = reducedMotion()
  const fade = card.animate({ opacity: [0, 1] }, { duration: still ? LEAVE_MS : CARD_MS, easing: 'ease-out' })

  fade.finished.then(
    () => {
      while (card.previousElementSibling) card.previousElementSibling.remove()
    },
    () => {},
  )

  if (still) return
  card.previousElementSibling
    ?.querySelector('[data-preview-words]')
    ?.animate({ opacity: [1, 0] }, { duration: LEAVE_MS, easing: 'ease-out', fill: 'forwards' })
  card
    .querySelector('[data-slot="work-art"] > :is(img, svg)')
    ?.animate({ scale: ['1.08', '1'], translate: [`0 ${way * 6}px`, '0 0'] }, { duration: ART_MS, easing: EASE })
  card
    .querySelector('[data-preview-words]')
    ?.animate(
      { opacity: [0, 1], translate: [`0 ${way * 6}px`, '0 0'] },
      { duration: CARD_MS, delay: 40, easing: EASE, fill: 'backwards' },
    )
}

function warm(art: KeyArt | null) {
  if (!art || warmed.has(art.src) || !previewing()) return
  warmed.add(art.src)
  const image = new Image()
  image.sizes = '320px'

  if (art.srcset) image.srcset = art.srcset
  image.src = art.src
}

function onBrowse(): boolean {
  return location.pathname === BROWSE_PATH || location.pathname.startsWith(`${BROWSE_PATH}/`)
}

function allPath(query: string): string {
  const path = onBrowse() ? location.pathname : BROWSE_PATH

  return `${path}?${new URLSearchParams({ q: query })}`
}

interface Card {
  key: string
  coming: HTMLElement | null
}

class SiteSearch extends HTMLElement {
  #input: HTMLInputElement | null = null
  #popup: HTMLElement | null = null
  #box: HTMLElement | null = null
  #hits: Hit[] = []
  #drawn = ''
  #card: Card = { key: '', coming: null }
  #saying = 0
  #settling = 0
  #loading: Promise<unknown> | null = null
  #wanted = false
  #names = new NameLookup((asked) => {
    if (asked === this.#query()) this.#render()
  })

  #typed = () => {
    const query = this.#query()

    this.#names.later(query)

    if (query || heldIndex()) {
      this.#render()
      this.#open()
    } else this.#close()
  }

  #focused = () => {
    this.#names.warm()
    this.#load()

    if (this.#query()) {
      this.#render()
      this.#open()
    }
  }

  #near = () => this.#load()

  #key = (event: KeyboardEvent) => {
    if (composing(event)) return

    if (event.key === 'ArrowDown' && !this.#isOpen()) {
      event.preventDefault()
      this.#begin()

      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      this.#wanted = false

      if (this.#isOpen()) this.#close()
      else if (this.#input?.value) this.#input.value = ''
      else this.#collapse()

      return
    }

    if (event.key === 'Enter' && !this.querySelector('[data-slot="combobox-item"]')) {
      event.preventDefault()
      const query = this.#query()

      if (query) location.assign(allPath(query))
    }
  }

  #find = (event: KeyboardEvent) => {
    if (!letter(event, 'k') || event.metaKey === event.ctrlKey || event.altKey || event.shiftKey) return

    if (event.defaultPrevented || composing(event) || (typing(event.target) && event.target !== this.#input)) return
    event.preventDefault()
    this.#expand()
  }

  #outside = (event: PointerEvent) => {
    const target = event.target as Node

    if (this.#box?.contains(target) || this.#popup?.contains(target)) return
    this.#close()
    this.#collapse()
  }

  #left = (event: FocusEvent) => {
    const next = event.relatedTarget

    if (next instanceof Node && (this.#box?.contains(next) || this.#popup?.contains(next))) return
    this.#close()

    if (next instanceof Node) this.#collapse()
  }

  #toggled = (event: CustomEvent<OpenChange>) => {
    if (event.target === this.#popup) this.#input?.setAttribute('aria-expanded', String(event.detail.open))
  }

  #press = (event: MouseEvent) => {
    const target = event.target as Element

    if (target.closest('[data-search-open]')) this.#expand()
    else if (target.closest('[data-search-close]')) {
      this.#close()
      this.#collapse()
    } else if (target.closest('[data-search-field]')) this.#begin()
  }

  #lit = (event: CustomEvent<ItemHighlighted>) => {
    const { value, reason } = event.detail
    const hit = this.#hits.find((one) => one.work.id === value)

    if (!hit && value !== null) return
    window.clearTimeout(this.#settling)

    if (reason === 'none') this.#preview(hit ?? null)
    else this.#settling = window.setTimeout(() => this.#preview(hit ?? null), SETTLE_MS)
  }

  #picked = () => this.#close()

  #keep = (event: MouseEvent) => {
    if (this.#popup?.contains(event.target as Node)) event.preventDefault()
  }

  connectedCallback() {
    this.#input = this.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')
    this.#popup = document.getElementById(SEARCH_POPUP)
    this.#box = this.querySelector<HTMLElement>('[data-search-box]')

    if (this.#input && onBrowse()) this.#input.value = new URLSearchParams(location.search).get('q') ?? ''
    this.#input?.addEventListener('input', this.#typed)
    this.#input?.addEventListener('focus', this.#focused)
    this.#input?.addEventListener('keydown', this.#key)
    this.#box?.addEventListener('focusout', this.#left)
    this.#box?.addEventListener('pointerenter', this.#near)
    this.#popup?.addEventListener('openchange', this.#toggled)
    this.addEventListener('click', this.#press)
    this.addEventListener('mousedown', this.#keep)
    this.addEventListener('itemhighlighted', this.#lit)
    this.addEventListener('valuechange', this.#picked)
    window.addEventListener('keydown', this.#find)
    document.addEventListener('pointerdown', this.#outside, true)
  }

  disconnectedCallback() {
    this.#input?.removeEventListener('input', this.#typed)
    this.#input?.removeEventListener('focus', this.#focused)
    this.#input?.removeEventListener('keydown', this.#key)
    this.#box?.removeEventListener('focusout', this.#left)
    this.#box?.removeEventListener('pointerenter', this.#near)
    this.#popup?.removeEventListener('openchange', this.#toggled)
    this.removeEventListener('click', this.#press)
    this.removeEventListener('mousedown', this.#keep)
    this.removeEventListener('itemhighlighted', this.#lit)
    this.removeEventListener('valuechange', this.#picked)
    window.removeEventListener('keydown', this.#find)
    document.removeEventListener('pointerdown', this.#outside, true)
    window.clearTimeout(this.#saying)
    window.clearTimeout(this.#settling)
    this.#names.stop()
  }

  #query(): string {
    return this.#input?.value.trim() ?? ''
  }

  #load() {
    if (heldIndex()) return
    const load = searchIndex()

    if (load === this.#loading) return
    this.#loading = load
    load.then(
      () => {
        if (this.#isOpen()) this.#render()
        else if (this.#wanted) this.#reveal()
      },
      () => {
        if (!this.#isOpen() && !this.#wanted) return
        this.#render()
        this.#open()
      },
    )
  }

  #begin() {
    if (this.#isOpen() || this.#wanted) return
    this.#wanted = true
    this.#load()

    if (heldIndex()) this.#reveal()
  }

  #reveal() {
    const list = this.querySelector('[data-search-list]')

    this.#drawn = ''
    this.#input?.removeAttribute('aria-activedescendant')
    fill(list, '')
    this.#render()
    this.#preview(this.#hits[0] ?? null)
    decoded(document.querySelector('[data-search-preview]')?.lastElementChild).then(() => {
      if (!this.#wanted) return
      this.#open()
      list?.scrollTo(0, 0)
    })
  }

  #expand() {
    this.#box?.setAttribute('data-expanded', '')
    this.#input?.focus()
    this.#input?.select()
    this.#begin()
  }

  #collapse() {
    this.#box?.removeAttribute('data-expanded')
  }

  #isOpen(): boolean {
    return this.#popup?.matches(':popover-open') ?? false
  }

  #open() {
    const popup = this.#popup

    this.#wanted = false

    if (popup) show(popup, 'none')
  }

  #close() {
    this.#wanted = false

    if (this.#popup) hide(this.#popup, 'none')
  }

  #view(index: SearchIndex | null): SearchView {
    const query = this.#query()
    const answer = this.#names.answers.get(query)
    const naming = this.#names.naming === query && query !== ''

    const all = !index
      ? []
      : query
        ? searchWorks(index.works, query, this.#names.named(query))
        : allWorks(index.works, wornNow())

    const known = new Set(all.map((hit) => hit.work.id))

    this.#hits = !query && previewing() ? all : all.slice(0, SHOWN)

    return {
      query,
      hits: this.#hits,
      more: all.length - this.#hits.length,
      found: all.length === 0 ? (answer?.found ?? []).filter((work) => !known.has(work.id)) : [],
      markets: index ? marketsFor(index.markets, query) : [],
      state: !index
        ? indexFailed()
          ? 'unloaded'
          : 'loading'
        : naming && this.#names.stalled
          ? 'naming'
          : query !== '' && this.#names.failed === query
            ? 'failed'
            : 'done',
      label: answer?.label ?? query,
      make: makePath(answer?.name ?? paletteNameOf(query) ?? null),
      request: answer?.request ?? requestUrl(query),
    }
  }

  #render() {
    const list = this.querySelector('[data-search-list]')
    const foot = document.querySelector('[data-search-foot]')
    const view = this.#view(heldIndex())

    const drawn = JSON.stringify([
      view.state,
      view.query,
      view.hits.map((hit) => `${hit.work.id}:${hit.palette.name}`),
      view.found.map((work) => work.id),
      view.markets.map((market) => market.id),
    ])

    if (drawn !== this.#drawn) {
      this.#drawn = drawn
      const lit = list?.querySelector<HTMLElement>('[data-highlighted]')?.dataset.value
      list?.toggleAttribute('data-long', view.hits.length > SHOWN)
      fill(list, html(SearchRows({ view })))
      this.#preview(this.#hits.find((hit) => hit.work.id === lit) ?? this.#hits[0] ?? null)

      if (view.query) for (const hit of this.#hits) warm(hit.work.art)
    }

    const count = view.state === 'unloaded' ? null : view.hits.length + view.more
    const bare = count === 0 || (!view.query && location.pathname === BROWSE_PATH)
    fill(
      foot,
      bare ? '' : html(SearchFoot({ href: view.query ? allPath(view.query) : BROWSE_PATH, query: view.query })),
    )
    this.#say(view, count)
  }

  #preview(hit: Hit | null) {
    window.clearTimeout(this.#settling)
    const worn = wornNow()
    const key = keyOf(hit, worn)
    const host = document.querySelector('[data-search-preview]')

    if (key === this.#card.key || !host || !previewing()) return
    const from = this.#hits.findIndex((one) => keyOf(one, worn) === this.#card.key)
    const to = hit ? this.#hits.indexOf(hit) : -1
    const way = from >= 0 && to >= 0 && to < from ? -1 : 1
    const card = parsed(html(SearchPreview({ hit, inUse: hit !== null && isWorn(hit, worn) })))

    if (!this.#isOpen()) {
      this.#card = { key, coming: null }
      host.replaceChildren(card)

      return
    }

    this.#card = { key, coming: card }
    card.style.opacity = '0'
    host.append(card)
    decoded(card).then(() => {
      if (this.#card.coming !== card) {
        card.remove()

        return
      }

      card.style.removeProperty('opacity')
      enter(card, way)
    })
  }

  #say(view: SearchView, count: number | null) {
    window.clearTimeout(this.#saying)

    if (view.state === 'loading' || view.state === 'naming' || !view.query) return

    const said =
      count === null
        ? 'the works did not load'
        : count === 0
          ? `no work matches “${view.query}”`
          : `${count} ${count === 1 ? 'work' : 'works'}`

    this.#saying = window.setTimeout(() => announce(said), SAY_MS)
  }
}

customElements.define('site-search', SiteSearch)
