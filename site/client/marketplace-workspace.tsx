import { GatePanel, InstallPanes, PaletteFacts, ScenePanes, SlotsPanel, WorkspaceHead } from '@/components/workspace'
import { palettePath, palettesPath } from '@/lib/gallery'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { paletteMeta } from '@/lib/titles'
import { wearStyle } from '@/lib/wear'
import { nameAt, neighbors, type WorkspaceData } from '@/lib/workspace'
import { announce, fill, readJson, tally } from './dom'
import { bare, composing, letter, typing } from './keys'
import { afterPaint, palettes } from './palettes'

const STEPS = new Map([
  ['ArrowRight', 1],
  ['ArrowLeft', -1],
])

const GAP = 6

function owned(target: EventTarget | null): boolean {
  return typing(target) || (target instanceof Element && target.closest('[role="radiogroup"], [popover]') !== null)
}

function plain(event: MouseEvent): boolean {
  return event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
}

class MarketplaceWorkspace extends HTMLElement {
  #data: WorkspaceData = { where: null, gate: [], start: '', current: '' }
  #palettes: Theme[] = []
  #ready: Promise<void> | null = null
  #theme: Theme | undefined
  #query = ''
  #open = new Set<Element>()

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const pick = target.closest<HTMLAnchorElement>('a[data-pick]')

    if (pick && plain(event) && this.#palettes.length > 0) {
      event.preventDefault()
      this.#select(this.#named(pick.dataset.pick ?? ''), true)

      return
    }

    const step = target.closest<HTMLElement>('[data-step]')

    if (step) {
      this.#when(() => this.#step(Number(step.dataset.step)))

      return
    }

    const toggle = target.closest<HTMLElement>('[data-toggle]')

