import { modeOf } from '../../core/mode.ts'
import type { Shade, Theme } from '../../core/theme.ts'
import { inOther, owned } from '../../core/theme.ts'
import { banner, type Emitter, type Output } from './types.ts'

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

export function rioColors(shade: Shade): string {
  return [
    '[colors]',
    `background = '${shade.background}'`,
    `foreground = '${shade.foreground}'`,
    `cursor = '${shade.cursor}'`,
    `selection-background = '${shade.selectionBackground}'`,
    `selection-foreground = '${shade.foreground}'`,
    ...NAMES.map((name, i) => `${name} = '${shade.ansi[i]}'`),
    ...NAMES.map((name, i) => `light-${name} = '${shade.ansi[i + 8]}'`),
    '',
  ].join('\n')
}

export function rioTheme(shade: Theme): string {
  return [...banner(shade), '', rioColors(shade)].join('\n')
}

export const rio: Emitter = {
  id: 'rio',
  limits: 'no runtime color API (OSC only)',

  emit(theme: Theme): Output[] {
    return [theme, ...inOther(theme)].map((shade) => ({
      path: `rio/themes/${owned(theme.name)}.${modeOf(shade)}.toml`,
      content: rioTheme(shade),
    }))
  },
}
