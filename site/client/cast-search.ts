import { CastAsking, CastFailed, CastFound } from '@/components/cast-members'
import { type CastAnswer, castPath, NAME_PAUSE } from '@/lib/names'
import { html } from '@/lib/render'
import { plural } from '@/lib/utils'
import { announce, fill } from './dom'

class CastSearch extends HTMLElement {
  #pause = 0

  #asking: AbortController | null = null

  #input = () => {
    window.clearTimeout(this.#pause)
    this.#pause = window.setTimeout(() => this.#ask(), NAME_PAUSE)
  }

  connectedCallback() {
    this.addEventListener('input', this.#input)
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#input)
    window.clearTimeout(this.#pause)
    this.#asking?.abort()
  }

  #ask() {
    const query = this.querySelector('input')?.value.trim() ?? ''
    const found = this.querySelector('[data-found]')

    this.#asking?.abort()
    this.#asking = null

    if (!query) {
      fill(found, '')

      return
    }

    const asking = new AbortController()
    const work = this.dataset.name ?? ''
    const lang = this.dataset.lang || null
    this.#asking = asking
    fill(found, html(CastAsking({ query })))

    fetch(castPath(this.dataset.work ?? '', query), { signal: asking.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))

        return response.json() as Promise<CastAnswer>
      })
      .then(
        (answer) => {
          if (this.#asking !== asking) return
          fill(found, html(CastFound({ cast: answer.cast, query, work, lang })))
          announce(answer.cast.length === 0 ? `no “${query}” in ${work}` : plural(answer.cast.length, 'character'))
        },
        () => {
          if (this.#asking === asking && !asking.signal.aborted) fill(found, html(CastFailed()))
        },
      )
  }
}

customElements.define('cast-search', CastSearch)
