import { PinsCaption, type PinsData, PinsList, PinsShell, PlayLabel, swatchIn, titleOf } from '@/components/pins-player'
import { html } from '@/lib/render'
import { fill, readJson, reducedMotion } from './dom'

const PACE = { start: 300, char: 26, jitter: 14, enter: 140, hold: 1250, end: 2000, restart: 300 }

class PinsPlayer extends HTMLElement {
  #data: PinsData | null = null
  #at = 0
  #typed = 0
  #playing = false
  #held = false
  #timer = 0
  #seen: IntersectionObserver | null = null

  #click = (event: MouseEvent) => {
    const button = (event.target as Element).closest('button')

    if (button?.hasAttribute('data-pins-toggle')) this.#toggle()
    else if (button?.hasAttribute('data-pins-restart')) this.#restart()
  }

  connectedCallback() {
    this.#data = readJson<PinsData>(this, 'script[data-pins]')
    this.addEventListener('click', this.#click)
    this.#seen = new IntersectionObserver((entries) => this.#see(entries.at(-1)?.isIntersecting ?? false), {
      threshold: 0.5,
    })
    this.#seen.observe(this)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.#seen?.disconnect()
    window.clearTimeout(this.#timer)
  }

  #see(shown: boolean) {
    if (!shown) {
      this.#halt()

      return
    }

    if (!this.#held && !reducedMotion()) this.#play(PACE.start)
  }

  #toggle() {
    this.#held = this.#playing

    if (this.#playing) this.#halt()
    else this.#play(PACE.restart)
  }

  #restart() {
    this.#at = 0
    this.#typed = 0
    this.#draw(true)
    this.#held = false
    this.#play(PACE.restart)
  }

  #play(delay: number) {
    this.#playing = true
    this.#label()
    this.#later(delay)
  }

  #halt() {
    this.#playing = false
    window.clearTimeout(this.#timer)
    this.#label()
  }

  #later(delay: number) {
    window.clearTimeout(this.#timer)
    this.#timer = window.setTimeout(() => this.#tick(), delay)
  }

  #tick() {
    const frames = this.#data?.frames

    if (!frames || !this.#playing) return
    const last = frames.length - 1

    if (this.#at >= last) {
      this.#at = 0
      this.#typed = 0
      this.#draw(true)
      this.#later(PACE.restart)

      return
    }

    const command = frames[this.#at + 1]?.command ?? ''

    if (this.#typed < command.length) {
      this.#typed = reducedMotion() ? command.length : this.#typed + 1
      this.#draw(false)
      this.#later(this.#typed >= command.length ? PACE.enter : PACE.char + Math.floor(Math.random() * PACE.jitter))

      return
    }

    this.#at += 1
    this.#typed = 0
    this.#draw(true)
    this.#later(this.#at >= last ? PACE.end : PACE.hold)
  }

  #draw(stepped: boolean) {
    const data = this.#data
    const frame = data?.frames[this.#at]

    if (!data || !frame) return
    const last = Math.max(1, data.frames.length - 1)
    const command = data.frames[this.#at + 1]?.command ?? ''
    const typing = command.slice(0, this.#typed)
    const share = command.length > 0 ? this.#typed / command.length : 0
    const progress = this.querySelector<HTMLElement>('[data-pins-progress]')

    fill(
      this.querySelector('[data-pins-shell]'),
      html(<PinsShell frame={frame} typing={typing} swatches={data.swatches} />),
    )
    progress?.style.setProperty('width', `${Math.min(100, ((this.#at + share) / last) * 100)}%`)

    if (!stepped) return
    const list = this.querySelector('[data-pins-list]')
    this.querySelector('[data-pins-window]')?.setAttribute('style', swatchIn(data.swatches, frame.tab).style)
    list?.setAttribute('style', swatchIn(data.swatches, frame.local).style)
    fill(list, html(<PinsList frame={frame} swatches={data.swatches} />))
    fill(this.querySelector('[data-pins-caption]'), html(<PinsCaption frame={frame} swatches={data.swatches} />))
    const title = this.querySelector('[data-pins-window] [data-window-title]')

    if (title) title.textContent = titleOf(frame)
  }

  #label() {
    fill(this.querySelector('[data-pins-toggle]'), html(<PlayLabel playing={this.#playing} />))
  }
}

customElements.define('pins-player', PinsPlayer)
