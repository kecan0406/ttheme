import { HANDOFF_KEY } from '@/lib/handoff'
import { reducedMotion } from './dom'
import { arrive, worn } from './wear'

const PRESS_MS = 1000

let press: { x: number; y: number; at: number } | null = null

function drop(at: number) {
  try {
    const kept: unknown = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) ?? 'null')

    if (typeof kept === 'object' && kept !== null && (kept as { at?: unknown }).at === at)
      sessionStorage.removeItem(HANDOFF_KEY)
  } catch {}
}

function folded(): number {
  const header = document.querySelector('[data-site-header]')

  if (!header) return 0
  const fold = Number.parseFloat(getComputedStyle(header).paddingTop)

  if (!(fold > 0)) return 0

  return Math.round(Math.min(1, Math.max(0, -header.getBoundingClientRect().top / fold)) * 1000) / 1000
}

function underlined(): string | null {
  const nav = document.querySelector('[data-site-header] [data-glide]')

  if (!nav || !CSS.supports('anchor-name', '--glide')) return null

  if (Number(getComputedStyle(nav, '::before').opacity) < 0.5) return ''

  for (const link of nav.querySelectorAll('a')) {
    const label = link.firstElementChild

    if (label && getComputedStyle(label).getPropertyValue('anchor-name') === '--glide')
      return link.getAttribute('href') ?? ''
  }

  return ''
}

function leave(event: NavigateEvent) {
  const { destination } = event

  if (destination.sameDocument || event.downloadRequest !== null) return

  if (new URL(destination.url).origin !== location.origin) return
  const vars = worn()

  try {
    window.navigation.updateCurrentEntry({ state: { worn: vars } })
  } catch {}

  try {
    if (event.navigationType === 'reload') {
      sessionStorage.removeItem(HANDOFF_KEY)

      return
    }

    const at = Date.now()
    const point = press && performance.now() - press.at < PRESS_MS ? [press.x, press.y] : null
    const light = document.documentElement.style.colorScheme.includes('light')
    sessionStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        to: destination.url,
        at,
        t: event.navigationType,
        v: vars,
        l: light,
        p: point,
        f: folded(),
        g: underlined(),
      }),
    )
    event.signal.addEventListener('abort', () => drop(at), { once: true })
  } catch {}
}

function changes(state: unknown): boolean {
  const there = typeof state === 'object' && state !== null ? (state as { worn?: unknown }).worn : undefined

  return JSON.stringify(there) !== JSON.stringify(worn())
}

function swap(event: PageSwapEvent) {
  delete document.documentElement.dataset.fading
  const { activation, viewTransition } = event

  if (!viewTransition) return

  if (!reducedMotion() && activation?.navigationType === 'traverse' && changes(activation.entry.getState())) return
  viewTransition.ready.catch(() => {})
  viewTransition.skipTransition()
}

window.addEventListener(
  'pointerdown',
  (event) => {
    press = { x: event.clientX, y: event.clientY, at: performance.now() }
  },
  { capture: true, passive: true },
)

if ('navigation' in window) window.navigation.addEventListener('navigate', leave)

window.addEventListener('pageswap', swap)

window.addEventListener('pagereveal', arrive)

arrive()
