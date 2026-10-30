import { bare } from '../keys'
import { emit } from './change'
import { stepTo } from './roving'

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
  const list = tab?.closest('[data-slot="tabs-list"]')

  if (!tab || !list || !bare(event)) return
  const next = stepTo(event.key, tabsIn(list), tab)

  if (!next) return
  event.preventDefault()
  next.focus()
  select(next)
})
