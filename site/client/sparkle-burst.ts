import { reducedMotion } from './dom'

const SVG = 'http://www.w3.org/2000/svg'
const STAR =
  'M80 0C80 0 84 60 104 76C124 92 160 80 160 80C160 80 124 84 104 104C84 124 80 160 80 160C80 160 76 124 56 104C36 84 0 80 0 80C0 80 36 76 56 56C76 36 80 0 80 0Z'
const TONES = [0, 1, 2]

export class SparkleBurst extends HTMLElement {
  burst = () => {
    if (reducedMotion()) return
    for (const tone of TONES) window.setTimeout(() => this.#spark(tone), tone * 140)
  }

  connectedCallback() {
    this.addEventListener('pointerenter', this.burst)
    this.burst()
  }

  disconnectedCallback() {
    this.removeEventListener('pointerenter', this.burst)
  }

  #spark(tone: number) {
    const size = 10 + Math.random() * 10
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('viewBox', '0 0 160 160')
    svg.setAttribute('class', 'pointer-events-none absolute animate-sparkle')
    svg.style.left = `${Math.random() * 100}%`
    svg.style.top = `${Math.random() * 90 - 20}%`
    svg.style.width = `${size}px`
    svg.style.height = `${size}px`
    const path = document.createElementNS(SVG, 'path')
    path.style.fill = `var(--sg${tone})`
    path.setAttribute('d', STAR)
    svg.append(path)
    this.append(svg)
    window.setTimeout(() => svg.remove(), 800)
  }
}

customElements.define('sparkle-burst', SparkleBurst)
