import { emit, type Reason } from './change'
import { enter, leave, mark, rest } from './popup'

function isDialog(target: EventTarget | null): target is HTMLDialogElement {
  return target instanceof HTMLDialogElement && target.matches('[data-slot="dialog-content"]')
}

function show(dialog: HTMLDialogElement, trigger: Element) {
  if (dialog.open || !emit(dialog, 'openchange', { open: true, reason: 'trigger-press', trigger }, true)) return
  const host = trigger.closest<HTMLElement>('[popover]')

  if (host?.matches(':popover-open')) host.hidePopover()
  mark(dialog, true)
  enter(dialog)
  dialog.showModal()
}

async function hide(dialog: HTMLDialogElement, reason: Reason) {
  if (!dialog.open || dialog.hasAttribute('data-ending-style')) return

  if (!emit(dialog, 'openchange', { open: false, reason, trigger: null }, true)) return
  mark(dialog, false)
  await leave(dialog)
  dialog.close()
}

document.addEventListener('click', (event) => {
  const trigger = (event.target as Element | null)?.closest('[data-slot="dialog-trigger"]')
  const dialog = document.getElementById(trigger?.getAttribute('commandfor') ?? '')

  if (!trigger || !isDialog(dialog)) return
  event.preventDefault()
  show(dialog, trigger)
})

document.addEventListener('submit', (event) => {
  const form = event.target
  const dialog = form instanceof HTMLFormElement && form.method === 'dialog' ? form.closest('dialog') : null

  if (!isDialog(dialog)) return
  event.preventDefault()
  void hide(dialog, 'close-press')
})

document.addEventListener(
  'cancel',
  (event) => {
    const dialog = event.target

    if (!isDialog(dialog)) return

    if (event.cancelable) {
      event.preventDefault()
      void hide(dialog, 'escape-key')

      return
    }

    if (dialog.hasAttribute('data-open'))
      emit(dialog, 'openchange', { open: false, reason: 'escape-key', trigger: null }, false)
    mark(dialog, false)
  },
  true,
)

document.addEventListener(
  'close',
  (event) => {
    const dialog = event.target

    if (!isDialog(dialog)) return

    if (dialog.hasAttribute('data-open'))
      emit(dialog, 'openchange', { open: false, reason: 'none', trigger: null }, false)
    mark(dialog, false)
    rest(dialog)
  },
  true,
)
