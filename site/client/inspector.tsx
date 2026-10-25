import { InspectorPopover } from '@/components/inspector-popover'
import { contrast } from '@/lib/gate'
import { html } from '@/lib/render'
import type { Named } from '@/lib/view-types'
import { fill, reducedMotion } from './dom'

const WAIT = 300

const WARM = 300

const GAP = 8

export class Inspector {
  #host: HTMLElement
  #slots: () => Named[] | undefined
  #faint: () => string | undefined
  #hovered: HTMLElement | null = null
  #pinned: HTMLElement | null = null
  #timer = 0
  #warm = 0

  constructor(host: HTMLElement, slots: () => Named[] | undefined, faint: () => string | undefined) {
    this.#host = host
    this.#slots = slots
    this.#faint = faint
  }

  over = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const run = (event.target as Element | null)?.closest<HTMLElement>('.r')

    if (run === this.#hovered) return

    if (!run || run.hasAttribute('data-blank')) return this.#away()
    this.#hovered?.removeAttribute('data-hover')
    this.#hovered = run

    if (run !== this.#pinned) run.setAttribute('data-hover', '')

    if (this.#pinned) return
    window.clearTimeout(this.#timer)

    if (this.#showing() || performance.now() < this.#warm) {
      this.#show(run)

      return
    }

    this.#timer = window.setTimeout(() => {
      if (this.#hovered === run && !this.#pinned) this.#show(run)
    }, WAIT)
  }

  leave = () => this.#away()

  get pinned(): boolean {
    return this.#pinned !== null
  }

  pin(run: HTMLElement) {
    if (run.hasAttribute('data-blank')) return this.release()
    window.clearTimeout(this.#timer)
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
  }

  release() {
    window.clearTimeout(this.#timer)
    this.#pinned?.removeAttribute('data-pinned')
    this.#hovered?.removeAttribute('data-hover')
    this.#pinned = null
    this.#hovered = null
    this.#hide()
  }

  redraw() {
    const run = this.#pinned ?? (this.#showing() ? this.#hovered : null)

    if (run) this.#show(run)
  }

  #away() {
    window.clearTimeout(this.#timer)
    this.#hovered?.removeAttribute('data-hover')
    this.#hovered = null

    if (!this.#pinned && this.#showing()) {
      this.#warm = performance.now() + WARM
      this.#hide()
    }
  }

  #box(): HTMLElement | null {
    return this.#host.querySelector<HTMLElement>('[data-inspector]')
  }

  #showing(): boolean {
    const box = this.#box()

    return box !== null && !box.hidden
  }

  #show(run: HTMLElement) {
    const slots = this.#slots()
    const term = this.#host.querySelector<HTMLElement>('[data-term]')
    const box = this.#box()

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
          ratio={contrast(ink, under)}
          snippet={run.textContent?.trim().slice(0, 24) || '·'}
        />,
      ),
    )
    const appearing = box.hidden
    box.hidden = false
    box.toggleAttribute('data-pinned', this.#pinned !== null)
    const card = box.firstElementChild as HTMLElement | null

    if (!card) return
    const area = term.getBoundingClientRect()
    const spot = run.getBoundingClientRect()
    const width = card.offsetWidth
    const height = card.offsetHeight
    const above = spot.top - area.top - height - GAP >= 4
    const left = Math.max(8, Math.min(spot.left - area.left, term.clientWidth - width - 8))
    const point = spot.left - area.left + Math.min(spot.width / 2, 16) - left
    box.dataset.side = above ? 'above' : 'below'
    box.style.left = `${left + term.scrollLeft}px`
    box.style.top = `${(above ? spot.top - area.top - height - GAP : spot.bottom - area.top + GAP) + term.scrollTop}px`
    box.style.setProperty('--arrow-x', `${Math.max(14, Math.min(point, width - 14))}px`)

    if (appearing && !reducedMotion()) {
      box.animate(
        [
          { opacity: 0, transform: `translateY(${above ? 4 : -4}px)` },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration: 160,
          easing: 'ease-out',
        },
      )
    }
  }

  #hide() {
    const box = this.#box()

    if (!box) return
    box.hidden = true
    box.removeAttribute('data-pinned')
    box.replaceChildren()
  }
}
