import { PaletteOptions } from '@/components/palette-picker'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { fill } from './dom'
import { choose, current } from './wear'

class PalettePicker extends HTMLElement {
  #themes: Theme[] | undefined
  #loading: Promise<void> | undefined

  get #panel(): HTMLElement {
    return this.querySelector('[popover]') as HTMLElement
  }

  get #search(): HTMLInputElement {
    return this.querySelector('[data-search]') as HTMLInputElement
  }

  get #list(): HTMLElement {
    return this.querySelector('[data-options]') as HTMLElement
  }

  get #options(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[role="option"]:not([hidden])')]
  }

  connectedCallback() {
    const trigger = this.querySelector('[data-wear-trigger]')
    trigger?.addEventListener('pointerenter', this.#load)
    trigger?.addEventListener('focus', this.#load)
    this.#panel.addEventListener('beforetoggle', this.#place)
    this.#panel.addEventListener('toggle', this.#toggled)
    this.addEventListener('click', this.#click)
    this.addEventListener('input', this.#filter)
    this.addEventListener('keydown', this.#keys)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('input', this.#filter)
    this.removeEventListener('keydown', this.#keys)
  }

  #load = (): Promise<void> => {
    this.#loading ??= fetch('/palettes.json')
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<Theme[]>
      })
      .then((themes) => {
        this.#themes = themes
        fill(this.#list, html(<PaletteOptions themes={themes} current={current()} />))
      })
      .catch(() => {
        this.#loading = undefined
        fill(this.#list, html(<p class="px-2.5 py-2 text-xs text-muted-foreground">couldn't load the palettes</p>))
      })
    return this.#loading
  }

  #place = (event: Event) => {
    if ((event as ToggleEvent).newState !== 'open') return
    const trigger = this.querySelector('[data-wear-trigger]') as HTMLElement
    const box = trigger.getBoundingClientRect()
    const panel = this.#panel
    panel.style.top = `${box.bottom + 8}px`
    const width = Math.min(256, window.innerWidth - 32)
    panel.style.right = `${Math.max(16, Math.min(window.innerWidth - box.right, window.innerWidth - width - 16))}px`
    panel.style.left = 'auto'
  }

  #toggled = (event: Event) => {
    if ((event as ToggleEvent).newState === 'open') {
      this.#search.focus()
      void this.#load().then(() => this.#mark())
      return
    }
    this.#search.value = ''
    this.#narrow('')
  }

  #mark() {
    const name = current()
    for (const option of this.querySelectorAll<HTMLElement>('[role="option"]'))
      option.setAttribute('aria-selected', String(option.dataset.name === name))
    this.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }

  #narrow(query: string) {
    for (const shelf of this.querySelectorAll<HTMLElement>('[data-shelf]')) {
      let shown = 0
      for (const option of shelf.querySelectorAll<HTMLElement>('[role="option"]')) {
        const match = query === '' || (option.dataset.text ?? '').includes(query)
        option.hidden = !match
        if (match) shown++
      }
      shelf.hidden = shown === 0
    }
    const empty = this.querySelector<HTMLElement>('[data-empty]')
    if (empty) empty.hidden = this.#options.length > 0
  }

  #filter = (event: Event) => {
    const field = event.target
    if (field instanceof HTMLInputElement && field.matches('[data-search]'))
      this.#narrow(field.value.trim().toLowerCase())
  }

  #click = (event: MouseEvent) => {
    const option = (event.target as Element).closest<HTMLElement>('[role="option"]')
    const theme = this.#themes?.find((entry) => entry.name === option?.dataset.name)
    if (!theme) return
    this.#panel.hidePopover()
    choose(theme)
  }

  #keys = (event: KeyboardEvent) => {
    if (!this.#panel.matches(':popover-open')) return
    const options = this.#options
    const at = options.indexOf(document.activeElement as HTMLElement)
    const go = (target: HTMLElement | undefined) => {
      if (!target) return
      event.preventDefault()
      target.focus()
    }
    if (event.key === 'ArrowDown') go(at === -1 ? options[0] : options[at + 1])
    else if (event.key === 'ArrowUp' && at === 0) go(this.#search)
    else if (event.key === 'ArrowUp' && at > 0) go(options[at - 1])
    else if (event.key === 'Home' && at !== -1) go(options[0])
    else if (event.key === 'End' && at !== -1) go(options.at(-1))
    else if (event.key === 'Enter' && event.target === this.#search) options[0]?.click()
  }
}

customElements.define('palette-picker', PalettePicker)
