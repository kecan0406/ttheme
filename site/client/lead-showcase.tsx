import { LeadPreview, LeadUse } from '@/components/home'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { fadeThrough, fill, readJson, reducedMotion, swap } from './dom'
import { SparkleBurst } from './sparkle-burst'
import { choose, onWear, recall, show } from './wear'

class LeadShowcase extends HTMLElement {
  #leads: Theme[] = []
  #shown = ''
  #timer = 0
  #off = () => {}

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const step = target.closest<HTMLElement>('[data-pick]')
    const lead = target.closest<HTMLElement>('[data-lead]')
    if (step) this.#step(Number(step.dataset.pick))
    else if (lead) choose(this.#leads[Number(lead.dataset.lead)] as Theme)
  }

  connectedCallback() {
    this.#leads = readJson<Theme[]>(this, 'script[data-leads]')
    this.#shown = (this.#leads[0] as Theme).name
    this.addEventListener('click', this.#click)
    this.#off = onWear((theme) => this.#pick(theme))
    const stored = recall()
    if (stored) {
      if (stored.name !== this.#shown) this.#draw(stored)
      return
    }
    if (reducedMotion()) return
    this.#timer = window.setInterval(() => {
      if (!document.hidden) this.#cycle()
    }, 4000)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.#off()
    window.clearInterval(this.#timer)
  }

  get #at(): number {
    return this.#leads.findIndex((lead) => lead.name === this.#shown)
  }

  #step(delta: number) {
    const count = this.#leads.length
    const from = this.#at === -1 && delta < 0 ? 0 : this.#at
    choose(this.#leads[(((from + delta) % count) + count) % count] as Theme)
  }

  #cycle() {
    const next = this.#leads[(this.#at + 1) % this.#leads.length] as Theme
    fadeThrough(() => this.#draw(next))
  }

  #pick(theme: Theme) {
    window.clearInterval(this.#timer)
    if (theme.name !== this.#shown) fadeThrough(() => this.#draw(theme))
  }

  #draw(theme: Theme) {
    this.#shown = theme.name
    show(theme)
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
      button.setAttribute('aria-pressed', String(this.#leads[Number(button.dataset.lead)]?.name === theme.name))
  }
}

customElements.define('lead-showcase', LeadShowcase)
