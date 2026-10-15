import {
  type Filters,
  matches,
  type Peek,
  type Searchable,
  SOURCES,
  type Source,
  START,
  shelvesMatching,
} from '@/lib/gallery'
import { readJson, reducedMotion, tally } from './dom'
import { composing, letter, typing } from './keys'

const TURN_MS = 2000

function palettesOf(card: HTMLElement): Searchable[] {
  const official = card.hasAttribute('data-official')

  return (card.dataset.search ?? '').split('\n').map((text) => ({ text, official }))
}

function shelfOf(element: Element): string {
  return element.closest<HTMLElement>('[data-shelf]')?.dataset.shelf ?? ''
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

  #input = (event: Event) => {
    const target = event.target as HTMLInputElement

    if (target.name !== 'query') return
    this.#filters = { ...this.#filters, query: target.value }
    tally(this.#render())
  }

  #change = (event: Event) => {
    const { name, value } = event.target as HTMLInputElement

    if (name !== 'source') return
    this.#filters = { ...this.#filters, source: value as Source }
    tally(this.#render())
  }

  #toggle = (event: Event) => {
    const details = event.target

    if (!(details instanceof HTMLDetailsElement) || this.#filtering()) return
    const key = shelfOf(details)

    if (details.open) this.#open.add(key)
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
    this.addEventListener('toggle', this.#toggle, true)
    this.addEventListener('click', this.#click)
    window.addEventListener('keydown', this.#find)

    for (const details of this.querySelectorAll<HTMLDetailsElement>('[data-shelf] details[open]'))
      this.#open.add(shelfOf(details))
    const query = this.querySelector<HTMLInputElement>('input[name="query"]')?.value ?? ''
    const start = this.querySelector<HTMLInputElement>(`input[name="source"][value="${START.source}"]`)

    if (start) start.checked = true
    this.#filters = { query, source: START.source }
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
    window.removeEventListener('keydown', this.#find)
    window.clearInterval(this.#timer)
    this.#observer?.disconnect()
  }

  #filtering(): boolean {
    return this.#filters.query.trim() !== ''
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
    const use = peek.querySelector('[data-use]')

    if (use) use.textContent = next.use
  }

  #render(): number {
    const shelves = [...this.querySelectorAll<HTMLElement>('[data-shelf]')]
    const cards = shelves.map((shelf) => [...shelf.querySelectorAll<HTMLElement>('[data-catalog]')])
    const members = cards.map((group) => group.map(palettesOf))
    const found = members.map((group) => group.flat())

    for (const source of SOURCES) {
      const label = this.querySelector(`[data-count="${source}"]`)

      if (label) label.textContent = String(shelvesMatching(found, { ...this.#filters, source }))
    }

    const filtering = this.#filtering()
    let shown = 0

    for (const [index, shelf] of shelves.entries()) {
      const matched = (members[index] ?? []).map(
        (palettes) => palettes.filter((palette) => matches(palette, this.#filters)).length,
      )

      for (const [at, card] of (cards[index] ?? []).entries()) card.hidden = matched[at] === 0
      const visible = matched.reduce((sum, count) => sum + count, 0)
      const total = found[index]?.length ?? 0
      const count = shelf.querySelector('[data-shelf-count]')

      if (count) count.textContent = filtering ? `${visible} of ${total}` : String(total)
      shelf.hidden = visible === 0
      const details = shelf.querySelector('details')

      if (details) details.open = filtering ? visible > 0 : this.#open.has(shelf.dataset.shelf ?? '')
      shown += visible
    }

    this.querySelector('[data-empty]')?.toggleAttribute('hidden', shown > 0)
    const title = this.querySelector('[data-empty-title]')
    const query = this.#filters.query.trim()

    if (title) title.textContent = `no palette matches${query ? ` “${query}”` : ' these filters'}`

    return shown
  }
}

customElements.define('marketplace-board', MarketplaceBoard)
