import { settingOf } from '@/lib/mode'
import { setting } from './mode'
import { choosing } from './wear'

class ModeSwitch extends HTMLElement {
  connectedCallback() {
    this.#sync()
    this.addEventListener('change', this.#change)
    window.addEventListener('pageshow', this.#sync)
    window.addEventListener('storage', this.#sync)
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.#change)
    window.removeEventListener('pageshow', this.#sync)
    window.removeEventListener('storage', this.#sync)
  }

  #sync = () => {
    const now = setting()

    for (const radio of this.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      radio.checked = radio.value === now
  }

  #change = (event: Event) => {
    const radio = event.target

    if (!(radio instanceof HTMLInputElement) || !radio.checked) return
    choosing(settingOf(radio.value))
  }
}

customElements.define('mode-switch', ModeSwitch)
