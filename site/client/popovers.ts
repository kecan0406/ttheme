document.addEventListener('focusout', (event) => {
  const popover = (event.target as Element | null)?.closest<HTMLElement>('[popover]')
  const next = event.relatedTarget

  if (!popover?.matches(':popover-open') || !(next instanceof Element) || popover.contains(next)) return

  if (next.closest(`[popovertarget="${popover.id}"]`)) return
  popover.hidePopover()
})
