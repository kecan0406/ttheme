import { LeadUse } from '@/components/home'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { fadeThrough, fill, readJson, reducedMotion } from './dom'
import { SparkleBurst } from './sparkle-burst'
import { choose, onWear, recall, show } from './wear'

const CYCLE_MS = 4000

const IN_VIEW = 0.25

class LeadShowcase extends HTMLElement {
  #leads: Theme[] = []
  #shown = ''
  #run: Animation | null = null
  #cycling = false
  #holds = new Set<string>()
  #view: IntersectionObserver | null = null
  #off = () => {}

  #click = (event: MouseEvent) => {
    const target = event.target as Element
    const step = target.closest<HTMLElement>('[data-pick]')
    const lead = target.closest<HTMLElement>('[data-lead]')
    if (step) this.#step(Number(step.dataset.pick))
    else if (lead) choose(this.#leads[Number(lead.dataset.lead)] as Theme)
  }

  #hidden = () => this.#hold('hidden', document.hidden)

  #enter = () => this.#hold('pointer', true)

  #leave = () => this.#hold('pointer', false)

  #focus = () => this.#hold('focus', true)

  #blur = (event: FocusEvent) => this.#hold('focus', this.#hero?.contains(event.relatedTarget as Node | null) ?? false)

  get #hero(): HTMLElement | null {
    return this.querySelector('[data-lead-hero]')
  }

  get #window(): HTMLElement | null {
    return this.querySelector('[data-lead-window]')
  }

  get #line(): HTMLElement | null {
    return this.querySelector('[data-lead-progress]')
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
    this.#cycling = true
    document.addEventListener('visibilitychange', this.#hidden)
    this.#window?.addEventListener('pointerenter', this.#enter)
    this.#window?.addEventListener('pointerleave', this.#leave)
    this.#hero?.addEventListener('focusin', this.#focus)
    this.#hero?.addEventListener('focusout', this.#blur)
    const hero = this.#hero
    if (hero) {
      this.#view = new IntersectionObserver(
        ([entry]) => this.#hold('away', (entry?.intersectionRatio ?? 0) < IN_VIEW),
        { threshold: IN_VIEW },
      )
      this.#view.observe(hero)
    }
    this.#hidden()
    this.#schedule()
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.#off()
    this.#stop()
  }

  get #at(): number {
    return this.#leads.findIndex((lead) => lead.name === this.#shown)
  }

  #hold(reason: string, on: boolean) {
    if (on === this.#holds.has(reason)) return
    if (on) this.#holds.add(reason)
    else this.#holds.delete(reason)
    this.#schedule()
  }

  #schedule() {
    const line = this.#line
    if (!this.#cycling || this.#holds.size > 0 || !line) {
      this.#run?.pause()
      line?.style.removeProperty('opacity')
      return
    }
    this.#run?.cancel()
    line.style.opacity = '1'
    const run = line.animate({ scale: ['0 1', '1 1'] }, { duration: CYCLE_MS, easing: 'linear', fill: 'forwards' })
    this.#run = run
    run.finished.then(
      () => {
        if (this.#run !== run) return
        this.#cycle()
        this.#schedule()
      },
      () => {},
    )
  }

  #stop() {
    this.#cycling = false
    this.#run?.pause()
    this.#line?.style.removeProperty('opacity')
    this.#view?.disconnect()
    this.#view = null
    document.removeEventListener('visibilitychange', this.#hidden)
    this.#window?.removeEventListener('pointerenter', this.#enter)
    this.#window?.removeEventListener('pointerleave', this.#leave)
    this.#hero?.removeEventListener('focusin', this.#focus)
    this.#hero?.removeEventListener('focusout', this.#blur)
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
    this.#stop()
    if (theme.name !== this.#shown) fadeThrough(() => this.#draw(theme))
  }

  #draw(theme: Theme) {
    this.#shown = theme.name
    show(theme)
    const name = this.querySelector('[data-lead-name] > span')
    if (name) name.textContent = theme.name
    const sparkles = this.querySelector('sparkle-burst')
    if (sparkles instanceof SparkleBurst) sparkles.burst()
    fill(this.querySelector('[data-lead-use]'), html(<LeadUse theme={theme} />))
    for (const button of this.querySelectorAll<HTMLElement>('[data-lead]'))
      button.setAttribute('aria-pressed', String(this.#leads[Number(button.dataset.lead)]?.name === theme.name))
  }
}

customElements.define('lead-showcase', LeadShowcase)
