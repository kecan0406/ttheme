import { SheetDetails, SheetUse } from '@/components/sheets'
import { TerminalTabs } from '@/components/terminal-window'
import { html } from '@/lib/render'
import { sheetNumber, sheetVars } from '@/lib/sheet'
import { SHEET_AT } from '@/lib/sheet-script'
import type { GateRule, Theme } from '@/lib/themes'
import { fadeThrough, fill, readJson, reducedMotion, swap } from './dom'
import { bare, typing } from './keys'
import { tabKey } from './tabs'
import { onWear, recall, remember, show } from './wear'

interface OpenTab {
  id: number
  index: number
}

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }

function owned(target: EventTarget | null): boolean {
  return (
    typing(target) ||
    (target instanceof Element &&
      target.closest('[role="tablist"], [popover], [data-slot="scroll-area-viewport"]') !== null)
  )
}

class SheetBrowser extends HTMLElement {
  #themes: Theme[] = []
  #gate: GateRule[] = []
  #tabs: OpenTab[] = []
  #active = 0
  #next = 0
  #shown: Theme | undefined
  #off = () => {}

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
    const delta = STEPS[event.key]
    if (!delta || !bare(event) || event.shiftKey || event.repeat || owned(event.target)) return
    event.preventDefault()
    this.#step(delta)
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
    this.#off = onWear((theme) => this.#adopt(theme))
    this.#restore()
    this.#center('auto')
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('keydown', this.#keydown)
    window.removeEventListener('keydown', this.#arrows)
    this.#off()
  }

  get #at(): number {
    return (this.#tabs.find((tab) => tab.id === this.#active) ?? (this.#tabs[0] as OpenTab)).index
  }

  #restore() {
    const stored = recall()
    const index = stored ? this.#themes.findIndex((theme) => theme.name === stored.name) : -1
    if (index < 1) return
    this.#tabs = this.#tabs.map((tab) => (tab.id === this.#active ? { ...tab, index } : tab))
    this.#shown = this.#themes[index]
    this.#draw()
  }

  #adopt(theme: Theme) {
    const index = this.#themes.findIndex((entry) => entry.name === theme.name)
    if (index === -1) show(theme)
    else this.#paint(index)
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

  #center(behavior: ScrollBehavior) {
    const strip = this.querySelector('[data-strip]')
    const tile = this.querySelector(`[data-sheet="${this.#at}"]`)
    if (!strip || !tile) return
    const from = strip.getBoundingClientRect()
    const to = tile.getBoundingClientRect()
    strip.scrollBy({ left: to.left + to.width / 2 - (from.left + from.width / 2), behavior })
  }

  #render() {
    const changed = this.#themes[this.#at] !== this.#shown
    this.#shown = this.#themes[this.#at]
    remember(this.#shown as Theme)
    if (!changed) {
      this.#draw()
      return
    }
    fadeThrough(() => {
      this.#draw()
      this.#center(reducedMotion() ? 'auto' : 'smooth')
    })
  }

  #draw() {
    const theme = this.#themes[this.#at] as Theme
    const tabs = this.#tabs.map(({ id, index }) => ({ id, theme: this.#themes[index] as Theme }))
    show(theme)
    const root = document.documentElement
    for (const [name, value] of sheetVars(theme, sheetNumber(this.#themes, theme), this.#gate))
      root.style.setProperty(name, value)
    this.querySelector('[data-sheet-label]')?.setAttribute('aria-label', theme.name)
    const name = this.querySelector('[data-heading] h1 > .sr-only')
    if (name) name.textContent = theme.name
    const list = this.querySelector('[data-tabs] [role="tablist"]')
    const focused = list?.contains(document.activeElement) ?? false
    swap(list, html(<TerminalTabs tabs={tabs} active={this.#active} />))
    if (focused) this.querySelector<HTMLElement>('[data-tabs] [aria-selected="true"]')?.focus()
    fill(this.querySelector('[data-use]'), html(<SheetUse theme={theme} />))
    fill(this.querySelector('#sheet-details'), html(<SheetDetails theme={theme} gate={this.#gate} />))
    const roving = this.querySelector('[data-strip]')?.contains(document.activeElement) ?? false
    for (const tile of this.querySelectorAll<HTMLElement>('[data-sheet]')) {
      const current = Number(tile.dataset.sheet) === this.#at
      tile.tabIndex = current ? 0 : -1
      if (current) tile.setAttribute('aria-current', 'true')
      else tile.removeAttribute('aria-current')
      if (current && roving) tile.focus({ preventScroll: true })
    }
    document.getElementById(SHEET_AT)?.remove()
  }
}

customElements.define('sheet-browser', SheetBrowser)
