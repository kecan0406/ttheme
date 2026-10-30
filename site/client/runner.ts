import { RUNNER_KEY } from '@/lib/runner'
import { respeculate } from './speculation'
import { handOver } from './tip'

const root = document.documentElement

function stored(): string | null {
  try {
    return localStorage.getItem(RUNNER_KEY)
  } catch {
    return null
  }
}

function show(runner: string | null) {
  if (runner === 'bunx') root.dataset.runner = runner
  else delete root.dataset.runner
}

document.addEventListener('click', (event) => {
  const cell = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-runner-to]') : null
  const runner = cell?.dataset.runnerTo

  if (!cell || !runner) return
  const was = root.dataset.runner === 'bunx' ? 'bunx' : 'npx'
  const focused = document.activeElement === cell
  show(runner)
  const next = cell.parentElement?.querySelector<HTMLElement>(`[data-runner-to="${was}"]`)

  if (next) {
    if (focused) next.focus()
    handOver(cell, next)
  }

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
