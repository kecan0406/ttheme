import { PictureRows } from '@/components/picture-list'
import { InspectorPopover, SlotPopover } from '@/components/share-popovers'
import { html } from '@/lib/render'
import { FORMATS, type Picture, type ShareView, type SlotFormat } from '@/lib/share-view'
import { contrast } from '@/lib/sheet'
import { fill, readJson, reducedMotion } from './dom'
import { tabKey } from './tabs'

class ShareSheet extends HTMLElement {
  #view: ShareView | undefined
  #open: number | null = null
  #format: SlotFormat = 'hex'
  #where = true
  #inspecting = false
  #hovered: HTMLElement | null = null
  #pinned: HTMLElement | null = null
  #watch: ResizeObserver | undefined

  #click = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (!target) return
    const panel = target.closest<HTMLElement>('[data-panel]')?.dataset.panel
    if (panel) return this.#showPanel(panel)
    const pane = target.closest<HTMLElement>('[data-pane]')?.dataset.pane
    if (pane) return this.#showPane(pane)
    if (target.closest('[data-inspect]')) return this.#inspect(!this.#inspecting)
    if (target.closest('[data-slot-close]')) return this.#close(true)
    if (target.closest('[data-where]')) return this.#setWhere(!this.#where)
    if (target.closest('[data-gate-jump]')) return this.#toGate()
    const opener = target.closest<HTMLElement>('[data-slot-open]')
    if (opener) return this.#choose(Number(opener.dataset.slotOpen), opener)
    const run = target.closest<HTMLElement>('[data-mock] .r')
    if (run && this.#inspecting) return this.#pin(run)
    if (this.#open !== null && !target.closest('[data-slot-popover]')) this.#close(false)
  }

  #key = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.#open !== null) {
      event.preventDefault()
      this.#close(true)
      return
    }
    if (event.key === 'Escape' && this.#pinned) {
      event.preventDefault()
      this.#release()
      return
    }
    tabKey(event, (tab) => {
      tab.focus()
      tab.click()
    })
  }

  #change = (event: Event) => {
    const input = event.target as HTMLInputElement
    const format = FORMATS.find((name) => name === input.value)
    if (input.name !== 'slot-format' || !format || this.#open === null) return
    this.#format = format
    const value = this.#view?.slots[this.#open]?.formats[format] ?? ''
    const code = this.querySelector('[data-slot-popover] [data-value]')
    const copy = this.querySelector<HTMLElement>('[data-slot-popover] [data-copy]')
    if (code) code.textContent = value
    if (copy) copy.dataset.copy = value
  }

  #toggle = (event: Event) => {
    const group = event.target
    if (!(group instanceof HTMLDetailsElement) || this.#open === null) return
    const row = this.querySelector(`[data-row="${this.#open}"]`)
    if (!group.open && row && group.contains(row)) this.#close(false)
    else this.#place()
  }

  #placeAdd = (event: Event) => {
    const pop = event.target as HTMLElement
    const button = this.querySelector('[data-add]')
    if ((event as ToggleEvent).newState !== 'open' || !button) return
    const spot = button.getBoundingClientRect()
    pop.style.top = `${spot.bottom + 8}px`
    pop.style.right = `${Math.max(16, window.innerWidth - spot.right)}px`
  }

  #over = (event: PointerEvent) => {
    if (!this.#inspecting || event.pointerType === 'touch') return
    const run = (event.target as Element | null)?.closest<HTMLElement>('.r')
    if (!run || run === this.#hovered) return
    this.#hovered?.removeAttribute('data-hover')
    this.#hovered = run
    if (run !== this.#pinned) run.setAttribute('data-hover', '')
    if (!this.#pinned) this.#show(run)
    this.#hint()
  }

  #leave = () => {
    this.#hovered?.removeAttribute('data-hover')
    this.#hovered = null
    if (!this.#pinned) this.#hide()
    this.#hint()
  }

  connectedCallback() {
    this.#view = readJson<ShareView>(this, 'script[data-share]')
    this.addEventListener('click', this.#click)
    this.addEventListener('keydown', this.#key)
    this.addEventListener('change', this.#change)
    this.addEventListener('toggle', this.#toggle, true)
    this.querySelector('#share-add')?.addEventListener('beforetoggle', this.#placeAdd)
    const term = this.querySelector<HTMLElement>('[data-term]')
    if (term) {
      term.addEventListener('pointerover', this.#over)
      term.addEventListener('pointerleave', this.#leave)
      this.#watch = new ResizeObserver(() => {
        this.#tail()
        if (this.#pinned) this.#show(this.#pinned)
      })
      this.#watch.observe(term)
    }
    this.#tail()
    void this.#credits()
  }

  async #credits() {
    const list = this.querySelector('[data-pictures]')
    if (!list) return
    try {
      const response = await fetch(`${location.pathname.replace(/\/$/, '')}/credits.json`)
      if (!response.ok) return
      fill(list, html(<PictureRows pictures={(await response.json()) as Picture[]} />))
    } catch {}
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('keydown', this.#key)
    this.removeEventListener('change', this.#change)
    this.removeEventListener('toggle', this.#toggle, true)
    this.#watch?.disconnect()
  }

  #showPanel(name: string) {
    for (const tab of this.querySelectorAll<HTMLElement>('[data-panel]')) {
      const on = tab.dataset.panel === name
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
    }
    for (const body of this.querySelectorAll<HTMLElement>('[data-panel-body]')) {
      body.hidden = body.dataset.panelBody !== name
    }
    if (name !== 'colors') this.#close(false)
  }

  #showPane(name: string) {
    for (const tab of this.querySelectorAll<HTMLElement>('[data-pane]')) {
      const on = tab.dataset.pane === name
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
    }
    for (const panel of this.querySelectorAll<HTMLElement>('[data-pane-panel]')) {
      panel.hidden = panel.dataset.panePanel !== name
    }
    this.#release()
    this.#tail()
  }

  #tail() {
    for (const body of this.querySelectorAll<HTMLElement>('[data-tail]')) body.scrollTop = body.scrollHeight
  }

  #choose(slot: number, opener: HTMLElement) {
    if (this.#open === slot && !opener.closest('[data-inspector]')) return this.#close(true)
    this.#openSlot(slot)
  }

  #openSlot(slot: number) {
    const view = this.#view
    const row = this.querySelector<HTMLElement>(`[data-row="${slot}"]`)
    const box = this.querySelector<HTMLElement>('[data-slot-popover]')
    if (!view || !row || !box) return
    this.#showPanel('colors')
    const group = row.closest('details')
    if (group && !group.open) group.open = true
    for (const lit of this.querySelectorAll<HTMLElement>('[data-row][data-open]')) delete lit.dataset.open
    row.dataset.open = ''
    this.#open = slot
    fill(box, html(<SlotPopover view={view} slot={slot} format={this.#format} where={this.#where} />))
    box.hidden = false
    this.#place()
    box.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
    this.#light()
  }

  #place() {
    const box = this.querySelector<HTMLElement>('[data-slot-popover]')
    const row = this.#open === null ? null : this.querySelector<HTMLElement>(`[data-row="${this.#open}"]`)
    if (!box || !row) return
    const anchor = row.closest<HTMLElement>('[data-pair]') ?? row
    box.style.top = `${anchor.offsetTop + anchor.offsetHeight + 4}px`
  }

  #close(refocus: boolean) {
    const slot = this.#open
    if (slot === null) return
    this.#open = null
    const box = this.querySelector<HTMLElement>('[data-slot-popover]')
    if (box) {
      box.hidden = true
      box.replaceChildren()
    }
    for (const lit of this.querySelectorAll<HTMLElement>('[data-row][data-open]')) delete lit.dataset.open
    this.#light()
    if (refocus) this.querySelector<HTMLElement>(`[data-slot-open="${slot}"]`)?.focus()
  }

  #setWhere(on: boolean) {
    this.#where = on
    this.querySelector('[data-slot-popover] [data-where]')?.setAttribute('aria-pressed', String(on))
    this.#light()
  }

  #light() {
    const mock = this.querySelector<HTMLElement>('[data-mock]')
    if (!mock) return
    const slot = this.#where && this.#open !== null ? String(this.#open) : null
    for (const run of mock.querySelectorAll<HTMLElement>('.r')) {
      run.toggleAttribute('data-lit', slot !== null && (run.dataset.t === slot || run.dataset.g === slot))
    }
    mock.toggleAttribute('data-where', slot !== null)
  }

  #toGate() {
    this.#showPanel('colors')
    const gate = this.querySelector<HTMLDetailsElement>('#share-gate')
    if (!gate) return
    gate.open = true
    gate.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  #inspect(on: boolean) {
    this.#inspecting = on
    this.querySelector('[data-inspect]')?.setAttribute('aria-pressed', String(on))
    this.querySelector('[data-mock]')?.toggleAttribute('data-inspecting', on)
    if (!on) this.#release()
    this.#hint()
  }

  #pin(run: HTMLElement) {
    const was = this.#pinned
    was?.removeAttribute('data-pinned')
    this.#pinned = was === run ? null : run
    if (this.#pinned) {
      run.removeAttribute('data-hover')
      run.setAttribute('data-pinned', '')
      this.#show(run)
    } else if (this.#hovered === run) {
      run.setAttribute('data-hover', '')
      this.#show(run)
    } else {
      this.#hide()
    }
    this.#hint()
  }

  #release() {
    this.#pinned?.removeAttribute('data-pinned')
    this.#hovered?.removeAttribute('data-hover')
    this.#pinned = null
    this.#hovered = null
    this.#hide()
    this.#hint()
  }

  #show(run: HTMLElement) {
    const view = this.#view
    const term = this.querySelector<HTMLElement>('[data-term]')
    const box = this.querySelector<HTMLElement>('[data-inspector]')
    if (!view || !term || !box) return
    const text = Number(run.dataset.t)
    const ground = Number(run.dataset.g)
    const faint = run.hasAttribute('data-f')
    const ink = faint ? view.faint : view.slots[text]?.hex
    const under = view.slots[ground]?.hex
    if (!ink || !under) return
    fill(
      box,
      html(
        <InspectorPopover
          view={view}
          text={text}
          ground={ground}
          tag={faint ? 'faint' : run.classList.contains('font-bold') ? 'bold' : ''}
          ratio={`${contrast(ink, under).toFixed(2)}:1`}
          snippet={run.textContent?.trim().slice(0, 24) || '·'}
        />,
      ),
    )
    const appearing = box.hidden
    box.hidden = false
    const card = box.firstElementChild as HTMLElement | null
    if (!card) return
    const area = term.getBoundingClientRect()
    const spot = run.getBoundingClientRect()
    const left = Math.min(spot.left - area.left, term.clientWidth - card.offsetWidth - 8) + term.scrollLeft
    const below = spot.bottom - area.top + term.scrollTop + 6
    const above = spot.top - area.top + term.scrollTop - card.offsetHeight - 6
    const fits = spot.bottom + 6 + card.offsetHeight <= area.bottom
    box.style.left = `${Math.max(8 + term.scrollLeft, left)}px`
    box.style.top = `${fits || above < term.scrollTop ? below : above}px`
    if (appearing && !reducedMotion()) {
      box.animate(
        [
          { opacity: 0, transform: 'translateY(4px)' },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration: 180,
          easing: 'ease-out',
        },
      )
    }
  }

  #hide() {
    const box = this.querySelector<HTMLElement>('[data-inspector]')
    if (!box) return
    box.hidden = true
    box.replaceChildren()
  }

  #hint() {
    const hint = this.querySelector<HTMLElement>('[data-hint]')
    if (hint) hint.hidden = !this.#inspecting || this.#pinned !== null || this.#hovered !== null
  }
}

customElements.define('share-sheet', ShareSheet)
