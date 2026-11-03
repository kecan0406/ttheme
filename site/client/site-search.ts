import { SEARCH_POPUP, SearchFoot, SearchPreview, SearchRows, type SearchView } from '@/components/site-search'
import { BROWSE_PATH } from '@/lib/gallery'
import { makePath } from '@/lib/names'
import { html } from '@/lib/render'
import { type Hit, marketsFor, type SearchIndex, SHOWN, searchWorks } from '@/lib/search'
import { paletteNameOf, requestUrl } from '../../src/core/names.ts'
import { announce, fill } from './dom'
import { composing, letter, typing } from './keys'
import { NameLookup } from './names'
import { heldIndex, searchIndex } from './search-index'
import type { ItemHighlighted } from './ui/change'
import { hide, show } from './ui/popover'

const SAY_MS = 600

function onBrowse(): boolean {
  return location.pathname === BROWSE_PATH || location.pathname.startsWith(`${BROWSE_PATH}/`)
}

function allPath(query: string): string {
  const path = onBrowse() ? location.pathname : BROWSE_PATH

  return query ? `${path}?${new URLSearchParams({ q: query })}` : path
}

class SiteSearch extends HTMLElement {
  #input: HTMLInputElement | null = null
  #popup: HTMLElement | null = null
  #box: HTMLElement | null = null
  #hits: Hit[] = []
  #drawn = ''
  #shown = ''
  #saying = 0
  #failed = false
  #names = new NameLookup((asked) => {
    if (asked === this.#query()) this.#render()
  })

  #typed = () => {
    const query = this.#query()

    if (!query) {
      this.#close()

      return
    }

    this.#names.later(query)
    this.#render()
    this.#open()
  }

  #focused = () => {
    this.#names.warm()
    this.#load()

    if (this.#query()) {
      this.#render()
      this.#open()
    }
  }

  #key = (event: KeyboardEvent) => {
    if (composing(event)) return

    if (event.key === 'Escape') {
      event.preventDefault()

      if (this.#popup?.matches(':popover-open')) this.#close()
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
  }

  #press = (event: MouseEvent) => {
    const target = event.target as Element

    if (target.closest('[data-search-open]')) this.#expand()
    else if (target.closest('[data-search-close]')) {
      this.#close()
      this.#collapse()
    }
  }

  #lit = (event: CustomEvent<ItemHighlighted>) => {
    const hit = this.#hits.find((one) => one.work.id === event.detail.value)

    if (hit || event.detail.value === null) this.#preview(hit ?? null)
  }

  #picked = () => this.#close()

  connectedCallback() {
    this.#input = this.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')
    this.#popup = document.getElementById(SEARCH_POPUP)
    this.#box = this.querySelector<HTMLElement>('[data-search-box]')

    if (this.#input && onBrowse()) this.#input.value = new URLSearchParams(location.search).get('q') ?? ''
    this.#input?.addEventListener('input', this.#typed)
    this.#input?.addEventListener('focus', this.#focused)
    this.#input?.addEventListener('keydown', this.#key)
    this.#input?.addEventListener('blur', this.#left)
    this.addEventListener('click', this.#press)
    this.addEventListener('itemhighlighted', this.#lit)
    this.addEventListener('valuechange', this.#picked)
    window.addEventListener('keydown', this.#find)
    document.addEventListener('pointerdown', this.#outside, true)
  }

  disconnectedCallback() {
    this.#input?.removeEventListener('input', this.#typed)
    this.#input?.removeEventListener('focus', this.#focused)
    this.#input?.removeEventListener('keydown', this.#key)
    this.#input?.removeEventListener('blur', this.#left)
    this.removeEventListener('click', this.#press)
    this.removeEventListener('itemhighlighted', this.#lit)
    this.removeEventListener('valuechange', this.#picked)
    window.removeEventListener('keydown', this.#find)
    document.removeEventListener('pointerdown', this.#outside, true)
    window.clearTimeout(this.#saying)
    this.#names.stop()
  }

  #query(): string {
    return this.#input?.value.trim() ?? ''
  }

  #load() {
    if (heldIndex()) return
    this.#failed = false
    searchIndex().then(
      () => this.#render(),
      () => {
        this.#failed = true
        this.#render()
      },
    )
  }

  #expand() {
    this.#box?.setAttribute('data-expanded', '')
    this.#input?.focus()
    this.#input?.select()
  }

  #collapse() {
    this.#box?.removeAttribute('data-expanded')
  }

  #open() {
    const popup = this.#popup

    if (!popup) return
    show(popup, 'none')
    this.#input?.setAttribute('aria-expanded', 'true')
  }

  #close() {
    if (this.#popup) hide(this.#popup, 'none')
    this.#input?.setAttribute('aria-expanded', 'false')
  }

  #view(index: SearchIndex | null): SearchView {
    const query = this.#query()
    const answer = this.#names.answers.get(query)
    const naming = this.#names.naming === query && query !== ''
    const all = index ? searchWorks(index.works, query, this.#names.named(query)) : []
    const known = new Set(all.map((hit) => hit.work.id))

    this.#hits = all.slice(0, SHOWN)

    return {
      query,
      hits: this.#hits,
      more: all.length - this.#hits.length,
      found: all.length === 0 ? (answer?.found ?? []).filter((work) => !known.has(work.id)) : [],
      markets: index ? marketsFor(index.markets, query) : [],
      state: !index
        ? this.#failed
          ? 'unloaded'
          : 'loading'
        : naming && this.#names.stalled
          ? 'naming'
          : this.#names.failed === query
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
      fill(list, html(SearchRows({ view })))
      this.#preview(this.#hits[0] ?? null)
    }

    const count = view.state === 'unloaded' ? null : view.hits.length + view.more
    fill(foot, count === 0 ? '' : html(SearchFoot({ href: allPath(view.query) })))
    this.#say(view, count)
  }

  #preview(hit: Hit | null) {
    const key = hit ? `${hit.work.id}:${hit.palette.name}` : ''

    if (key === this.#shown) return
    this.#shown = key
    fill(document.querySelector('[data-search-preview]'), html(SearchPreview({ hit })))
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
