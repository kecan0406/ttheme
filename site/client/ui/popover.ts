import { emit, type Reason } from './change'
import { enter, mark, rest } from './popup'

const GAP = 8

const EDGE = 16

const anchors = new WeakMap<Element, Element>()

let cause: { reason: Reason; popup: Element | null } | null = null

let pressed: Element | null = null

let input = ''

let following = 0

function isPopup(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.matches('[data-slot="popover"]')
}

function shown(element: Element): boolean {
  return element.getClientRects().length > 0
}

function invokers(popup: HTMLElement): Element[] {
  return [...document.querySelectorAll(`[popovertarget="${popup.id}"]`)]
}

function anchorOf(popup: HTMLElement): Element | undefined {
  const last = anchors.get(popup)

  return last && shown(last) ? last : invokers(popup).find(shown)
}

function note(reason: Reason, popup: Element | null) {
  const mine = { reason, popup }
  cause = mine
  window.setTimeout(() => {
    if (cause === mine) cause = null
  })
}

function reasonFor(popup: HTMLElement): Reason {
  if (cause && (cause.popup === null || cause.popup === popup)) return cause.reason

  return pressed && !popup.contains(pressed) ? 'outside-press' : 'none'
}

function hide(popup: HTMLElement, reason: Reason) {
  const before = cause
  cause = { reason, popup }
  popup.hidePopover()
  cause = before
}

function place(popup: HTMLElement) {
  const align = popup.dataset.align
  const anchor = anchorOf(popup)

  if (!align || !anchor) return
  const spot = anchor.getBoundingClientRect()
  popup.style.setProperty('--anchor-width', `${spot.width}px`)
  const width = popup.offsetWidth
  const edge = align === 'end' ? spot.right - width : spot.left
  const left = Math.max(EDGE, Math.min(edge, window.innerWidth - width - EDGE))
  popup.style.top = `${spot.bottom + Number(popup.dataset.offset ?? GAP)}px`
  popup.style.left = `${left}px`
  popup.style.setProperty(
    '--transform-origin',
    `${Math.max(0, Math.min(spot.left + spot.width / 2 - left, width))}px 0`,
  )
}

function follow() {
  if (following !== 0) return

  following = requestAnimationFrame(() => {
    following = 0

    for (const popup of document.querySelectorAll<HTMLElement>('[data-slot="popover"][data-align]:popover-open'))
      place(popup)
  })
}

document.addEventListener(
  'pointerdown',
  (event) => {
    input = event.pointerType
    pressed = event.target as Element
  },
  true,
)

for (const kind of ['pointerup', 'pointercancel'] as const) {
  document.addEventListener(
    kind,
    () => {
      const mine = pressed
      window.setTimeout(() => {
        if (pressed === mine) pressed = null
      })
    },
    true,
  )
}

document.addEventListener(
  'keydown',
  (event) => {
    input = 'keyboard'

    if (event.key === 'Escape') note('escape-key', null)
  },
  true,
)

document.addEventListener(
  'click',
  (event) => {
    const trigger = (event.target as Element | null)?.closest('[data-slot="popover-trigger"]')
    const popup = document.getElementById(trigger?.getAttribute('popovertarget') ?? '')

    if (!trigger || !isPopup(popup)) return
    anchors.set(popup, trigger)
    note('trigger-press', popup)
  },
  true,
)

document.addEventListener(
  'beforetoggle',
  (event) => {
    const popup = event.target

    if (!isPopup(popup)) return
    const reason = reasonFor(popup)
    const trigger = reason === 'trigger-press' ? (anchors.get(popup) ?? null) : null

    if ((event as ToggleEvent).newState !== 'open') {
      emit(popup, 'openchange', { open: false, reason, trigger }, false)
      mark(popup, false)
      rest(popup)

      return
    }

    const by = input

    enter(popup, () => {
      place(popup)

      if (by !== 'touch') popup.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    })

    if (!emit(popup, 'openchange', { open: true, reason, trigger }, true)) {
      rest(popup)
      event.preventDefault()

      return
    }

    mark(popup, true)
  },
  true,
)

document.addEventListener('focusout', (event) => {
  const popup = (event.target as Element | null)?.closest<HTMLElement>('[data-slot="popover"]')
  const next = event.relatedTarget

  if (!popup?.matches(':popover-open') || !(next instanceof Element) || popup.contains(next)) return

  if (next.closest(`[popovertarget="${popup.id}"]`)) return
  hide(popup, 'focus-out')
})

window.addEventListener('resize', () => {
  for (const popup of document.querySelectorAll<HTMLElement>('[data-slot="popover"]:popover-open')) {
    const all = invokers(popup)

    if (all.length > 0 && !all.some(shown)) hide(popup, 'window-resize')
  }

  follow()
})

window.addEventListener('scroll', follow, { capture: true, passive: true })
