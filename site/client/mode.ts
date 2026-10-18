import { MODE_KEY, type Mode, modeFor, type Setting, settingOf } from '@/lib/mode'

const system = matchMedia('(prefers-color-scheme: light)')

export function setting(): Setting {
  try {
    return settingOf(localStorage.getItem(MODE_KEY))
  } catch {
    return 'dark'
  }
}

export function mode(): Mode {
  return modeFor(setting(), system.matches)
}

export function store(next: Setting) {
  document.documentElement.dataset.setting = next

  try {
    localStorage.setItem(MODE_KEY, next)
  } catch {}
}

export function watch(listener: () => void) {
  system.addEventListener('change', listener)
  window.addEventListener('storage', (event) => {
    if (event.key === MODE_KEY) listener()
  })
}
