import { plural } from '@/lib/utils'

let tallying = 0

export function readJson<T>(host: Element, selector: string): T {
  const script = host.querySelector<HTMLScriptElement>(selector)

  if (!script?.textContent) throw new Error(`${selector} is missing`)

  return JSON.parse(script.textContent) as T
}

export function fill(target: Element | null, markup: string) {
  if (target) target.innerHTML = markup
}

export function swap(target: Element | null, markup: string) {
  if (!target) return
  const template = document.createElement('template')
  template.innerHTML = markup
  target.replaceWith(template.content)
}

export function announce(text: string) {
  const region = document.querySelector('[data-announce]')

  if (!region) return
  region.textContent = ''
  window.setTimeout(() => {
    region.textContent = text
  }, 50)
}

export function tally(count: number) {
  window.clearTimeout(tallying)
  tallying = window.setTimeout(() => announce(count === 0 ? 'no palette matches' : plural(count, 'palette')), 500)
}

export function reducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

let fades = 0

let band: CSSStyleSheet | null = null

function clip(top: number, bottom: number) {
  if (!band) {
    band = new CSSStyleSheet()
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, band]
  }

  band.replaceSync(`::view-transition{clip-path:inset(${top}px 0 ${bottom}px)}`)
}

export function fadeThrough(update: () => void) {
  if (reducedMotion() || !('startViewTransition' in document)) {
    update()

    return
  }

  const height = window.innerHeight
  let top = 0
  let bottom = height

  for (const sticky of document.querySelectorAll('[data-sticky]')) {
    const box = sticky.getBoundingClientRect()

    if (box.bottom <= height / 2) top = Math.max(top, box.bottom)
    else if (box.top >= height / 2) bottom = Math.min(bottom, box.top)
  }

  clip(top, height - bottom)
  const root = document.documentElement
  const turn = ++fades

  const done = () => {
    if (turn === fades) delete root.dataset.fading
  }

  root.dataset.fading = ''
  document.startViewTransition(update).finished.then(done, done)
}
