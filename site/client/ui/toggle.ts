import { bare } from '../keys'
import { emit } from './change'
import { press, pressIn } from './pressed'
import { stepTo } from './roving'

function toggleOf(target: EventTarget | null): HTMLElement | null {
  return (target as Element | null)?.closest<HTMLElement>('[data-slot="toggle"]') ?? null
}

document.addEventListener('click', (event) => {
  const toggle = toggleOf(event.target)

  if (!toggle || toggle.matches(':disabled')) return
  const group = toggle.closest('[data-slot="toggle-group"]')

  if (!group) {
    const pressed = !toggle.hasAttribute('data-pressed')

    if (emit(toggle, 'pressedchange', { pressed, reason: 'none', trigger: toggle }, true)) press(toggle, pressed)

    return
  }

  if (toggle.hasAttribute('data-pressed')) return
  const value = toggle.dataset.value ?? ''

  if (emit(group, 'valuechange', { value, reason: 'none', trigger: toggle }, true)) pressIn(group, value)
})

document.addEventListener('keydown', (event) => {
  const toggle = toggleOf(event.target)
  const group = toggle?.closest('[data-slot="toggle-group"]')

  if (!toggle || !group || !bare(event)) return
  const next = stepTo(event.key, [...group.querySelectorAll<HTMLElement>('[data-slot="toggle"]')], toggle)

  if (!next) return
  event.preventDefault()
  next.focus()
})
