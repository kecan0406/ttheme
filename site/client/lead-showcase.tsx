import { LeadPreview, LeadUse } from '@/components/home'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { fadeThrough, fill, readJson, reducedMotion, settle, swap, wear } from './dom'
import { SparkleBurst } from './sparkle-burst'

class LeadShowcase extends HTMLElement {
  #leads: Theme[] = []
  #at = 0
  #timer = 0

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const step = target.closest<HTMLElement>('[data-pick]')
    const lead = target.closest<HTMLElement>('[data-lead]')
    if (step) this.#pick(this.#at + Number(step.dataset.pick))
    else if (lead) this.#pick(Number(lead.dataset.lead))
  }

  connectedCallback() {
    this.#leads = readJson<Theme[]>(this, 'script[data-leads]')
    this.addEventListener('click', this.#click)
    if (reducedMotion()) return
    this.#timer = window.setInterval(() => {
      if (!document.hidden) this.#show(this.#at + 1)
    }, 4000)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    window.clearInterval(this.#timer)
  }

  #pick(index: number) {
    window.clearInterval(this.#timer)
    this.#show(index)
  }

  #show(index: number) {
    const count = this.#leads.length
    const at = ((index % count) + count) % count
    if (at === this.#at || !this.#leads[at]) return
    this.#at = at
    fadeThrough(() => this.#draw())
  }

  #draw() {
    const at = this.#at
    const theme = this.#leads[at] as Theme
    settle(this)
    wear(this, theme)
    const name = this.querySelector('[data-lead-name]')
    if (name) name.textContent = theme.name
    const title = this.querySelector('[data-lead-title]')
    if (title) title.textContent = `ttheme · ${theme.name} · ${theme.catalog ?? ''}`
    const sparkles = this.querySelector('sparkle-burst')
    if (sparkles instanceof SparkleBurst) {
      sparkles.dataset.colors = JSON.stringify(theme.signature)
      sparkles.burst()
    }
    swap(this.querySelector('[data-lead-preview]'), html(<LeadPreview theme={theme} />))
    fill(this.querySelector('[data-lead-use]'), html(<LeadUse theme={theme} />))
    for (const button of this.querySelectorAll<HTMLElement>('[data-lead]'))
      button.setAttribute('aria-pressed', String(Number(button.dataset.lead) === at))
  }
}

customElements.define('lead-showcase', LeadShowcase)
