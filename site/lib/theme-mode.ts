export const THEME_KEY = 'ttheme-site-theme'

export type ThemeMode = 'system' | 'light' | 'dark'

export function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function applyMode(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const still = document.createElement('style')
  still.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.appendChild(still)
  document.documentElement.classList.toggle('dark', dark)
  window.getComputedStyle(document.body).color
  window.setTimeout(() => still.remove(), 1)
  try {
    if (mode === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, mode)
  } catch {}
}
