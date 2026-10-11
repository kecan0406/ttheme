import { PaletteOptions } from '@/components/palette-picker'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { fill, tally } from './dom'
import { composing } from './keys'
import { choose, current } from './wear'

const PAGE = 8

class PalettePicker extends HTMLElement {
  #themes: Theme[] | undefined
  #loading: Promise<void> | undefined
  #touch = false
  #active: HTMLElement | undefined

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
    this.addEventListener('mousedown', this.#keep)
    this.addEventListener('click', this.#click)
    this.addEventListener('input', this.#filter)
    this.addEventListener('compositionend', this.#filter)
    this.#search.addEventListener('keydown', this.#keys)
  }

  disconnectedCallback() {
    this.removeEventListener('mousedown', this.#keep)
    this.removeEventListener('click', this.#click)
    this.removeEventListener('input', this.#filter)
    this.removeEventListener('compositionend', this.#filter)
    this.#search.removeEventListener('keydown', this.#keys)
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

  #worn(): HTMLElement | undefined {
    return this.#options.find((option) => option.getAttribute('aria-selected') === 'true')
  }

  #mark() {
    const name = current()
    for (const option of this.querySelectorAll<HTMLElement>('[role="option"]'))
      option.setAttribute('aria-selected', String(option.dataset.name === name))
    this.#activate(this.#worn() ?? this.#options[0], 'center')
  }

  #activate(option: HTMLElement | undefined, block?: ScrollLogicalPosition) {
    if (this.#active !== option) delete this.#active?.dataset.active
    this.#active = option
    if (!option) {
      this.#search.removeAttribute('aria-activedescendant')
      return
    }
    option.dataset.active = ''
    this.#search.setAttribute('aria-activedescendant', option.id)
    if (block) option.scrollIntoView({ block })
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
    this.#activate(query === '' ? (this.#worn() ?? options[0]) : options[0], 'nearest')
    const empty = this.querySelector<HTMLElement>('[data-empty]')
    if (empty) empty.hidden = options.length > 0
  }

  #filter = (event: Event) => {
    const field = event.target
    if (!(field instanceof HTMLInputElement) || !field.matches('[data-search]')) return
    this.#narrow(field.value.trim().toLowerCase())
    tally(this.#options.length)
  }

  #pick(option: HTMLElement | undefined) {
    const theme = this.#themes?.find((entry) => entry.name === option?.dataset.name)
    if (!theme) return
    this.#panel.hidePopover()
    choose(theme)
  }

  #keep = (event: MouseEvent) => {
    if ((event.target as Element).closest('[role="option"]')) event.preventDefault()
  }

  #click = (event: MouseEvent) => {
    this.#pick((event.target as Element).closest<HTMLElement>('[role="option"]') ?? undefined)
  }

  #keys = (event: KeyboardEvent) => {
    if (composing(event) || event.altKey || event.metaKey || event.ctrlKey) return
    const options = this.#options
    const at = this.#active ? options.indexOf(this.#active) : -1
    const last = options.length - 1
    const go = (index: number) => {
      event.preventDefault()
      this.#activate(options[index], 'nearest')
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      this.#pick(this.#active ?? options[0])
      return
    }
    if (options.length === 0) return
    if (event.key === 'ArrowDown') go(at === last ? 0 : at + 1)
    else if (event.key === 'ArrowUp') go(at <= 0 ? last : at - 1)
    else if (event.key === 'PageDown') go(Math.min(at + PAGE, last))
    else if (event.key === 'PageUp') go(Math.max(at - PAGE, 0))
  }
}

customElements.define('palette-picker', PalettePicker)
