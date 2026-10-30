const GAP = 8

const EDGE = 8

const HOVER = 400

let tip: HTMLElement | null = null

let owner: Element | null = null

let hovered: Element | null = null

let pending = 0

let held = 0

let flashing = false

function box(): HTMLElement {
  if (tip) return tip
  tip = document.createElement('div')
  tip.dataset.slot = 'tip'
  tip.popover = 'manual'
  tip.setAttribute('aria-hidden', 'true')
  document.body.append(tip)

  return tip
}

function tipOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null
}

function place(target: Element, text: string) {
  const spot = target.getBoundingClientRect()
  const panel = box()
  panel.textContent = text

  if (!panel.matches(':popover-open')) panel.showPopover()
  const { width, height } = panel.getBoundingClientRect()
  const above = spot.top - GAP - height
  panel.style.top = `${above < EDGE ? spot.bottom + GAP : above}px`
  panel.style.left = `${Math.max(EDGE, Math.min(spot.left + spot.width / 2 - width / 2, window.innerWidth - width - EDGE))}px`
  owner = target
}

function hide() {
  window.clearTimeout(pending)
  owner = null

  if (tip?.matches(':popover-open')) tip.hidePopover()
}

function settle(target: Element) {
  const text = target instanceof HTMLElement ? target.dataset.tip : undefined

  if (text && (hovered === target || target.matches(':focus-visible'))) place(target, text)
  else hide()
}

export function flash(target: Element, text: string, hold: number) {
  window.clearTimeout(pending)
  window.clearTimeout(held)
  flashing = true
  place(target, text)
  held = window.setTimeout(() => {
    flashing = false
    settle(target)
  }, hold)
}

export function handOver(from: Element, to: HTMLElement) {
  if (hovered === from) hovered = to

  if (owner === from && !flashing) settle(to)
}

document.addEventListener('pointerover', (event) => {
  if (event.pointerType === 'touch') return
  const target = tipOf(event.target)

  if (target === hovered) return
  hovered = target
  window.clearTimeout(pending)

  if (flashing) return

  if (!target) {
    hide()

    return
  }

  pending = window.setTimeout(() => settle(target), owner ? 0 : HOVER)
})

document.addEventListener('pointerout', (event) => {
  if (event.relatedTarget) return
  hovered = null

  if (!flashing) hide()
})

document.addEventListener('focusin', (event) => {
  const target = tipOf(event.target)

  if (target && !flashing && target.matches(':focus-visible')) settle(target)
})

document.addEventListener('focusout', (event) => {
  const target = tipOf(event.target)

  if (target && target === owner && !flashing && hovered !== target) hide()
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !owner) return
  window.clearTimeout(held)
  flashing = false
  hide()
})

for (const kind of ['scroll', 'resize'] as const) {
  window.addEventListener(
    kind,
    () => {
      if (!owner) return
      window.clearTimeout(held)
      flashing = false
      hide()
    },
    { capture: true, passive: true },
  )
}
