import { nextSetting, setting, watch } from './mode'
import { choosing } from './wear'

class ModeSwitch extends HTMLElement {
  #unwatch: (() => void) | undefined

  connectedCallback() {
    this.#sync()
    this.addEventListener('click', this.#click)
    window.addEventListener('pageshow', this.#sync)
    this.#unwatch = watch(this.#sync)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    window.removeEventListener('pageshow', this.#sync)
    this.#unwatch?.()
  }

  #sync = () => {
    this.querySelector('button')?.setAttribute('title', `${setting()} · click for ${nextSetting()}`)
  }

  #click = () => {
    choosing(nextSetting())
    this.#sync()
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
