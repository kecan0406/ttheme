import type { ThemeMode } from '@/lib/theme-mode'
import { applyMode, readMode } from './theme-mode'

class ThemeToggle extends HTMLElement {
  #media = matchMedia('(prefers-color-scheme: dark)')

  #follow = () => applyMode('system')

  #change = (event: Event) => {
    const mode = (event.target as HTMLInputElement).value as ThemeMode
    applyMode(mode)
    this.#watch(mode)
  }

  connectedCallback() {
    const mode = readMode()
    const input = this.querySelector<HTMLInputElement>(`input[value="${mode}"]`)
    if (input) input.checked = true
    this.addEventListener('change', this.#change)
    this.#watch(mode)
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.#change)
    this.#media.removeEventListener('change', this.#follow)
  }

  #watch(mode: ThemeMode) {
    this.#media.removeEventListener('change', this.#follow)
    if (mode === 'system') this.#media.addEventListener('change', this.#follow)
  }
}

customElements.define('theme-toggle', ThemeToggle)
