import { MODE_KEY } from '@/lib/mode'
import { RUNNER_KEY } from '@/lib/runner'
import { WEAR_KEY } from '@/lib/wear'

function replace() {
  const rules = document.querySelector('script[type="speculationrules"]')

  if (!rules) return
  const fresh = document.createElement('script')
  fresh.type = 'speculationrules'
  fresh.textContent = rules.textContent
  rules.remove()
  setTimeout(() => document.head.append(fresh))
}

export function respeculate() {
  setTimeout(replace)
}

window.addEventListener('storage', (event) => {
  if (event.key === WEAR_KEY || event.key === MODE_KEY || event.key === RUNNER_KEY) respeculate()
})
