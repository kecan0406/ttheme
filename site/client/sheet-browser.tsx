import { SheetDetails, SheetHeading, SheetUse } from '@/components/sheets'
import { Session, TerminalTabs } from '@/components/terminal-window'
import { html } from '@/lib/render'
import type { GateRule, Theme } from '@/lib/themes'
import { fill, readJson, reducedMotion, settle, swap, wear } from './dom'
import { tabKey } from './tabs'

interface OpenTab {
  id: number
  index: number
}

function typing(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea, [role="tablist"]') !== null
}

class SheetBrowser extends HTMLElement {
  #themes: Theme[] = []
  #gate: GateRule[] = []
  #tabs: OpenTab[] = []
  #active = 0
  #next = 0
  #shown: Theme | undefined

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const hit = (selector: string) => target.closest<HTMLElement>(selector)
    const step = hit('[data-step]')
    const tab = hit('[data-tab]')
    const scroll = hit('[data-scroll]')
    const sheet = hit('[data-sheet]')
    const details = hit('[data-details]')
    if (step) this.#step(Number(step.dataset.step))
    else if (tab) this.#select(Number(tab.dataset.tab))
    else if (hit('[data-new-tab]')) this.#open()
    else if (scroll) this.#scroll(Number(scroll.dataset.scroll))
    else if (sheet) this.#paint(Number(sheet.dataset.sheet))
    else if (details) this.#details(details)
  }

  #keydown = (event: KeyboardEvent) => {
    tabKey(event, (tab) => this.#select(Number(tab.dataset.tab)))
  }

  #arrows = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return
    if (event.key === 'ArrowRight') this.#step(1)
    if (event.key === 'ArrowLeft') this.#step(-1)
  }

  connectedCallback() {
    const { themes, gate } = readJson<{ themes: Theme[]; gate: GateRule[] }>(this, 'script[data-sheets]')
    this.#themes = themes
    this.#gate = gate
    this.#tabs = themes.slice(0, 3).map((_, id) => ({ id, index: id }))
    this.#next = this.#tabs.length
    this.#shown = themes[0]
    this.addEventListener('click', this.#click)
    this.addEventListener('keydown', this.#keydown)
    window.addEventListener('keydown', this.#arrows)
    this.#center()
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('keydown', this.#keydown)
    window.removeEventListener('keydown', this.#arrows)
  }

  get #at(): number {
    return (this.#tabs.find((tab) => tab.id === this.#active) ?? (this.#tabs[0] as OpenTab)).index
  }

  #paint(index: number) {
    this.#tabs = this.#tabs.map((tab) => (tab.id === this.#active ? { ...tab, index } : tab))
    this.#render()
  }

  #step(delta: number) {
    this.#paint((this.#at + delta + this.#themes.length) % this.#themes.length)
  }

  #select(id: number) {
    this.#active = id
    this.#render()
  }

  #open() {
    const last = this.#tabs.at(-1) as OpenTab
    const tab = { id: this.#next++, index: (last.index + 1) % this.#themes.length }
    this.#tabs = [...this.#tabs, tab].slice(-4)
    this.#active = tab.id
    this.#render()
  }

  #scroll(direction: number) {
    const strip = this.querySelector('[data-strip]')
    if (strip) strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' })
  }

  #details(button: HTMLElement) {
    const open = button.getAttribute('aria-expanded') !== 'true'
    button.setAttribute('aria-expanded', String(open))
    this.querySelector<HTMLElement>('#sheet-details')?.toggleAttribute('hidden', !open)
  }

  #center() {
    const tile = this.querySelector(`[data-sheet="${this.#at}"]`)
    tile?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  #render() {
    const theme = this.#themes[this.#at] as Theme
    const tabs = this.#tabs.map(({ id, index }) => ({ id, theme: this.#themes[index] as Theme }))
    const changed = theme !== this.#shown
    this.#shown = theme
    if (changed) {
      settle(this)
      wear(this, theme)
    }
    this.querySelector('[data-sheet-label]')?.setAttribute('aria-label', theme.name)
    fill(
      this.querySelector('[data-heading]'),
      html(<SheetHeading themes={this.#themes} theme={theme} gate={this.#gate} />),
    )
    const list = this.querySelector('[data-tabs] [role="tablist"]')
    const focused = list?.contains(document.activeElement) ?? false
    swap(list, html(<TerminalTabs tabs={tabs} active={this.#active} />))
    if (focused) this.querySelector<HTMLElement>('[data-tabs] [aria-selected="true"]')?.focus()
    fill(this.querySelector('[data-session]'), html(<Session theme={theme} />))
    fill(this.querySelector('[data-use]'), html(<SheetUse theme={theme} />))
    fill(this.querySelector('#sheet-details'), html(<SheetDetails theme={theme} gate={this.#gate} />))
    for (const tile of this.querySelectorAll<HTMLElement>('[data-sheet]')) {
      if (Number(tile.dataset.sheet) === this.#at) tile.setAttribute('aria-current', 'true')
      else tile.removeAttribute('aria-current')
    }
    if (changed) this.#center()
  }
}

customElements.define('sheet-browser', SheetBrowser)
