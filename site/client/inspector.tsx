import { InspectorPopover } from '@/components/share-popovers'
import { html } from '@/lib/render'
import type { Named } from '@/lib/share-view'
import { contrast } from '@/lib/sheet'
import { fill, reducedMotion } from './dom'

export class Inspector {
  #host: HTMLElement
  #slots: () => Named[] | undefined
  #faint: () => string | undefined
  #hovered: HTMLElement | null = null
  #pinned: HTMLElement | null = null
  on = false

  constructor(host: HTMLElement, slots: () => Named[] | undefined, faint: () => string | undefined) {
    this.#host = host
    this.#slots = slots
    this.#faint = faint
  }

  over = (event: PointerEvent) => {
    if (!this.on || event.pointerType === 'touch') return
    const run = (event.target as Element | null)?.closest<HTMLElement>('.r')

    if (!run || run === this.#hovered) return
    this.#hovered?.removeAttribute('data-hover')
    this.#hovered = run

    if (run !== this.#pinned) run.setAttribute('data-hover', '')

    if (!this.#pinned) this.#show(run)
    this.#hint()
  }

  leave = () => {
    this.#hovered?.removeAttribute('data-hover')
    this.#hovered = null

    if (!this.#pinned) this.#hide()
    this.#hint()
  }

  get pinned(): boolean {
    return this.#pinned !== null
  }

  toggle(on: boolean) {
    this.on = on
    this.#host.querySelector('[data-inspect]')?.setAttribute('aria-pressed', String(on))
    this.#host.querySelector('[data-mock]')?.toggleAttribute('data-inspecting', on)

    if (!on) this.release()
    this.#hint()
  }

  pin(run: HTMLElement) {
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

  release() {
    this.#pinned?.removeAttribute('data-pinned')
    this.#hovered?.removeAttribute('data-hover')
    this.#pinned = null
    this.#hovered = null
    this.#hide()
    this.#hint()
  }

  refresh() {
    if (this.#pinned) this.#show(this.#pinned)
  }

  redraw() {
    const run = this.#pinned ?? this.#hovered

    if (run) this.#show(run)
  }

  #show(run: HTMLElement) {
    const slots = this.#slots()
    const term = this.#host.querySelector<HTMLElement>('[data-term]')
    const box = this.#host.querySelector<HTMLElement>('[data-inspector]')

    if (!slots || !term || !box) return
    const text = Number(run.dataset.t)
    const ground = Number(run.dataset.g)
    const faint = run.hasAttribute('data-f')
    const ink = faint ? this.#faint() : slots[text]?.hex
    const under = slots[ground]?.hex

    if (!ink || !under) return
    fill(
      box,
      html(
        <InspectorPopover
          slots={slots}
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
    const box = this.#host.querySelector<HTMLElement>('[data-inspector]')

    if (!box) return
    box.hidden = true
    box.replaceChildren()
  }

  #hint() {
    const hint = this.#host.querySelector<HTMLElement>('[data-hint]')

    if (hint) hint.hidden = !this.on || this.#pinned !== null || this.#hovered !== null
  }
}
