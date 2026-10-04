import { reducedMotion } from './dom'

const FACES = ['(・ω・)', '(＾▽＾)', '( ˘ω˘ )', '(>ω<)', 'uwu', 'owo', '(｡•ᴗ•｡)']
const SLOTS = [1, 3, 5, 9, 12, 13, 14]
const WORD = 'uwu'

class KaomojiRain extends HTMLElement {
  #typed = ''

  #key = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey) return
    this.#typed = (this.#typed + event.key).slice(-WORD.length)
    if (this.#typed !== WORD || reducedMotion()) return
    this.#typed = ''
    const drops = Array.from({ length: 24 }, (_, index) => {
      const drop = document.createElement('span')
      drop.className = 'absolute -top-8 animate-rain font-display text-base font-extrabold'
      drop.textContent = FACES[index % FACES.length] as string
      drop.style.left = `${Math.random() * 96}%`
      drop.style.color = `var(--a${SLOTS[index % SLOTS.length]})`
      drop.style.animationDelay = `${index * 45}ms`
      return drop
    })
    this.firstElementChild?.append(...drops)
    window.setTimeout(() => {
      for (const drop of drops) drop.remove()
    }, 2400)
  }

  connectedCallback() {
    window.addEventListener('keydown', this.#key)
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.#key)
  }
}

customElements.define('kaomoji-rain', KaomojiRain)
