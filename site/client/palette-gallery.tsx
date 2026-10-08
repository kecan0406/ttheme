import { PaletteDialogBody } from '@/components/palette-dialog'
import { type Scene, SceneLines } from '@/components/terminal-preview'
import { arrange, type Filters, type Ground, matches, type Source, START } from '@/lib/gallery'
import { html } from '@/lib/render'
import type { GateRule, Marketplace, Theme } from '@/lib/themes'
import { fill, readJson, wear } from './dom'

interface Gallery {
  themes: Theme[]
  marketplaces: Marketplace[]
  gate: GateRule[]
}

class PaletteGallery extends HTMLElement {
  #themes = new Map<string, Theme>()
  #marketplaces: Marketplace[] = []
  #gate: GateRule[] = []
  #filters: Filters = { ...START }

  #input = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.name !== 'query') return
    this.#filters = { ...this.#filters, query: target.value }
    this.#filter()
  }

  #change = (event: Event) => {
    const { name, value } = event.target as HTMLInputElement
    if (name === 'source') this.#filters = { ...this.#filters, source: value as Source }
    else if (name === 'ground') this.#filters = { ...this.#filters, ground: value as Ground }
    else if (name === 'scene' || name === 'dialog-scene') return this.#scene(value as Scene)
    else return
    this.#filter()
  }

  #click = (event: MouseEvent) => {
    const open = (event.target as Element).closest<HTMLElement>('[data-open]')
    if (open) this.#show(open.dataset.open ?? null)
  }

  #hash = () => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    this.#show(this.#themes.has(id) ? id : null)
  }

  #slash = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.target instanceof HTMLInputElement) return
    event.preventDefault()
    this.querySelector<HTMLInputElement>('input[name="query"]')?.focus()
  }

  get #dialog(): HTMLDialogElement {
    return this.querySelector('dialog') as HTMLDialogElement
  }

  connectedCallback() {
    const { themes, marketplaces, gate } = readJson<Gallery>(this, 'script[data-gallery]')
    this.#themes = new Map(themes.map((theme) => [theme.id, theme]))
    this.#marketplaces = marketplaces
    this.#gate = gate
    this.addEventListener('input', this.#input)
    this.addEventListener('change', this.#change)
    this.addEventListener('click', this.#click)
    this.#dialog.addEventListener('close', () => this.#show(null))
    this.#dialog.addEventListener('click', (event) => {
      if (event.target === this.#dialog) this.#dialog.close()
    })
    window.addEventListener('hashchange', this.#hash)
    window.addEventListener('keydown', this.#slash)
    this.#hash()
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.#hash)
    window.removeEventListener('keydown', this.#slash)
  }

  #filter() {
    const shelves = [...this.querySelectorAll<HTMLElement>('[data-shelf]')]
    const counts = shelves.map((shelf) => {
      let count = 0
      for (const card of shelf.querySelectorAll<HTMLElement>('[data-palette]')) {
        const theme = this.#themes.get(card.dataset.palette ?? '')
        const shown = theme !== undefined && matches(theme, this.#filters)
        card.hidden = !shown
        if (shown) count++
      }
      return count
    })
    const placed = arrange(
      shelves.map((shelf, index) => ({
        title: shelf.dataset.shelf ?? '',
        marketplace: shelf.dataset.marketplace !== undefined,
        count: counts[index] ?? 0,
      })),
      this.dataset.sources === 'all',
    )
    for (const [index, shelf] of shelves.entries()) {
      const place = placed[index]
      if (!place) continue
      shelf.hidden = !place.shown
      shelf.querySelector<HTMLElement>('[data-divider]')?.toggleAttribute('hidden', !place.divider)
      shelf.querySelector<HTMLElement>('[data-heading]')?.toggleAttribute('hidden', !place.heading)
      fill(shelf.querySelector('[data-total]'), String(place.total))
      fill(shelf.querySelector('[data-count]'), String(counts[index] ?? 0))
    }
    const shown = counts.reduce((sum, count) => sum + count, 0)
    fill(this.querySelector('[data-shown]'), `${shown} of ${this.#themes.size} palettes`)
    this.querySelector<HTMLElement>('[data-empty]')?.toggleAttribute('hidden', shown > 0)
    const query = this.#filters.query.trim()
    const title = this.querySelector('[data-empty-title]')
    if (title) title.textContent = `no palette matches${query ? ` “${query}”` : ' these filters'} ( ˘ω˘ )`
  }

  #scene(scene: Scene) {
    this.#filters = { ...this.#filters, scene }
    for (const input of this.querySelectorAll<HTMLInputElement>('input[name="scene"], input[name="dialog-scene"]'))
      input.checked = input.value === scene
    for (const card of this.querySelectorAll<HTMLElement>('[data-palette]')) {
      const theme = this.#themes.get(card.dataset.palette ?? '')
      if (theme)
        fill(card.querySelector('[data-slot="terminal-preview"]'), html(<SceneLines theme={theme} scene={scene} />))
    }
    const open = this.#themes.get(decodeURIComponent(window.location.hash.slice(1)))
    if (this.#dialog.open && open)
      fill(
        this.#dialog.querySelector('[data-slot="terminal-preview"]'),
        html(<SceneLines theme={open} scene={scene} />),
      )
  }

  #show(id: string | null) {
    const theme = id === null ? undefined : this.#themes.get(id)
    const url = `${window.location.pathname}${window.location.search}${theme ? `#${theme.id}` : ''}`
    window.history.replaceState(null, '', url)
    const dialog = this.#dialog
    if (!theme) {
      if (dialog.open) dialog.close()
      return
    }
    const marketplace = this.#marketplaces.find((entry) => entry.id === theme.marketplace)
    fill(
      dialog,
      html(<PaletteDialogBody theme={theme} marketplace={marketplace} gate={this.#gate} scene={this.#filters.scene} />),
    )
    wear(dialog, theme)
    if (!dialog.open) dialog.showModal()
  }
}

customElements.define('palette-gallery', PaletteGallery)
