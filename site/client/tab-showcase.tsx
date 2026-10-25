import { FIRST_TABS, MOST_TABS, newTabLabel, TabSession, type WindowTab, WindowTabs } from '@/components/tab-window'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { announce, fill, readJson, swap } from './dom'

interface OpenTab {
  id: number
  index: number
}

class TabShowcase extends HTMLElement {
  #leads: Theme[] = []
  #tabs: OpenTab[] = Array.from({ length: FIRST_TABS }, (_, id) => ({ id, index: id }))
  #active = 0
  #next = FIRST_TABS

  #change = (event: Event) => {
    const input = event.target

    if (!(input instanceof HTMLInputElement) || input.name !== 'terminal-tab') return
    this.#active = Number(input.value)
    this.#paint()
  }

  #click = (event: MouseEvent) => {
    if ((event.target as Element).closest('[data-new-tab]')) this.#open()
  }

  connectedCallback() {
    this.#leads = readJson<Theme[]>(document.body, 'script[data-leads]')
    this.addEventListener('change', this.#change)
    this.addEventListener('click', this.#click)
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.#change)
    this.removeEventListener('click', this.#click)
  }

  get #shown(): OpenTab {
    return this.#tabs.find((tab) => tab.id === this.#active) ?? (this.#tabs[0] as OpenTab)
  }

  #after(tab: OpenTab): number {
    return (tab.index + 1) % this.#leads.length
  }

  #open() {
    const tab = { id: this.#next, index: this.#after(this.#tabs.at(-1) as OpenTab) }
    this.#next += 1
    this.#tabs = [...this.#tabs, tab].slice(-MOST_TABS)
    this.#active = tab.id
    const open: WindowTab[] = this.#tabs.map(({ id, index }) => ({ id, theme: this.#leads[index] as Theme }))
    swap(this.querySelector('[data-tab-window] [role="radiogroup"]'), html(<WindowTabs tabs={open} active={tab.id} />))
    const next = this.#leads[this.#after(tab)] as Theme
    this.querySelector('[data-new-tab]')?.setAttribute('aria-label', newTabLabel(next))
    this.#paint()
    announce(`new tab on ${(this.#leads[tab.index] as Theme).name}`)
  }

  #paint() {
    const theme = this.#leads[this.#shown.index] as Theme
    this.querySelector('[data-tab-window]')?.setAttribute('style', wearStyle(theme))
    fill(this.querySelector('[data-tab-session]'), html(<TabSession theme={theme} />))
  }
}

customElements.define('tab-showcase', TabShowcase)
