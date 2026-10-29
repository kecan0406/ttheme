import { RUNNER_KEY } from '@/lib/runner'
import { respeculate } from './speculation'

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

  for (const cell of document.querySelectorAll<HTMLElement>('[data-runner-to]'))
    cell.setAttribute('aria-pressed', String(cell.dataset.runnerTo === shown))
}

document.addEventListener('click', (event) => {
  const runner =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-runner-to]')?.dataset.runnerTo
      : undefined

  if (!runner) return
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
