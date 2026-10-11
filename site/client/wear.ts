import type { Theme } from '@/lib/themes'
import { isLight, SHOW_EVENT, WEAR_EVENT, WEAR_KEY, wearSigns, wearSlots, wearVars } from '@/lib/wear'
import { reducedMotion } from './dom'
import { respeculate } from './speculation'

type Rgb = [number, number, number]

const COLOR = /^#[0-9a-f]{6}$/i

const FADE: KeyframeEffectOptions = { duration: 400, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' }

const painted = new Map<string, Rgb>()

let fading: Animation | null = null

function isTheme(value: unknown): value is Theme {
  if (typeof value !== 'object' || value === null) return false
  const theme = value as Partial<Theme>
  return (
    typeof theme.name === 'string' &&
    typeof theme.background === 'string' &&
    typeof theme.foreground === 'string' &&
    typeof theme.cursor === 'string' &&
    typeof theme.selectionBackground === 'string' &&
    Array.isArray(theme.ansi) &&
    theme.ansi.length === 16 &&
    theme.ansi.every((color) => COLOR.test(color)) &&
    Array.isArray(theme.signature) &&
    [theme.background, theme.foreground, theme.cursor, theme.selectionBackground].every((color) =>
      COLOR.test(String(color)),
    )
  )
}

export function recall(): Theme | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WEAR_KEY) ?? 'null')
    const theme = typeof stored === 'object' && stored !== null ? (stored as { t?: unknown }).t : null
    return isTheme(theme) ? theme : null
  } catch {
    return null
  }
}

export function remember(theme: Theme) {
  const value = JSON.stringify({ v: wearVars(theme), l: isLight(theme), t: theme })
  try {
    if (localStorage.getItem(WEAR_KEY) === value) return
    localStorage.setItem(WEAR_KEY, value)
  } catch {
    return
  }
  respeculate()
}

function rgb(color: string): Rgb {
  const value = Number.parseInt(color.slice(1), 16)
  return [value >> 16, (value >> 8) & 255, value & 255]
}

function hex(color: Rgb): string {
  return `#${color.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function mix(from: Rgb, to: Rgb, progress: number): Rgb {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
    from[2] + (to[2] - from[2]) * progress,
  ]
}

function fade(root: HTMLElement, slots: [string, string][]) {
  if (!fading && slots.every(([slot, color]) => root.style.getPropertyValue(slot) === color)) return
  const fades = slots.map(([slot, color]) => {
    const worn = root.style.getPropertyValue(slot)
    return { slot, from: painted.get(slot) ?? rgb(COLOR.test(worn) ? worn : color), to: rgb(color) }
  })
  const timing = new KeyframeEffect(null, null, reducedMotion() ? { duration: 0 } : FADE)
  const clock = new Animation(timing)
  const step = () => {
    if (fading !== clock) return
    const progress = clock.playState === 'finished' ? 1 : (timing.getComputedTiming().progress ?? 0)
    for (const { slot, from, to } of fades) {
      const color = mix(from, to, progress)
      painted.set(slot, color)
      root.style.setProperty(slot, hex(color))
    }
    requestAnimationFrame(progress < 1 ? step : settled)
  }
  const settled = () => {
    if (fading !== clock) return
    fading = null
    painted.clear()
    delete root.dataset.settling
  }
  fading?.cancel()
  fading = clock
  root.dataset.settling = ''
  clock.play()
  requestAnimationFrame(step)
}

export function show(theme: Theme) {
  document.dispatchEvent(new CustomEvent<Theme>(SHOW_EVENT, { detail: theme }))
  const root = document.documentElement
  for (const [name, value] of wearSigns(theme)) root.style.setProperty(name, value)
  root.style.colorScheme = isLight(theme) ? 'light' : 'dark'
  fade(root, wearSlots(theme))
}

export function current(): string {
  try {
    const name: unknown = JSON.parse(getComputedStyle(document.documentElement).getPropertyValue('--wear-name'))
    return typeof name === 'string' ? name : ''
  } catch {
    return ''
  }
}

export function choose(theme: Theme) {
  remember(theme)
  const event = new CustomEvent<Theme>(WEAR_EVENT, { detail: theme, cancelable: true })
  if (document.dispatchEvent(event)) show(theme)
}

export function onWear(listener: (theme: Theme) => void): () => void {
  const handle = (event: Event) => {
    event.preventDefault()
    listener((event as CustomEvent<Theme>).detail)
  }
  document.addEventListener(WEAR_EVENT, handle)
  return () => document.removeEventListener(WEAR_EVENT, handle)
}
