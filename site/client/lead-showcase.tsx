import { LeadUse } from '@/components/home'
import { html } from '@/lib/render'
import type { Theme } from '@/lib/themes'
import { announce, fadeThrough, fill, readJson, reducedMotion } from './dom'
import { SparkleBurst } from './sparkle-burst'
import { choose, onWear, recall, show } from './wear'

const CYCLE_MS = 4000

const IN_VIEW = 0.25

class LeadShowcase extends HTMLElement {
  #leads: Theme[] = []
  #shown = ''
  #run: Animation | null = null
  #cycling = false
  #chosen = false
  #holds = new Set<string>()
  #view: IntersectionObserver | null = null
  #off = () => {}

  #click = (event: MouseEvent) => {
    const target = event.target as Element

    if (target.closest('[data-lead-rotate]')) {
      this.#chosen = true
      this.#turn(!this.#cycling)

      return
    }

    const step = target.closest<HTMLElement>('[data-pick]')

    if (step) this.#step(Number(step.dataset.pick))
  }

  #change = (event: Event) => {
    const input = event.target

    if (!(input instanceof HTMLInputElement) || input.name !== 'lead') return
    const lead = this.#leads.find((theme) => theme.name === input.value)

    if (lead) choose(lead)
  }

  #hidden = () => this.#hold('hidden', document.hidden)

  #enter = () => this.#hold('pointer', true)

  #leave = () => this.#hold('pointer', false)

  #focus = (event: FocusEvent) => {
    if (!this.#chosen && (event.target as Element).matches(':focus-visible')) this.#turn(false)
  }

  #keydown = (event: KeyboardEvent) => {
    if (event.repeat && (event.target as Element).matches('input[name="lead"], [data-pick]')) event.preventDefault()
  }

  get #hero(): HTMLElement | null {
    return this.querySelector('[data-lead-hero]')
  }

  get #window(): HTMLElement | null {
    return this.querySelector('[data-lead-window]')
  }

  get #line(): HTMLElement | null {
    return this.querySelector('[data-lead-progress]')
  }

  get #control(): HTMLElement | null {
    return this.querySelector('[data-lead-rotate]')
  }

  connectedCallback() {
    this.#leads = readJson<Theme[]>(this, 'script[data-leads]')
    this.#shown = (this.#leads[0] as Theme).name
    this.addEventListener('click', this.#click)
    this.addEventListener('change', this.#change)
    this.addEventListener('keydown', this.#keydown)
    this.#off = onWear((theme) => this.#pick(theme))
    const stored = recall()

    if (stored && stored.name !== this.#shown) this.#draw(stored)
    else this.#check(this.#shown)
    this.#mark(stored === null)
    delete document.documentElement.dataset.picked

    if (reducedMotion()) return
    document.addEventListener('visibilitychange', this.#hidden)
    this.#window?.addEventListener('pointerenter', this.#enter)
    this.#window?.addEventListener('pointerleave', this.#leave)
    this.#hero?.addEventListener('focusin', this.#focus)
    const hero = this.#hero

    if (hero) {
      this.#view = new IntersectionObserver(
        ([entry]) => this.#hold('away', (entry?.intersectionRatio ?? 0) < IN_VIEW),
        { threshold: IN_VIEW },
      )
      this.#view.observe(hero)
    }

    this.#hidden()
    this.#turn(stored === null)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('change', this.#change)
    this.removeEventListener('keydown', this.#keydown)
    this.#off()
    this.#cycling = false
    this.#run?.cancel()
    this.#view?.disconnect()
    this.#view = null
    document.removeEventListener('visibilitychange', this.#hidden)
    this.#window?.removeEventListener('pointerenter', this.#enter)
    this.#window?.removeEventListener('pointerleave', this.#leave)
    this.#hero?.removeEventListener('focusin', this.#focus)
  }

  get #at(): number {
    return this.#leads.findIndex((lead) => lead.name === this.#shown)
  }

  #mark(on: boolean) {
    const control = this.#control

    if (control) control.dataset.cycle = on ? 'on' : 'off'
  }

  #turn(on: boolean) {
    this.#cycling = on
    this.#mark(on)
    this.#schedule()
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

  #step(delta: number) {
    const count = this.#leads.length
    const from = this.#at === -1 && delta < 0 ? 0 : this.#at
    const theme = this.#leads[(((from + delta) % count) + count) % count] as Theme
    choose(theme)
    announce(`wearing ${theme.name}`)
  }

  #cycle() {
    const next = this.#leads[(this.#at + 1) % this.#leads.length] as Theme
    fadeThrough(() => this.#draw(next))
  }

  #pick(theme: Theme) {
    if (this.#cycling) this.#turn(false)

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
    this.#check(theme.name)
  }

  #check(name: string) {
    for (const input of this.querySelectorAll<HTMLInputElement>('input[name="lead"]'))
      input.checked = input.value === name
  }
}

customElements.define('lead-showcase', LeadShowcase)
