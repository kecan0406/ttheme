import { type CSSProperties, useLayoutEffect, useRef } from 'react'
import { luminance } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'

const SETTLE_MS = 650

export function wearStyle(theme: Theme): CSSProperties {
  const style: Record<string, string> = {
    '--bg': theme.background,
    '--fg': theme.foreground,
    '--cu': theme.cursor,
    '--se': theme.selectionBackground,
  }
  for (const [index, color] of theme.ansi.entries()) style[`--a${index}`] = color
  return style as CSSProperties
}

export function isLight(theme: Theme): boolean {
  return luminance(theme.background) > 0.3
}

export function useSettling<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)
  const last = useRef(key)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || last.current === key) return
    last.current = key
    element.dataset.settling = ''
    const timer = window.setTimeout(() => delete element.dataset.settling, SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [key])

  return ref
}
