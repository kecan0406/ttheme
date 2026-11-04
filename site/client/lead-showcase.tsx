import { LeadUse } from '@/components/home'
import { isCast, OTHER_ART } from '@/lib/lead-cast'
import { html } from '@/lib/render'
import { inMode, type Theme } from '@/lib/themes'
import { announce, fadeThrough, fill, readJson, reducedMotion } from './dom'
import { mode } from './mode'
import { searchIndex } from './search-index'
import { SparkleBurst } from './sparkle-burst'
import { choose, onMode, onWear, recall, show } from './wear'

const CYCLE_MS = 7000

const IN_VIEW = 0.25

const WIDE = '(min-width: 1180px)'

const PICKS = 'input[name="lead-tab"], input[name="lead-pill"]'

const PHOTO_SIZES = '(min-width: 1180px) 50vw, 86vw'

function wake(sticker: HTMLImageElement) {
  const { src, srcset } = sticker.dataset

  if (!src || !srcset) return
  delete sticker.dataset.src
  delete sticker.dataset.srcset
  sticker.srcset = srcset
  sticker.src = src
}

class LeadShowcase extends HTMLElement {
  #leads: Theme[] = []
  #worn: Theme | null = null
  #run: Animation | null = null
  #cycling = false
  #holds = new Set<string>()
  #view: IntersectionObserver | null = null
  #wide: MediaQueryList | null = null
  #photoTurn = 0
  #stickerTurn = 0
  #pointer: [number, number] = [0, 0]
  #frame = 0
  #off = () => {}
  #offMode = () => {}

  #click = (event: MouseEvent) => {
    const input = (event.target as Element).closest<HTMLInputElement>(PICKS)

    if (!input) return
    const theme = this.#leads.find((lead) => lead.name === input.value)

