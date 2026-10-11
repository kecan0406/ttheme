import { ROUTE_KEY } from '@/lib/route-progress'

const LIMIT_MS = 10_000

function mark(at: number, nav: number) {
  try {
    sessionStorage.setItem(ROUTE_KEY, JSON.stringify({ at, nav }))
  } catch {}
}

function unmark() {
  try {
    sessionStorage.removeItem(ROUTE_KEY)
  } catch {}
}

class RouteProgress extends HTMLElement {
  #origin = 0
  #turn = 0
  #limit = 0

  connectedCallback() {
    if (!('navigation' in window)) return
    window.navigation.addEventListener('navigate', this.#navigate)
    window.addEventListener('pageshow', this.#restored)
    this.addEventListener('animationend', this.#ended)
    if (!('arriving' in document.documentElement.dataset)) return
    const out = this.getAnimations().find(
      (animation) => animation instanceof CSSAnimation && animation.animationName === 'route-out',
    )
    if (out?.playState !== 'running') this.#idle()
  }

  disconnectedCallback() {
    if (!('navigation' in window)) return
    window.navigation.removeEventListener('navigate', this.#navigate)
    window.removeEventListener('pageshow', this.#restored)
    this.removeEventListener('animationend', this.#ended)
    clearTimeout(this.#limit)
  }

  #navigate = (event: NavigateEvent) => {
    const { destination } = event
    if (destination.sameDocument || event.downloadRequest !== null) return
    if (new URL(destination.url).origin !== location.origin) return
    const turn = ++this.#turn
    const now = Date.now()
    if (!this.dataset.state) this.#origin = now
    delete document.documentElement.dataset.arriving
    this.dataset.state = 'going'
    mark(this.#origin, now)
    clearTimeout(this.#limit)
    this.#limit = setTimeout(() => this.#end(turn, 'done'), LIMIT_MS)
    event.signal.addEventListener('abort', () => setTimeout(() => this.#end(turn, 'stopped')), { once: true })
  }

  #end(turn: number, state: 'stopped' | 'done') {
    if (turn !== this.#turn) return
    this.#turn++
    clearTimeout(this.#limit)
    unmark()
    this.dataset.state = state
  }

  #idle() {
    delete this.dataset.state
    delete document.documentElement.dataset.arriving
  }

  #ended = (event: AnimationEvent) => {
    if (event.animationName === 'route-out') this.#idle()
  }

  #restored = (event: PageTransitionEvent) => {
    if (!event.persisted) return
    this.#turn++
    clearTimeout(this.#limit)
    unmark()
    this.#idle()
  }
}

customElements.define('route-progress', RouteProgress)
