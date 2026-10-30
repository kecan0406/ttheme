import { RUNNER_KEY } from '@/lib/runner'
import { respeculate } from './speculation'
import { pressIn } from './ui/pressed'

const root = document.documentElement

function stored(): string | null {
  try {
    return localStorage.getItem(RUNNER_KEY)
  } catch {
    return null
  }
}

function show(runner: string | null) {
  const shown = runner === 'bunx' ? runner : 'npx'

  if (shown === 'bunx') root.dataset.runner = shown
  else delete root.dataset.runner

  for (const group of document.querySelectorAll('[data-runners]')) pressIn(group, shown)
}

document.addEventListener('valuechange', (event) => {
  if (!(event.target instanceof Element) || !event.target.matches('[data-runners]')) return
  const runner = event.detail.value
  show(runner)

  try {
    if (runner === 'bunx') localStorage.setItem(RUNNER_KEY, runner)
    else localStorage.removeItem(RUNNER_KEY)
  } catch {}

  respeculate()
})

window.addEventListener('storage', (event) => {
  if (event.key === RUNNER_KEY || event.key === null) show(stored())
})

window.addEventListener('pageshow', () => show(stored()))

show(stored())
