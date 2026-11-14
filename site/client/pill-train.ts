import { reducedMotion } from './dom'

type Point = { x: number; y: number }

type Pill = {
  node: HTMLElement
  width: number
  home: Point
  x: number
  y: number
  vx: number
  vy: number
  turn: number
  mix: number
}

const AHEAD: Point = { x: 22, y: 20 }
const GROW = 0.5
const SPACE = 5
const HALF = Math.PI / 2
const TEXT = '[data-lead-footer-body] > *, [data-lead-footer-line]'

class PillTrain extends HTMLElement {
  #footer: HTMLElement | null = null
  #pills: Pill[] = []
  #at: Point = { x: 0, y: 0 }
  #inside = false
  #frame = 0
  #last = 0

  #move = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || reducedMotion()) return
    this.#at = { x: event.clientX, y: event.clientY }

    if (event.target instanceof Element && event.target.closest(TEXT)) {
      this.#inside = false

      return
    }

    if (!this.#inside) {
      this.#inside = true
      this.#measure()
    }

    this.#run()
  }

  #leave = () => {
    this.#inside = false
  }

  #resize = () => {
    if (this.#inside || this.#frame) this.#measure()
  }

  #step = (now: number) => {
    const footer = this.#footer

    if (!footer) return
    const passed = Math.min(0.05, (now - this.#last) / 1000)
    this.#last = now
    const box = footer.getBoundingClientRect()
    const pointer = { x: this.#at.x - box.left + AHEAD.x, y: this.#at.y - box.top + AHEAD.y }
    const want = this.#inside ? 1 : 0
    let ahead: Pill | null = null
    let rest = true

    for (const [index, pill] of this.#pills.entries()) {
      const rate = this.#inside ? 14 - index * 0.5 : 5
      pill.mix += (want - pill.mix) * (1 - Math.exp(-passed * rate))
      const target = ahead ? { x: ahead.home.x + ahead.x, y: ahead.home.y + ahead.y } : pointer
      const dx = target.x - pill.home.x - pill.x
      const dy = target.y - pill.home.y - pill.y
      const far = Math.hypot(dx, dy) || 1
      const gap = ahead ? ((pill.width + ahead.width) / 2 + SPACE) * (1 + GROW * pill.mix) : 0
      const goal = { x: (pill.x + dx - (dx / far) * gap) * pill.mix, y: (pill.y + dy - (dy / far) * gap) * pill.mix }
      const stiff = pill.mix > 0.5 ? 210 : 120
      const drag = pill.mix > 0.5 ? 26 : 13
      pill.vx += ((goal.x - pill.x) * stiff - pill.vx * drag) * passed
      pill.vy += ((goal.y - pill.y) * stiff - pill.vy * drag) * passed
      pill.x += pill.vx * passed
      pill.y += pill.vy * passed
      let swing = (far > 2 ? Math.atan2(dy, dx) : pill.turn) * pill.mix - pill.turn

      while (swing > HALF) swing -= Math.PI

      while (swing < -HALF) swing += Math.PI
      pill.turn += swing * (1 - Math.exp(-passed * 16))
      rest &&=
        Math.abs(want - pill.mix) < 0.002 &&
        Math.hypot(goal.x - pill.x, goal.y - pill.y) < 0.05 &&
        Math.hypot(pill.vx, pill.vy) < 0.5
      ahead = pill
    }

    const home = rest && !this.#inside

    for (const pill of this.#pills) {
      pill.node.style.translate = home ? '' : `${pill.x.toFixed(2)}px ${pill.y.toFixed(2)}px`
      pill.node.style.rotate = home ? '' : `${pill.turn.toFixed(4)}rad`
      pill.node.style.scale = home ? '' : (1 + GROW * pill.mix).toFixed(4)

      if (home) Object.assign(pill, { x: 0, y: 0, vx: 0, vy: 0, turn: 0, mix: 0 })
    }

    this.#frame = rest ? 0 : requestAnimationFrame(this.#step)
  }

  connectedCallback() {
    this.#footer = this.closest<HTMLElement>('[data-lead-footer]')
    this.#pills = Array.from(this.querySelectorAll<HTMLElement>('i'), (node) => ({
      node,
      width: 0,
      home: { x: 0, y: 0 },
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      turn: 0,
      mix: 0,
    })).reverse()
    this.#footer?.addEventListener('pointermove', this.#move, { passive: true })
    this.#footer?.addEventListener('pointerleave', this.#leave)
    window.addEventListener('resize', this.#resize)
  }

  disconnectedCallback() {
    this.#footer?.removeEventListener('pointermove', this.#move)
    this.#footer?.removeEventListener('pointerleave', this.#leave)
    window.removeEventListener('resize', this.#resize)
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  #measure() {
    const box = this.#footer?.getBoundingClientRect()

    if (!box) return

    for (const pill of this.#pills) {
      const rect = pill.node.getBoundingClientRect()
      pill.width = pill.node.offsetWidth
      pill.home = {
        x: rect.left + rect.width / 2 - box.left - pill.x,
        y: rect.top + rect.height / 2 - box.top - pill.y,
      }
    }
  }

  #run() {
    if (this.#frame) return
    this.#last = performance.now()
    this.#frame = requestAnimationFrame(this.#step)
  }
}

customElements.define('pill-train', PillTrain)
