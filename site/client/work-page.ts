import { plural } from '@/lib/utils'
import { announce } from './dom'

class WorkPage extends HTMLElement {
  #who: string | null = null

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const slot = target.closest<HTMLElement>('button[data-who]')

    if (slot) {
      const who = slot.dataset.who ?? null

      this.#pick(who === this.#who ? null : who)

      return
    }

    if (target.closest('[data-show-all]')) this.#pick(null)
  }

  connectedCallback() {
    this.addEventListener('click', this.#click)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
  }

  #pick(who: string | null) {
    this.#who = who

    for (const slot of this.querySelectorAll<HTMLElement>('button[data-who]')) {
      slot.setAttribute('aria-pressed', String(who !== null && slot.dataset.who === who))
      slot.toggleAttribute('data-dim', who !== null && slot.dataset.who !== who)
    }

    this.querySelector('[data-show-all]')?.toggleAttribute('hidden', who === null)
    const markets = [...this.querySelectorAll<HTMLElement>('[data-market]')]
    let holding = 0

    for (const market of markets) {
      const tracks = [...market.querySelectorAll<HTMLElement>('a[data-who]')]
      const hit = who !== null && tracks.some((track) => track.dataset.who === who)
      const missing = who !== null && !hit
      const note = market.querySelector<HTMLElement>('[data-missing-note]')
      const name = market.querySelector('[data-missing-who]')

      if (hit) holding += 1
      market.toggleAttribute('data-missing', missing)

      if (note) note.hidden = !missing

      if (name) name.textContent = who ?? ''

      for (const track of tracks) {
        track.toggleAttribute('data-picked', hit && track.dataset.who === who)
        track.toggleAttribute('data-dim', hit && track.dataset.who !== who)
      }
    }

    if (who !== null) announce(`${who}: ${plural(holding, 'marketplace')} of ${markets.length}`)
  }
}

customElements.define('work-page', WorkPage)
