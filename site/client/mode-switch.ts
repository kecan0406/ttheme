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

const root = document.documentElement

function shown(scope: HTMLElement | null | undefined): string | undefined {
  return scope?.dataset.windowMode ?? root.dataset.mode
}

function pressed() {
  for (const cell of document.querySelectorAll<HTMLElement>('[data-mode-to]'))
    cell.setAttribute(
      'aria-pressed',
      String(cell.dataset.modeTo === shown(cell.closest<HTMLElement>('[data-mode-scope]'))),
    )
}

document.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mode-to], [data-mode-reset]') : null

  const scope = button?.closest<HTMLElement>('[data-mode-scope]')

  if (!button || !scope) return
  const next = button.dataset.modeTo

  if (next === undefined) delete scope.dataset.windowMode
  else if (next !== shown(scope)) scope.dataset.windowMode = next

  pressed()
})

new MutationObserver(pressed).observe(root, { attributes: true, attributeFilter: ['data-mode'] })

pressed()
