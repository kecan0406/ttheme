import type { Point } from '@/lib/facets'
import type { Theme } from '@/lib/themes'
import {
  isLight,
  LABEL,
  SHOW_EVENT,
  type Shown,
  SIGNS,
  SLOTS,
  TONES,
  type Vars,
  WEAR_EVENT,
  WEAR_KEY,
  wearIcon,
  wearOwn,
  wearVars,
} from '@/lib/wear'
import { reducedMotion } from './dom'
import { respeculate } from './speculation'

type Rgb = [number, number, number]

const COLOR = /^#[0-9a-f]{6}$/i

const FADE: KeyframeEffectOptions = { duration: 400, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' }

const painted = new Map<string, Rgb>()

const chrome = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

let fading: Animation | null = null

let goal: Vars = []

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

function same(slots: Vars, other: Vars): boolean {
  return (
    slots.length === other.length &&
    slots.every(([slot, color], index) => other[index]?.[0] === slot && other[index]?.[1] === color)
  )
}

function settle(root: HTMLElement) {
  fading?.cancel()
  fading = null
  painted.clear()
  delete root.dataset.settling
}

function badge(root: HTMLElement) {
  if (!icon) return
  const value = (name: string) => root.style.getPropertyValue(name)
  const href = wearIcon({ background: value('--bg'), foreground: value('--fg'), signature: TONES.map(value) })
  if (icon.getAttribute('href') !== href) icon.href = href
}

function fade(root: HTMLElement, slots: Vars) {
  if (fading ? same(slots, goal) : slots.every(([slot, color]) => root.style.getPropertyValue(slot) === color)) return
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
    chrome?.setAttribute('content', root.style.getPropertyValue('--bg'))
    requestAnimationFrame(progress < 1 ? step : settled)
  }
  const settled = () => {
    if (fading !== clock) return
    settle(root)
    badge(root)
  }
  fading?.cancel()
  fading = clock
  goal = slots
  root.dataset.settling = ''
  clock.play()
  requestAnimationFrame(step)
}

function relabel(root: HTMLElement, name: string) {
  const was = root.style.getPropertyValue(LABEL)
  root.style.setProperty(LABEL, name)
  if (!was || was === name || reducedMotion()) return
  for (const label of document.querySelectorAll<HTMLElement>('[data-wear-label]')) {
    label.style.setProperty('--wear-was', was)
    if (label.dataset.renaming === undefined) label.dataset.renaming = ''
    else
      for (const animation of label.getAnimations({ subtree: true })) {
        animation.cancel()
        animation.play()
      }
  }
}

function wear(vars: Vars, light: boolean, origin: Point | null) {
  document.dispatchEvent(new CustomEvent<Shown>(SHOW_EVENT, { detail: { vars, origin, instant: false } }))
  const root = document.documentElement
  for (const [name, value] of vars) if (name === LABEL) relabel(root, value)
  root.style.colorScheme = light ? 'light' : 'dark'
  fade(
    root,
    vars.filter(([name]) => SLOTS.includes(name) || TONES.includes(name)),
  )
}

export function show(theme: Theme) {
  const root = document.documentElement
  for (const [name, value] of wearOwn(theme)) root.style.setProperty(name, value)
  wear(wearVars(theme), isLight(theme), null)
}

export function worn(): Vars {
  const { style } = document.documentElement
  return [...SLOTS, ...SIGNS].map((name): [string, string] => [name, style.getPropertyValue(name)])
}

function handed(text: string): { vars: Vars; light: boolean; origin: Point | null } | null {
  try {
    const { v, l, p } = JSON.parse(text) as { v: Vars; l: boolean; p: unknown }
    const origin =
      Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' ? { x: p[0], y: p[1] } : null
    return { vars: v, light: l, origin }
  } catch {
    return null
  }
}

export function arrive() {
  const root = document.documentElement
  const text = root.dataset.handoff
  if (text === undefined) return
  delete root.dataset.handoff
  const own = handed(text)
  if (!own) return
  settle(root)
  document.dispatchEvent(new CustomEvent<Shown>(SHOW_EVENT, { detail: { vars: worn(), origin: null, instant: true } }))
  wear(own.vars, own.light, own.origin)
}

window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !fading) return
  const root = document.documentElement
  for (const [slot, color] of goal) root.style.setProperty(slot, color)
  chrome?.setAttribute('content', root.style.getPropertyValue('--bg'))
  settle(root)
  badge(root)
})

export function current(): string {
  try {
    const name: unknown = JSON.parse(getComputedStyle(document.documentElement).getPropertyValue(LABEL))
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
