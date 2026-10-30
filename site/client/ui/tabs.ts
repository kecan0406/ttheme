import { bare } from '../keys'
import { emit } from './change'

const MOVES = new Map<string, (index: number, count: number) => number>([
  ['ArrowRight', (index) => index + 1],
  ['ArrowLeft', (index) => index - 1],
  ['Home', () => 0],
  ['End', (_, count) => count - 1],
])

function tabOf(target: EventTarget | null): HTMLElement | null {
  return (target as Element | null)?.closest<HTMLElement>('[data-slot="tabs-trigger"]') ?? null
}

function tabsIn(list: Element): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]')]
}

function select(tab: HTMLElement) {
  const list = tab.closest('[data-slot="tabs-list"]')

  if (!list || tab.hasAttribute('data-active')) return

  if (!emit(list, 'valuechange', { value: tab.dataset.value ?? '', reason: 'none', trigger: tab }, true)) return

  for (const one of tabsIn(list)) {
    const on = one === tab
    one.setAttribute('aria-selected', String(on))
    one.tabIndex = on ? 0 : -1
    one.toggleAttribute('data-active', on)
    const panel = document.getElementById(one.getAttribute('aria-controls') ?? '')

    if (panel) panel.hidden = !on
  }
}

document.addEventListener('click', (event) => {
  const tab = tabOf(event.target)

  if (tab) select(tab)
})

document.addEventListener('keydown', (event) => {
  const tab = tabOf(event.target)
  const move = MOVES.get(event.key)
  const list = tab?.closest('[data-slot="tabs-list"]')

  if (!tab || !move || !list || !bare(event)) return
  event.preventDefault()
  const tabs = tabsIn(list)
  const next = tabs[(move(tabs.indexOf(tab), tabs.length) + tabs.length) % tabs.length]

  if (!next) return
  next.focus()
  select(next)
})