    if (!theme) return
    choose(theme)
    announce(`wearing ${theme.name}`)
  }

  #hidden = () => this.#hold('hidden', document.hidden)

  #enter = () => {
    this.#hold('pointer', true)

    for (const sticker of this.#stickers) wake(sticker)
  }

  #leave = () => this.#hold('pointer', false)

  #creditEnter = () => this.#hold('credit', true)

  #creditLeave = () => this.#hold('credit', false)

  #stacked = () => this.#hold('stacked', !this.#wide?.matches)

  #focus = (event: FocusEvent) => {
    if ((event.target as Element).matches(':focus-visible')) this.#turn(false)
  }

  #point = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || this.#holds.has('away')) return
    this.#pointer = [event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5]

    if (this.#frame) return
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0
      this.#lean(this.#pointer)
    })
  }

  #unpoint = () => {
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
    this.#lean([0, 0])
  }

  #wiped = () => {
    const solid = this.#solid
    const world = this.#world

    if (solid) delete solid.dataset.turn
    world?.style.removeProperty('--lead-was')
    world?.style.removeProperty('--lead-field')
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

  get #world(): HTMLElement | null {
    return this.querySelector('[data-lead-world]')
  }

  get #solid(): HTMLElement | null {
    return this.querySelector('[data-lead-solid]')
  }

  get #photo(): HTMLElement | null {
    return this.querySelector('[data-lead-photo]')
  }

  get #stickers(): HTMLImageElement[] {
    return [...this.querySelectorAll<HTMLImageElement>('[data-lead-sticker]')]
  }

  get #credits(): HTMLElement | null {
    return this.querySelector('[data-lead-credits]')
  }

  connectedCallback() {
    this.#leads = readJson<Theme[]>(this, 'script[data-leads]')
    this.#worn = this.#leads[0] ?? null
    this.addEventListener('click', this.#click)
    this.#solid?.addEventListener('animationend', this.#wiped)
    this.#off = onWear((theme) => this.#pick(theme))
    this.#offMode = onMode(() => this.#remode())
    const stored = recall()

    if (stored && stored.name !== this.#worn?.name) this.#draw(stored, true)
    delete document.documentElement.dataset.picked
    const hero = this.#hero

    if (hero) {
      this.#view = new IntersectionObserver(([entry]) => this.#away((entry?.intersectionRatio ?? 0) < IN_VIEW), {
        threshold: IN_VIEW,
      })
      this.#view.observe(hero)
    }

    if (reducedMotion()) return
    this.addEventListener('pointermove', this.#point)
    this.addEventListener('pointerleave', this.#unpoint)
    document.addEventListener('visibilitychange', this.#hidden)
    this.#window?.addEventListener('pointerenter', this.#enter)
    this.#window?.addEventListener('pointerleave', this.#leave)
    this.#hero?.addEventListener('focusin', this.#focus)
    this.#credits?.addEventListener('pointerenter', this.#creditEnter)
    this.#credits?.addEventListener('pointerleave', this.#creditLeave)
    this.#credits?.addEventListener('focusin', this.#focus)
    this.#wide = matchMedia(WIDE)
    this.#wide.addEventListener('change', this.#stacked)
    this.#hidden()
    this.#stacked()
    this.#turn(stored === null)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('pointermove', this.#point)
    this.removeEventListener('pointerleave', this.#unpoint)
    this.#solid?.removeEventListener('animationend', this.#wiped)
    this.#off()
    this.#offMode()
    this.#cycling = false
    this.#run?.cancel()
    this.#view?.disconnect()
    this.#view = null
    this.#wide?.removeEventListener('change', this.#stacked)
    cancelAnimationFrame(this.#frame)
    document.removeEventListener('visibilitychange', this.#hidden)
    this.#window?.removeEventListener('pointerenter', this.#enter)
    this.#window?.removeEventListener('pointerleave', this.#leave)
    this.#hero?.removeEventListener('focusin', this.#focus)
    this.#credits?.removeEventListener('pointerenter', this.#creditEnter)
    this.#credits?.removeEventListener('pointerleave', this.#creditLeave)
    this.#credits?.removeEventListener('focusin', this.#focus)
  }

  get #at(): number {
    return this.#leads.findIndex((lead) => lead.name === this.#worn?.name)
  }

  #lean([x, y]: [number, number]) {
    const world = this.#world

    world?.style.setProperty('--px', x.toFixed(3))
    world?.style.setProperty('--py', y.toFixed(3))
  }

  #turn(on: boolean) {
    this.#cycling = on
    this.#schedule()
  }

  #hold(reason: string, on: boolean) {
    if (on === this.#holds.has(reason)) return

    if (on) this.#holds.add(reason)
    else this.#holds.delete(reason)
    this.#schedule()
  }

  #away(away: boolean) {
    this.#hold('away', away)
    const credits = this.#credits

    if (credits) credits.inert = away
  }

  #credit(name: string | null) {
    for (const row of this.querySelectorAll<HTMLElement>('[data-lead-credit]')) {
      row.dataset.on = String(row.dataset.leadCredit === name)
    }
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
    const coming = this.#leads[(this.#at + 1) % this.#leads.length]
    const sticker = this.#stickers.find((one) => one.dataset.leadSticker === coming?.name)

    if (sticker) wake(sticker)
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

  #cycle() {
    const next = this.#leads[(this.#at + 1) % this.#leads.length] as Theme

    fadeThrough(() => this.#draw(next))
  }

  #remode() {
    const theme = this.#worn ?? recall()

    if (theme) show(theme)
  }

  #pick(theme: Theme) {
    if (this.#cycling) this.#turn(false)

    if (theme.name !== this.#worn?.name) fadeThrough(() => this.#draw(theme))
  }

  #wipe(from: Theme, to: Theme) {
    const world = this.#world
    const solid = this.#solid

    if (!world || !solid || reducedMotion()) return
    const shade = mode()

    world.style.setProperty('--lead-was', inMode(from, shade).cursor)
    world.style.setProperty('--lead-field', inMode(to, shade).cursor)
    solid.dataset.turn = solid.dataset.turn === 'a' ? 'b' : 'a'
  }

  #dress(theme: Theme, still: boolean) {
    for (const input of this.querySelectorAll<HTMLInputElement>(PICKS)) input.checked = input.value === theme.name

    const stickers = this.#stickers
    const shown = stickers.find((sticker) => sticker.dataset.leadSticker === theme.name)
    const turn = ++this.#stickerTurn

    const wear = () => {
      if (turn !== this.#stickerTurn) return

      for (const sticker of stickers) sticker.dataset.on = String(sticker === shown)

      if (shown) this.#credit(theme.name)
    }

    if (still) {
      for (const sticker of stickers) sticker.dataset.on = 'false'
      this.#credit(null)
    }

    if (shown) {
      wake(shown)
      shown.decode().then(wear, wear)
    } else wear()

    this.#frameArt(theme)
  }

  #frameArt(theme: Theme) {
    const photo = this.#photo
    const turn = ++this.#photoTurn

    if (!photo) return

    if (isCast(theme.name)) {
      photo.hidden = true
      photo.replaceChildren()

      return
    }

    this.#credit(photo.hidden ? null : OTHER_ART)
    searchIndex().then(
      (index) => {
        const art = index.works.find((work) => work.id === theme.work?.id)?.art

        if (turn !== this.#photoTurn) return

        if (!art) {
          photo.hidden = true
          photo.replaceChildren()
          this.#credit(null)

          return
        }

        const image = new Image()

        image.alt = ''
        image.decoding = 'async'

        if (art.srcset) {
          image.srcset = art.srcset
          image.sizes = PHOTO_SIZES
        }

        image.src = art.src

        const place = () => {
          if (turn !== this.#photoTurn) return
          const before = [...photo.children]

          photo.hidden = false
          photo.append(image)
          this.#credit(OTHER_ART)
          Promise.allSettled(image.getAnimations().map((animation) => animation.finished)).then(() => {
            for (const old of before) old.remove()
          })
        }

        image.decode().then(place, place)
      },
      () => {},
    )
  }

  #draw(theme: Theme, still = false) {
    const before = this.#worn

    this.#worn = theme

    if (before && !still) this.#wipe(before, theme)
    show(theme)
    this.#dress(theme, still)
    const name = this.querySelector('[data-lead-name] > span')

    if (name) name.textContent = theme.name
    const sparkles = this.querySelector('sparkle-burst')

    if (!still && sparkles instanceof SparkleBurst) sparkles.burst()
    fill(this.querySelector('[data-lead-use]'), html(<LeadUse theme={theme} />))
  }
}

customElements.define('lead-showcase', LeadShowcase)
