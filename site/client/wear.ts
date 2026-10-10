import type { Theme } from '@/lib/themes'
import { isLight, WEAR_EVENT, WEAR_KEY, wearVars } from '@/lib/wear'
import { settle } from './dom'

const COLOR = /^#[0-9a-f]{6}$/i

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
  try {
    localStorage.setItem(WEAR_KEY, JSON.stringify({ v: wearVars(theme), l: isLight(theme), t: theme }))
  } catch {}
}

export function show(theme: Theme) {
  const root = document.documentElement
  settle(root)
  for (const [slot, value] of wearVars(theme)) root.style.setProperty(slot, value)
  root.style.colorScheme = isLight(theme) ? 'light' : 'dark'
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
