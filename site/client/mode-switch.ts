import { nextSetting, setting, watch } from './mode'
import { pressIn } from './ui/pressed'
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
  for (const group of document.querySelectorAll('[data-window-modes]'))
    pressIn(group, shown(group.closest<HTMLElement>('[data-mode-scope]')))
}

document.addEventListener('click', (event) => {
  const reset = event.target instanceof Element ? event.target.closest('[data-mode-reset]') : null
  const scope = reset?.closest<HTMLElement>('[data-mode-scope]')

  if (!scope) return
  delete scope.dataset.windowMode
  pressed()
})

document.addEventListener('valuechange', (event) => {
  const group = event.target

  if (!(group instanceof Element) || !group.matches('[data-window-modes]')) return
  const scope = group.closest<HTMLElement>('[data-mode-scope]')

  if (!scope) return event.preventDefault()
  scope.dataset.windowMode = event.detail.value
  pressed()
})

new MutationObserver(pressed).observe(root, { attributes: true, attributeFilter: ['data-mode'] })

pressed()
