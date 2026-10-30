const GAP = 8

const EDGE = 8

let tip: HTMLElement | null = null

let held = 0

function box(): HTMLElement {
  if (tip) return tip
  tip = document.createElement('div')
  tip.dataset.slot = 'tip'
  tip.popover = 'manual'
  tip.setAttribute('aria-hidden', 'true')
  document.body.append(tip)

  return tip
}

function hide() {
  window.clearTimeout(held)

  if (tip?.matches(':popover-open')) tip.hidePopover()
}

export function flash(target: Element, text: string, hold: number) {
  const spot = target.getBoundingClientRect()
  const panel = box()
  window.clearTimeout(held)
  panel.textContent = text

  if (!panel.matches(':popover-open')) panel.showPopover()
  const { width, height } = panel.getBoundingClientRect()
  const above = spot.top - GAP - height
  panel.style.top = `${above < EDGE ? spot.bottom + GAP : above}px`
  panel.style.left = `${Math.max(EDGE, Math.min(spot.left + spot.width / 2 - width / 2, window.innerWidth - width - EDGE))}px`
  held = window.setTimeout(hide, hold)
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hide()
})

for (const kind of ['scroll', 'resize'] as const) window.addEventListener(kind, hide, { capture: true, passive: true })
