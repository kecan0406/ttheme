const frames = new WeakMap<Element, number>()

export function mark(popup: HTMLElement, open: boolean) {
  popup.toggleAttribute('data-open', open)
  popup.toggleAttribute('data-closed', !open)

  for (const trigger of document.querySelectorAll(`[popovertarget="${popup.id}"], [commandfor="${popup.id}"]`))
    trigger.toggleAttribute('data-popup-open', open)
}

export function rest(popup: HTMLElement) {
  cancelAnimationFrame(frames.get(popup) ?? 0)
  popup.removeAttribute('data-starting-style')
  popup.removeAttribute('data-ending-style')
}

export function enter(popup: HTMLElement, first?: () => void) {
  rest(popup)
  popup.setAttribute('data-starting-style', '')

  frames.set(
    popup,
    requestAnimationFrame(() => {
      first?.()
      frames.set(
        popup,
        requestAnimationFrame(() => popup.removeAttribute('data-starting-style')),
      )
    }),
  )
}

export async function leave(popup: HTMLElement): Promise<void> {
  rest(popup)
  popup.setAttribute('data-ending-style', '')
  await Promise.allSettled(popup.getAnimations({ subtree: true }).map((animation) => animation.finished))
}
