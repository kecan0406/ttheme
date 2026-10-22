document.addEventListener('focusout', (event) => {
  const popover = (event.target as Element | null)?.closest<HTMLElement>('[popover]')
  const next = event.relatedTarget

  if (!popover?.matches(':popover-open') || !(next instanceof Element) || popover.contains(next)) return

  if (next.closest(`[popovertarget="${popover.id}"]`)) return
  popover.hidePopover()
})

window.addEventListener('resize', () => {
  for (const popover of document.querySelectorAll<HTMLElement>('[popover]:popover-open')) {
    const invokers = [...document.querySelectorAll(`[popovertarget="${popover.id}"]`)]

    if (invokers.length > 0 && invokers.every((invoker) => invoker.getClientRects().length === 0)) popover.hidePopover()
  }
})
