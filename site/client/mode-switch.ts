import { settingOf } from '@/lib/mode'
import { setting } from './mode'
import { choosing } from './wear'

const root = document.documentElement

class ModeSwitch extends HTMLElement {
  connectedCallback() {
    this.#sync()
    this.addEventListener('change', this.#change)
    window.addEventListener('pageshow', this.#sync)
    window.addEventListener('storage', this.#sync)
    this.#watch.observe(root, { attributes: true, attributeFilter: ['data-setting'] })
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.#change)
    window.removeEventListener('pageshow', this.#sync)
    window.removeEventListener('storage', this.#sync)
    this.#watch.disconnect()
  }

  #sync = () => {
    const now = setting()

    for (const radio of this.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      radio.checked = radio.value === now
  }

  #watch = new MutationObserver(this.#sync)

  #change = (event: Event) => {
    const radio = event.target

    if (!(radio instanceof HTMLInputElement) || !radio.checked) return
    choosing(settingOf(radio.value))
  }
}

customElements.define('mode-switch', ModeSwitch)

function pressed() {
  for (const cell of document.querySelectorAll<HTMLElement>('[data-mode-to]'))
    cell.setAttribute('aria-pressed', String(cell.dataset.modeTo === root.dataset.mode))
}

document.addEventListener('click', (event) => {
  const cell = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mode-to]') : null

  if (cell) choosing(settingOf(cell.dataset.modeTo ?? null))
})

new MutationObserver(pressed).observe(root, { attributes: true, attributeFilter: ['data-mode'] })

pressed()
