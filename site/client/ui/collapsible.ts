import { emit, type Reason } from './change'

const HEIGHT = '--collapsible-panel-height'

const turns = new WeakMap<Element, number>()

function isRoot(target: EventTarget | null): target is HTMLDetailsElement {
  return target instanceof HTMLDetailsElement && target.matches('[data-slot="collapsible"]')
}

function panelOf(root: HTMLDetailsElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(':scope > [data-slot="collapsible-panel"]')
}

function mark(root: HTMLDetailsElement, open: boolean) {
  root.toggleAttribute('data-open', open)
  root.toggleAttribute('data-closed', !open)
}

function turn(root: HTMLDetailsElement): number {
  const next = (turns.get(root) ?? 0) + 1
  turns.set(root, next)

  return next
}

function rest(panel: HTMLElement) {
  panel.removeAttribute('data-starting-style')
  panel.removeAttribute('data-ending-style')
  panel.style.removeProperty(HEIGHT)
  panel.style.removeProperty('overflow')
}

function pin(panel: HTMLElement): number {
  panel.style.setProperty(HEIGHT, `${panel.scrollHeight}px`)
  panel.style.overflow = 'clip'

  return panel.offsetHeight
}

function frame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function set(root: HTMLDetailsElement, open: boolean, reason: Reason, trigger: Element) {
  if (!emit(root, 'openchange', { open, reason, trigger }, true)) return
  const mine = turn(root)
  const panel = panelOf(root)
  mark(root, open)

  if (!panel) {
    root.open = open

    return
  }

  panel.removeAttribute('data-starting-style')
  panel.removeAttribute('data-ending-style')

  if (open && !root.open) {
    panel.style.transition = 'none'
    panel.setAttribute('data-starting-style', '')
    root.open = true
    pin(panel)
    panel.style.removeProperty('transition')
    await frame()

    if (turns.get(root) !== mine) return
    panel.removeAttribute('data-starting-style')
  } else {
    pin(panel)

    if (!open) panel.setAttribute('data-ending-style', '')
  }

  await Promise.allSettled(panel.getAnimations().map((animation) => animation.finished))

  if (turns.get(root) !== mine) return
  root.open = open
  rest(panel)
}

document.addEventListener('click', (event) => {
  const target = event.target as Element | null
  const trigger = target?.closest('[data-slot="collapsible-trigger"]')
  const root = trigger?.parentElement ?? null

  if (!trigger || !isRoot(root) || event.defaultPrevented) return
  const inner = target?.closest('a, button, input, label, select, textarea')

  if (inner && trigger.contains(inner)) return
  event.preventDefault()
  void set(root, !root.hasAttribute('data-open'), 'trigger-press', trigger)
})

new MutationObserver((records) => {
  for (const { target } of records) {
    if (!isRoot(target) || target.open === target.hasAttribute('data-open')) continue
    turn(target)
    const panel = panelOf(target)

    if (panel) rest(panel)
    emit(target, 'openchange', { open: target.open, reason: 'none', trigger: null }, false)
    mark(target, target.open)
  }
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
