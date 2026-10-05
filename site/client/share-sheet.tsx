import { type Scene, SceneLines } from '@/components/terminal-preview'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { fill, readJson } from './dom'

class ShareSheet extends HTMLElement {
  #theme: Theme | undefined

  #change = (event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.name !== 'scene' || !this.#theme) return
    fill(
      this.querySelector('[data-slot="terminal-preview"]'),
      html(<SceneLines theme={this.#theme} scene={input.value as Scene} />),
    )
  }

  connectedCallback() {
    this.#theme = readJson<Theme>(this, 'script[data-share]')
    this.addEventListener('change', this.#change)
  }
}

customElements.define('share-sheet', ShareSheet)
