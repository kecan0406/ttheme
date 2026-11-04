import { PaletteOptions } from '@/components/palette-picker'
import { palettesPath } from '@/lib/gallery'
import { html } from '@/lib/render'
import { BUILTIN, type Theme } from '@/lib/themes'
import { tileLook } from '@/lib/works'
import { fill, reducedMotion } from './dom'
import { palettes } from './palettes'
import { searchIndex } from './search-index'
import type { OpenChange, ValueChange } from './ui/change'
import { choose, current } from './wear'

const FADE_MS = 260

const LATE_MARGIN = '320px 0px'

function reveal(image: HTMLImageElement) {
  if (!reducedMotion()) {
    image.addEventListener(
      'load',
      () => image.animate({ opacity: [0, 1] }, { duration: FADE_MS, easing: 'ease-out' }),
      {
        once: true,
      },
    )
  }

  if (image.dataset.srcset) image.srcset = image.dataset.srcset

  if (image.dataset.src) image.src = image.dataset.src
}

class PalettePicker extends HTMLElement {
  #themes: Theme[] | undefined
  #loading: Promise<void> | undefined
  #lit: HTMLElement | null = null
  #late: IntersectionObserver | null = null

  connectedCallback() {
    const trigger = this.querySelector('[data-wear-trigger]')
    trigger?.addEventListener('pointerenter', this.#load)
    trigger?.addEventListener('focus', this.#load)
    this.addEventListener('openchange', this.#opened)
    this.addEventListener('valuechange', this.#picked)
    this.addEventListener('itemhighlighted', this.#light)
  }

  disconnectedCallback() {
    this.removeEventListener('openchange', this.#opened)
    this.removeEventListener('valuechange', this.#picked)
    this.removeEventListener('itemhighlighted', this.#light)
    this.#late?.disconnect()
  }

  #load = (): Promise<void> => {
    this.#loading ??= Promise.all([palettes(palettesPath(BUILTIN)), searchIndex().catch(() => null)])
      .then(([themes, index]) => {
        const list = this.querySelector('[data-options]')
        const arts = new Map(index?.works.map((work) => [work.id, work]))

        this.#themes = themes
        fill(list, html(<PaletteOptions themes={themes} current={current()} arts={arts} />))
        this.#watch(list)
      })
      .catch(() => {
        this.#loading = undefined
        fill(
          this.querySelector('[data-options]'),
          html(<p class="px-2.5 py-2 text-xs text-muted-foreground">couldn't load the palettes</p>),
        )
      })

    return this.#loading
  }

  #watch(list: Element | null) {
    this.#late?.disconnect()

    const late = new IntersectionObserver(
      (entries) => {
        for (const { isIntersecting, target } of entries) {
          if (!isIntersecting) continue
          late.unobserve(target)
          reveal(target as HTMLImageElement)
        }
      },
      { root: list, rootMargin: LATE_MARGIN },
    )

    for (const image of list?.querySelectorAll('img[data-src]') ?? []) late.observe(image)
    this.#late = late
  }

  #opened = (event: CustomEvent<OpenChange>) => {
    const box = this.querySelector<HTMLElement>('[data-slot="combobox"]')

    if (!event.detail.open || !box) return
    box.dataset.value = current()

    for (const shelf of this.querySelectorAll<HTMLElement>('[data-shelf]')) this.#rest(shelf)
    void this.#load()
  }

  #picked = (event: CustomEvent<ValueChange>) => {
    const theme = this.#themes?.find((entry) => entry.name === event.detail.value)

    if (theme) choose(theme)
    else event.preventDefault()
  }

  #light = () => {
    const item = this.querySelector<HTMLElement>('[data-slot="combobox-item"][data-highlighted]')
    const shelf = item?.closest<HTMLElement>('[data-shelf]') ?? null

    if (this.#lit && this.#lit !== shelf) this.#rest(this.#lit)
    this.#lit = shelf

    if (shelf) this.#wear(shelf, item?.dataset.value)
  }

  #rest(shelf: HTMLElement) {
    const worn = current()

    const here = [...shelf.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]')].some(
      (item) => item.dataset.value === worn,
    )

    this.#wear(shelf, here ? worn : shelf.dataset.lead)
  }

  #wear(shelf: HTMLElement, name: string | undefined) {
    const theme = this.#themes?.find((entry) => entry.name === name)

    if (theme) shelf.querySelector('[data-slot="melt-card"]')?.setAttribute('style', tileLook(theme))
  }
}

customElements.define('palette-picker', PalettePicker)
