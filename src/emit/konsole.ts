import { type Hex, mix, rgb } from '../color.ts'
import type { Theme } from '../theme.ts'
import { owned } from '../theme.ts'
import { banner, type Emitter, type Output } from './types.ts'

function entry(group: string, color: Hex): string[] {
  return [`[${group}]`, `Color=${rgb(color).join(',')}`, '']
}

export function konsoleScheme(theme: Theme): string {
  const faint = (color: Hex) => mix(color, theme.background, 0.5)
  return [
    ...banner(theme),
    '',
    ...entry('Background', theme.background),
    ...entry('BackgroundFaint', theme.background),
    ...entry('BackgroundIntense', theme.background),
    ...theme.ansi
      .slice(0, 8)
      .flatMap((color, i) => [
        ...entry(`Color${i}`, color),
        ...entry(`Color${i}Faint`, faint(color)),
        ...entry(`Color${i}Intense`, theme.ansi[i + 8] as Hex),
      ]),
    ...entry('Foreground', theme.foreground),
    ...entry('ForegroundFaint', faint(theme.foreground)),
    ...entry('ForegroundIntense', theme.foreground),
    '[General]',
    'Blur=false',
    'ColorRandomization=false',
    `Description=ttheme · ${theme.name}`,
    'Opacity=1',
    'Wallpaper=',
    '',
  ].join('\n')
}

export const konsole: Emitter = {
  id: 'konsole',
  limits: 'draws no OSC 4, so a tab repaints by switching color scheme',

  emit(theme: Theme): Output[] {
    return [{ path: `konsole/${owned(theme.name)}.colorscheme`, content: konsoleScheme(theme) }]
  },
}
