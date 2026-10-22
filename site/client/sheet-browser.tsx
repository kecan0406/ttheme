import { SheetDetails, SheetUse, stepLabel } from '@/components/sheets'
import { TerminalTabs } from '@/components/terminal-window'
import { palettesPath } from '@/lib/gallery'
import { html } from '@/lib/render'
import { sheetNumber, sheetVars } from '@/lib/sheet'
import { SHEET_AT } from '@/lib/sheet-script'
import { type GateRule, inMode, type Theme } from '@/lib/themes'
import { fadeThrough, fill, readJson, reducedMotion, swap } from './dom'
import { bare, typing } from './keys'
import { mode } from './mode'
import { afterPaint, palettes } from './palettes'
import { tabKey } from './tabs'
import { onMode, onWear, recall, remember, show } from './wear'

interface OpenTab {
  id: number
  index: number
}

const STEPS = new Map([
  ['ArrowRight', 1],
  ['ArrowLeft', -1],
])

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
  #tabs: OpenTab[] = [0, 1, 2].map((index) => ({ id: index, index }))
  #active = 0
  #next = 3
  #shown: Theme | undefined
  #ready: Promise<void> | null = null
  #off = () => {}
  #offMode = () => {}

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const hit = (selector: string) => target.closest<HTMLElement>(selector)
    const step = hit('[data-step]')
    const tab = hit('[data-tab]')
    const scroll = hit('[data-scroll]')
    const sheet = hit('[data-sheet]')
    const details = hit('[data-details]')

    if (step) this.#when(() => this.#step(Number(step.dataset.step)))
    else if (tab) this.#when(() => this.#select(Number(tab.dataset.tab)))
    else if (hit('[data-new-tab]')) this.#when(() => this.#open())
    else if (scroll) this.#scroll(Number(scroll.dataset.scroll))
    else if (sheet) this.#when(() => this.#paint(Number(sheet.dataset.sheet)))
    else if (details) this.#details(details)
  }

  #keydown = (event: KeyboardEvent) => {
    tabKey(event, (tab) => this.#when(() => this.#select(Number(tab.dataset.tab))))
  }

  #arrows = (event: KeyboardEvent) => {
    const delta = STEPS.get(event.key)

    if (!delta || !bare(event) || event.shiftKey || event.repeat || owned(event.target)) return
    event.preventDefault()
    this.#when(() => this.#step(delta))
  }

  connectedCallback() {
    this.#gate = readJson<{ gate: GateRule[] }>(this, 'script[data-sheets]').gate
    this.addEventListener('click', this.#click)
    this.addEventListener('keydown', this.#keydown)
    window.addEventListener('keydown', this.#arrows)
    this.#off = onWear((theme) => this.#when(() => this.#adopt(theme)))
    this.#offMode = onMode(() => this.#when(() => this.#draw()))
    this.#restore()
    this.#center('auto')
    afterPaint(() => void this.#load())
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('keydown', this.#keydown)
    window.removeEventListener('keydown', this.#arrows)
    this.#off()
    this.#offMode()
  }

  get #at(): number {
    return (this.#tabs.find((tab) => tab.id === this.#active) ?? (this.#tabs[0] as OpenTab)).index
  }

  #restore() {
    const stored = recall()

    const tile = [...this.querySelectorAll<HTMLElement>('[data-sheet]')].find(
      (sheet) => sheet.querySelector('span')?.textContent === stored?.name,
    )

    const index = Number(tile?.dataset.sheet ?? 0)

    if (!stored || index < 1) return
    this.#tabs = this.#tabs.map((tab) => (tab.id === this.#active ? { ...tab, index } : tab))
    fill(this.querySelector('[data-use]'), html(<SheetUse theme={stored} />))
  }

  #load(): Promise<void> {
    this.#ready ??= palettes(palettesPath(null)).then(
      (themes) => {
        this.#themes = themes
        this.#shown = themes[this.#at]

        if (this.#at > 0) this.#draw()
      },
      () => {
        this.#ready = null
      },
    )

    return this.#ready
  }

  #when(act: () => void) {
    if (this.#themes.length > 0) act()
    else
      void this.#load().then(() => {
        if (this.#themes.length > 0) act()
      })
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

  #offset(): number {
    const strip = this.querySelector('[data-strip]')
    const tile = this.querySelector(`[data-sheet="${this.#at}"]`)

    if (!strip || !tile) return 0
    const from = strip.getBoundingClientRect()
    const to = tile.getBoundingClientRect()

    return to.left + to.width / 2 - (from.left + from.width / 2)
  }

  #center(behavior: ScrollBehavior, offset = this.#offset()) {
    if (offset !== 0) this.querySelector('[data-strip]')?.scrollBy({ left: offset, behavior })
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
      const offset = this.#offset()
      this.#draw()
      requestAnimationFrame(() => this.#center(reducedMotion() ? 'auto' : 'smooth', offset))
    })
  }

  #draw() {
    const theme = this.#themes[this.#at] as Theme
    const tabs = this.#tabs.map(({ id, index }) => ({ id, theme: this.#themes[index] as Theme }))
    show(theme)
    const root = document.documentElement

    for (const [name, value] of sheetVars(inMode(theme, mode()), sheetNumber(this.#themes, theme), this.#gate))
      root.style.setProperty(name, value)
    this.querySelector('[data-sheet-label]')?.setAttribute('aria-label', theme.name)

    for (const button of this.querySelectorAll<HTMLElement>('[data-sheet-label] [data-step]'))
      button.setAttribute('aria-label', stepLabel(this.#themes, this.#at, Number(button.dataset.step)))
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
