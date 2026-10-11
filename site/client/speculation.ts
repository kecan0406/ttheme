import { WEAR_KEY } from '@/lib/wear'

export function respeculate() {
  const rules = document.querySelector('script[type="speculationrules"]')
  if (!rules) return
  const fresh = document.createElement('script')
  fresh.type = 'speculationrules'
  fresh.textContent = rules.textContent
  rules.remove()
  setTimeout(() => document.head.append(fresh))
}

window.addEventListener('storage', (event) => {
  if (event.key === WEAR_KEY) respeculate()
})
