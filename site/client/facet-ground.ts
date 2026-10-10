import type { Theme } from '@/lib/themes'
import { SHOW_EVENT } from '@/lib/wear'
import { current } from './wear'

const SLOTS = ['bg', 'fg', 'sg0', 'sg1', 'sg2']
const PRESS_MS = 1000
const STAGE = '[data-lead-preview], sheet-browser [data-session]'

class FacetGround extends HTMLElement {
  #lamp: HTMLElement | null = null
  #press: { x: number; y: number; at: number } | null = null

  connectedCallback() {
    window.addEventListener('pointermove', this.#move, { passive: true })
    window.addEventListener('pointerdown', this.#down, { capture: true, passive: true })
    document.addEventListener(SHOW_EVENT, this.#show)
  }

  disconnectedCallback() {
    window.removeEventListener('pointermove', this.#move)
    window.removeEventListener('pointerdown', this.#down, { capture: true })
    document.removeEventListener(SHOW_EVENT, this.#show)
  }

  #move = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const lamp = this.#lamp ?? this.#light()
    lamp?.style.setProperty('--lamp-x', `${event.clientX}px`)
    lamp?.style.setProperty('--lamp-y', `${event.clientY}px`)
  }

  #light(): HTMLElement | null {
    const lamp = this.querySelector<HTMLElement>('.lamp')
    const mesh = this.querySelector('#facet-mesh')?.cloneNode(true)
    if (!lamp || !(mesh instanceof SVGGElement)) return null
    mesh.removeAttribute('id')
    lamp.querySelector('svg')?.append(mesh)
    this.dataset.lit = ''
    this.#lamp = lamp
    return lamp
  }

  #down = (event: PointerEvent) => {
    this.#press = { x: event.clientX, y: event.clientY, at: performance.now() }
  }

  #show = (event: Event) => {
    const svg = this.querySelector('svg')
    const box = svg?.getBoundingClientRect()
    if (!svg || !box?.width || (event as CustomEvent<Theme>).detail.name === current()) return
    const root = getComputedStyle(document.documentElement)
    for (const slot of SLOTS) this.style.setProperty(`--was-${slot}`, root.getPropertyValue(`--${slot}`).trim())
    const origin = this.#origin()
    const view = svg.viewBox.baseVal
    this.style.setProperty('--ox', (((origin.x - box.left) / box.width) * view.width).toFixed(1))
    this.style.setProperty('--oy', (((origin.y - box.top) / box.height) * view.height).toFixed(1))
    this.dataset.turn = this.dataset.turn === 'a' ? 'b' : 'a'
  }

  #origin(): { x: number; y: number } {
    const press = this.#press
    if (press && performance.now() - press.at < PRESS_MS) return press
    const stage = document.querySelector(STAGE)?.getBoundingClientRect()
    if (stage && stage.bottom > 0 && stage.top < window.innerHeight)
      return { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
}

customElements.define('facet-ground', FacetGround)