    if (toggle) this.#flip(toggle)
  }

  #input = (event: Event) => {
    const field = event.target as HTMLInputElement

    if (field.name !== 'query') return
    this.#query = field.value
    tally(this.#filter())
  }

  #keydown = (event: KeyboardEvent) => {
    if (letter(event, 'k') && event.metaKey !== event.ctrlKey && !event.altKey && !event.shiftKey) {
      if (event.defaultPrevented || composing(event) || typing(event.target)) return
      const field = this.querySelector<HTMLInputElement>('input[name="query"]')

      if (!field) return
      event.preventDefault()
      field.focus()
      field.select()

      return
    }

    const delta = STEPS.get(event.key)

    if (!delta || !bare(event) || event.shiftKey || event.repeat || owned(event.target)) return
    event.preventDefault()
    this.#when(() => this.#step(delta))
  }

  #popstate = () => {
    this.#when(() => this.#select(this.#named(nameAt(location.pathname) ?? this.#data.start), false))
  }

  #place = (event: Event) => {
    if ((event as ToggleEvent).newState !== 'open') return
    const panel = event.target as HTMLElement
    const trigger = this.querySelector<HTMLElement>(`[popovertarget="${panel.id}"]`)

    if (!trigger) return
    const box = trigger.getBoundingClientRect()
    panel.style.bottom = `${window.innerHeight - box.top + GAP}px`
    panel.style.right = `${Math.max(16, window.innerWidth - box.right)}px`
  }

  connectedCallback() {
    this.#data = readJson<WorkspaceData>(this, 'script[data-workspace]')

    for (const group of this.querySelectorAll('[data-group]'))
      if (group.querySelector('[data-toggle]')?.getAttribute('aria-expanded') === 'true') this.#open.add(group)
    this.addEventListener('click', this.#click)
    this.addEventListener('input', this.#input)

    for (const panel of this.querySelectorAll('[popover]')) panel.addEventListener('beforetoggle', this.#place)
    window.addEventListener('keydown', this.#keydown)
    window.addEventListener('popstate', this.#popstate)
    const query = this.querySelector<HTMLInputElement>('input[name="query"]')?.value ?? ''

    if (query) {
      this.#query = query
      this.#filter()
    }

    this.#reveal()
    afterPaint(() => void this.#load())
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('input', this.#input)

    for (const panel of this.querySelectorAll('[popover]')) panel.removeEventListener('beforetoggle', this.#place)
    window.removeEventListener('keydown', this.#keydown)
    window.removeEventListener('popstate', this.#popstate)
  }

  #load(): Promise<void> {
    this.#ready ??= palettes(palettesPath(this.#data.where?.id ?? null)).then(
      (list) => {
        this.#palettes = list
        this.#theme = this.#named(this.#data.current)
      },
      () => {
        this.#ready = null
      },
    )

    return this.#ready
  }

  #when(act: () => void) {
    if (this.#palettes.length > 0) act()
    else
      void this.#load().then(() => {
        if (this.#palettes.length > 0) act()
      })
  }

  #named(name: string): Theme {
    const { start } = this.#data

    return (
      this.#palettes.find((theme) => theme.name === name) ??
      this.#palettes.find((theme) => theme.name === start) ??
      (this.#palettes[0] as Theme)
    )
  }

  #step(delta: number) {
    if (!this.#theme) return
    const { prev, next } = neighbors(this.#theme, this.#palettes)
    this.#select(delta < 0 ? prev : next, true)
  }

  #flip(toggle: HTMLElement) {
    const group = toggle.closest('[data-group]')

    if (!group) return
    const open = toggle.getAttribute('aria-expanded') !== 'true'
    this.#show(group, open)

    if (this.#query.trim()) return

    if (open) this.#open.add(group)
    else this.#open.delete(group)
  }

  #show(group: Element, open: boolean) {
    group.querySelector('[data-toggle]')?.setAttribute('aria-expanded', String(open))
    group.querySelector('ul')?.toggleAttribute('hidden', !open)
  }

  #filter(): number {
    const query = this.#query.trim().toLowerCase()
    let shown = 0

    for (const group of this.querySelectorAll<HTMLElement>('[data-group]')) {
      const whole = query !== '' && (group.dataset.name ?? '').includes(query)
      const items = [...group.querySelectorAll<HTMLElement>('li[data-search]')]
      let matched = 0

      for (const item of items) {
        const hit = !query || whole || (item.dataset.search ?? '').includes(query)
        item.hidden = !hit

        if (hit) matched += 1
      }

      group.hidden = matched === 0
      const count = group.querySelector('[data-count]')

      if (count) count.textContent = query && !whole ? `${matched}/${items.length}` : String(items.length)
      this.#show(group, query ? matched > 0 : this.#open.has(group))
      shown += matched
    }

    this.querySelector('[data-empty]')?.toggleAttribute('hidden', shown > 0)

    return shown
  }

  #reveal() {
    const tree = this.querySelector<HTMLElement>('[data-tree]')
    const link = this.querySelector<HTMLElement>('a[data-pick][aria-current="page"]')

    if (!tree || !link || link.closest('[hidden]')) return
    const from = tree.getBoundingClientRect()
    const to = link.getBoundingClientRect()

    if (to.top >= from.top && to.bottom <= from.bottom) return
    tree.scrollTop += to.top - from.top - from.height / 3
  }

  #select(theme: Theme, push: boolean) {
    if (theme === this.#theme) return
    this.#theme = theme
    const { gate, where } = this.#data
    const palettes = this.#palettes
    this.querySelector('[data-palette-preview]')?.setAttribute('style', wearStyle(theme))
    fill(this.querySelector('[data-head]'), html(<WorkspaceHead theme={theme} />))
    fill(this.querySelector('[data-install]'), html(<InstallPanes theme={theme} where={where} />))
    fill(this.querySelector('[data-scenes]'), html(<ScenePanes theme={theme} />))
    fill(this.querySelector('[data-facts]'), html(<PaletteFacts theme={theme} palettes={palettes} gate={gate} />))
    fill(this.querySelector('[data-gate-panel]'), html(<GatePanel theme={theme} gate={gate} where={where} />))
    fill(this.querySelector('[data-slots-panel]'), html(<SlotsPanel theme={theme} />))
    const { prev, next } = neighbors(theme, palettes)
    this.querySelector('[data-step="-1"]')?.setAttribute('aria-label', `previous palette, ${prev.name}`)
    this.querySelector('[data-step="1"]')?.setAttribute('aria-label', `next palette, ${next.name}`)

    for (const link of this.querySelectorAll('a[data-pick]')) {
      if (link.getAttribute('data-pick') === theme.name) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    }

    const group = this.querySelector(`a[data-pick][aria-current="page"]`)?.closest('[data-group]')

    if (group && !this.#query.trim()) {
      this.#open.add(group)
      this.#show(group, true)
    }

    this.#reveal()
    document.title = paletteMeta(theme).title

    if (push) history.pushState(null, '', palettePath(theme))
    announce(theme.name)
  }
}

customElements.define('marketplace-workspace', MarketplaceWorkspace)
