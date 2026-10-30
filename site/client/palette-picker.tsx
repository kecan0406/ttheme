import { PaletteOptions } from '@/components/palette-picker'
import { palettesPath } from '@/lib/gallery'
import { html } from '@/lib/render'
import { BUILTIN, type Theme } from '@/lib/themes'
import { fill } from './dom'
import { palettes } from './palettes'
import type { OpenChange, ValueChange } from './ui/change'
import { choose, current } from './wear'

class PalettePicker extends HTMLElement {
  #themes: Theme[] | undefined
  #loading: Promise<void> | undefined

  connectedCallback() {
    const trigger = this.querySelector('[data-wear-trigger]')
    trigger?.addEventListener('pointerenter', this.#load)
    trigger?.addEventListener('focus', this.#load)
    this.addEventListener('openchange', this.#opened)
    this.addEventListener('valuechange', this.#picked)
  }

  disconnectedCallback() {
    this.removeEventListener('openchange', this.#opened)
    this.removeEventListener('valuechange', this.#picked)
  }

  #load = (): Promise<void> => {
    this.#loading ??= palettes(palettesPath(BUILTIN))
      .then((themes) => {
        this.#themes = themes
        fill(this.querySelector('[data-options]'), html(<PaletteOptions themes={themes} current={current()} />))
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

  #opened = (event: CustomEvent<OpenChange>) => {
    const box = this.querySelector<HTMLElement>('[data-slot="combobox"]')

    if (!event.detail.open || !box) return
    box.dataset.value = current()
    void this.#load()
  }

  #picked = (event: CustomEvent<ValueChange>) => {
    const theme = this.#themes?.find((entry) => entry.name === event.detail.value)

    if (theme) choose(theme)
    else event.preventDefault()
  }
}

customElements.define('palette-picker', PalettePicker)
