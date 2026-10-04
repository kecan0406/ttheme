import type { Theme } from '@/lib/themes'
import { SETTLE_MS, wearSlots } from '@/lib/wear'

const settling = new WeakMap<HTMLElement, number>()

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

export function reducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function wear(element: HTMLElement, theme: Theme) {
  for (const [slot, color] of wearSlots(theme)) element.style.setProperty(slot, color)
}

export function settle(element: HTMLElement) {
  element.dataset.settling = ''
  window.clearTimeout(settling.get(element))
  settling.set(
    element,
    window.setTimeout(() => delete element.dataset.settling, SETTLE_MS),
  )
}
