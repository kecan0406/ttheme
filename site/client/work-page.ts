import type { Peek } from '@/lib/gallery'
import { plural } from '@/lib/utils'
import type { WorkData } from '@/lib/works'
import { announce, readJson, reducedMotion } from './dom'

class WorkPage extends HTMLElement {
  #data: WorkData = { markets: {} }
  #who: string | null = null
  #at = new Map<string, number>()
  #opened = new Set<string>()

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const slot = target.closest<HTMLElement>('button[data-who]')

    if (slot) {
      const who = slot.dataset.who ?? null

      this.#pick(who === this.#who ? null : who)

      return
    }

    if (target.closest('[data-show-all]')) {
      this.#pick(null)

      return
    }

    const market = target.closest<HTMLElement>('[data-market]')
    const step = target.closest<HTMLElement>('[data-peek-step]')

    if (market && step) {
      const id = market.dataset.market ?? ''
      const count = this.#peeks(id).length

      this.#at.set(id, ((((this.#at.get(id) ?? 0) + Number(step.dataset.peekStep)) % count) + count) % count)
      this.#pick(null)

      return
    }

    if (!market || !target.closest('[data-fold-toggle]')) return
    const id = market.dataset.market ?? ''
    const open = !this.#isOpen(market)

    if (open) this.#opened.add(id)
    else this.#opened.delete(id)

    if (!open && this.#who !== null) this.#pick(null)
    else this.#fold(market, open)
  }

  connectedCallback() {
    this.#data = readJson<WorkData>(this, 'script[data-work]')
    this.addEventListener('click', this.#click)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
  }

  #peeks(id: string): Peek[] {
    return Object.hasOwn(this.#data.markets, id) ? (this.#data.markets[id]?.peeks ?? []) : []
  }

  #whoIn(id: string): (string | null)[] {
    return Object.hasOwn(this.#data.markets, id) ? (this.#data.markets[id]?.who ?? []) : []
  }

  #isOpen(market: HTMLElement): boolean {
    return market.querySelector('[data-fold]')?.hasAttribute('data-open') ?? false
  }

  #pick(who: string | null) {
    this.#who = who
    const markets = [...this.querySelectorAll<HTMLElement>('[data-market]')]

    const plans = markets.map((market) => {
      const id = market.dataset.market ?? ''
      const hit = who === null ? -1 : this.#whoIn(id).indexOf(who)
      const cards = [...market.querySelectorAll<HTMLElement>('[data-fold] a[data-who]')]
      const card = hit < 0 ? undefined : cards[hit]
      const below = card !== undefined && card.offsetTop > (cards[0]?.offsetTop ?? 0)
      const open = this.#isOpen(market)

      return { market, id, hit, open: this.#opened.has(id) || (hit >= 0 && (open || below)) }
    })

    for (const slot of this.querySelectorAll<HTMLElement>('button[data-who]')) {
      slot.setAttribute('aria-pressed', String(who !== null && slot.dataset.who === who))
      slot.toggleAttribute('data-dim', who !== null && slot.dataset.who !== who)
    }

    this.querySelector('[data-show-all]')?.toggleAttribute('hidden', who === null)

    for (const { market, id, hit, open } of plans) {
      const missing = who !== null && hit < 0
      const note = market.querySelector<HTMLElement>('[data-missing-note]')
      const name = market.querySelector('[data-missing-who]')

      market.toggleAttribute('data-missing', missing)

      if (note) note.hidden = !missing

      if (name) name.textContent = who ?? ''

      for (const card of market.querySelectorAll<HTMLElement>('a[data-who]')) {
        card.toggleAttribute('data-picked', who !== null && card.dataset.who === who)
        card.toggleAttribute('data-dim', who !== null && card.dataset.who !== who)
      }

      if (!missing) this.#show(market, hit >= 0 ? hit : (this.#at.get(id) ?? 0))

      if (market.querySelector('[data-fold]') && open !== this.#isOpen(market)) this.#fold(market, open)
    }

    if (who === null) return
    const holding = plans.filter((plan) => plan.hit >= 0).length

    announce(`${who}: ${plural(holding, 'marketplace')} of ${plans.length}`)
  }

  #show(market: HTMLElement, index: number) {
    const peek = market.querySelector<HTMLElement>('[data-peek]')
    const next = this.#peeks(market.dataset.market ?? '')[index]

    if (!peek || !next) return
    peek.setAttribute('style', next.style)
    const title = peek.querySelector('[data-window-title]')

    if (title) title.textContent = next.title
    const use = peek.querySelector('[data-live="use"]')

    if (use) use.textContent = next.use
  }

  #fold(market: HTMLElement, open: boolean) {
    const fold = market.querySelector<HTMLElement>('[data-fold]')
    const toggle = market.querySelector<HTMLElement>('[data-fold-toggle]')
    const label = market.querySelector('[data-fold-label]')

    if (!fold) return
    const height = `${fold.scrollHeight}px`

    toggle?.setAttribute('aria-expanded', String(open))

    if (label) label.textContent = open ? 'collapse' : 'expand'
    fold.toggleAttribute('data-open', open)

    if (open) {
      fold.style.maxHeight = height

      if (reducedMotion()) fold.style.maxHeight = 'none'
      else
        fold.addEventListener(
          'transitionend',
          () => {
            if (fold.hasAttribute('data-open')) fold.style.maxHeight = 'none'
          },
          { once: true },
        )

      return
    }

    fold.style.maxHeight = height
    void fold.offsetHeight
    fold.style.maxHeight = ''
  }
}

customElements.define('work-page', WorkPage)
