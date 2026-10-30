import { APPLE } from '@/lib/keys'
import { announce } from './dom'
import { flash } from './tip'

const restoring = new WeakMap<HTMLElement, number>()

const KEYS = document.documentElement.hasAttribute(APPLE) ? '⌘c' : 'ctrl+c'

async function write(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)

    return true
  } catch {
    return false
  }
}

function select(button: HTMLElement) {
  const block = button.closest('[data-slot="command-row"], [data-slot="shell"], [data-slot="file"]')
  const codes = block?.querySelectorAll('code') ?? []
  const shown = [...codes].find((code) => code.getClientRects().length > 0)

  getSelection()?.selectAllChildren(shown ?? button)
}

async function copy(button: HTMLElement) {
  const copied = await write(button.dataset.copy ?? '')
  const status = button.dataset.copyStatus
  const hold = Number(button.dataset.copyHold ?? 1200) * (copied ? 1 : 3)

  if (copied) button.dataset.copied = ''
  else select(button)
  announce(copied ? 'copied' : `couldn't copy, press ${KEYS}`)

  if (status) flash(button, copied ? status : `press ${KEYS}`, hold)
  window.clearTimeout(restoring.get(button))
  restoring.set(
    button,
    window.setTimeout(() => {
      delete button.dataset.copied
    }, hold),
  )
}

document.addEventListener('click', (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>('[data-copy]')

  if (button) void copy(button)
})
