const restoring = new WeakMap<HTMLElement, number>()

async function copy(button: HTMLElement) {
  await navigator.clipboard.writeText(button.dataset.copy ?? '')
  const label = button.dataset.copyLabel ?? button.getAttribute('aria-label') ?? ''
  const status = button.dataset.copyStatus
  button.dataset.copyLabel = label
  button.dataset.copied = ''
  if (status) {
    button.setAttribute('aria-label', 'copied')
    if (!button.previousElementSibling?.matches('[role="status"]')) {
      const note = document.createElement('span')
      note.setAttribute('role', 'status')
      note.className = 'flex-none text-xs text-muted-foreground motion-safe:animate-enter'
      note.textContent = status
      button.before(note)
    }
  }
  window.clearTimeout(restoring.get(button))
  restoring.set(
    button,
    window.setTimeout(
      () => {
        delete button.dataset.copied
        if (!status) return
        button.setAttribute('aria-label', label)
        if (button.previousElementSibling?.matches('[role="status"]')) button.previousElementSibling.remove()
      },
      Number(button.dataset.copyHold ?? 1200),
    ),
  )
}

document.addEventListener('click', (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>('[data-copy]')
  if (button) void copy(button)
})
