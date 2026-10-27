export type Mode = 'dark' | 'light'

export type Setting = Mode | 'auto'

export const MODE_KEY = 'ttheme-site-mode'

export const MODE_EVENT = 'ttheme:mode'

export function settingOf(value: string | null): Setting {
  return value === 'dark' || value === 'light' ? value : 'auto'
}

export function nextOf(setting: Setting, systemLight: boolean): Setting {
  const system = modeFor('auto', systemLight)

  if (setting === 'auto') return otherOf(system)

  return setting === system ? 'auto' : system
}

export function modeFor(setting: Setting, systemLight: boolean): Mode {
  if (setting === 'auto') return systemLight ? 'light' : 'dark'

  return setting
}

export function otherOf(mode: Mode): Mode {
  return mode === 'dark' ? 'light' : 'dark'
}
