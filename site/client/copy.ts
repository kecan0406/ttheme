import { announce } from './dom'

const restoring = new WeakMap<HTMLElement, number>()

const KEYS = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘c' : 'ctrl+c'

async function write(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function select(button: HTMLElement) {
  getSelection()?.selectAllChildren(button.closest('[data-slot="command-row"]')?.querySelector('code') ?? button)
}

function note(button: HTMLElement, text: string) {
  const shown = button.previousElementSibling
  if (shown?.matches('[data-copy-note]')) {
    shown.textContent = text
    return
  }
  const span = document.createElement('span')
  span.dataset.copyNote = ''
  span.setAttribute('aria-hidden', 'true')
  span.className = 'flex-none text-xs text-muted-foreground motion-safe:animate-enter'
  span.textContent = text
  button.before(span)
}

async function copy(button: HTMLElement) {
  const copied = await write(button.dataset.copy ?? '')
  const status = button.dataset.copyStatus
  if (copied) button.dataset.copied = ''
  else select(button)
  announce(copied ? 'copied' : `couldn't copy, press ${KEYS}`)
  if (status) note(button, copied ? status : `press ${KEYS}`)
  window.clearTimeout(restoring.get(button))
  restoring.set(
    button,
    window.setTimeout(
      () => {
        delete button.dataset.copied
        const shown = button.previousElementSibling
        if (shown?.matches('[data-copy-note]')) shown.remove()
      },
      Number(button.dataset.copyHold ?? 1200) * (copied ? 1 : 3),
    ),
  )
}

document.addEventListener('click', (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>('[data-copy]')
  if (button) void copy(button)
})
