const GAP = 8

const EDGE = 16

const WIDEST = 400

export function placeUnder(panel: HTMLElement, trigger: Element, edge: 'left' | 'right'): void {
  const spot = trigger.getBoundingClientRect()
  panel.style.top = `${spot.bottom + GAP}px`

  if (edge === 'left') panel.style.left = `${Math.max(EDGE, Math.min(spot.left, window.innerWidth - WIDEST - EDGE))}px`
  else panel.style.right = `${Math.max(EDGE, window.innerWidth - spot.right)}px`
}
