import { PaletteOptions } from '@/components/palette-picker'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { fill } from './dom'
import { bare, composing, printable } from './keys'
import { choose, current } from './wear'

const PAGE = 8

class PalettePicker extends HTMLElement {
  #themes: Theme[] | undefined
  #loading: Promise<void> | undefined
  #touch = false

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
    trigger?.addEventListener('pointerdown', this.#press)
    trigger?.addEventListener('keydown', this.#press)
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

  #press = (event: Event) => {
    this.#touch = event instanceof PointerEvent && event.pointerType === 'touch'
  }

  #toggled = (event: Event) => {
    if ((event as ToggleEvent).newState === 'open') {
      if (!this.#touch) this.#search.focus()
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
    const selected = this.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
    this.#rove(selected ?? this.#options[0])
    selected?.scrollIntoView({ block: 'center' })
  }

  #rove(target: HTMLElement | undefined) {
    for (const option of this.querySelectorAll<HTMLElement>('[role="option"]'))
      option.tabIndex = option === target ? 0 : -1
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
    const options = this.#options
    if (!options.some((option) => option.tabIndex === 0))
      this.#rove(options.find((option) => option.getAttribute('aria-selected') === 'true') ?? options[0])
    const empty = this.querySelector<HTMLElement>('[data-empty]')
    if (empty) empty.hidden = options.length > 0
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

  #retype() {
    const search = this.#search
    search.focus()
    search.setSelectionRange(search.value.length, search.value.length)
  }

  #keys = (event: KeyboardEvent) => {
    if (!this.#panel.matches(':popover-open') || composing(event)) return
    const options = this.#options
    const at = options.indexOf(document.activeElement as HTMLElement)
    const go = (target: HTMLElement | undefined) => {
      if (!target) return
      event.preventDefault()
      if (target !== this.#search) this.#rove(target)
      target.focus()
    }
    if (event.key === 'ArrowDown') go(at === -1 ? options[0] : options[at + 1])
    else if (event.key === 'ArrowUp' && at === 0) go(this.#search)
    else if (event.key === 'ArrowUp' && at > 0) go(options[at - 1])
    else if (event.key === 'Home' && at !== -1) go(options[0])
    else if (event.key === 'End' && at !== -1) go(options.at(-1))
    else if (event.key === 'PageDown' && at !== -1) go(options[Math.min(at + PAGE, options.length - 1)])
    else if (event.key === 'PageUp' && at !== -1) go(options[Math.max(at - PAGE, 0)])
    else if (event.key === 'Enter' && event.target === this.#search) options[0]?.click()
    else if (at !== -1 && ((printable(event) && event.key !== ' ') || (event.key === 'Backspace' && bare(event))))
      this.#retype()
  }
}

customElements.define('palette-picker', PalettePicker)
