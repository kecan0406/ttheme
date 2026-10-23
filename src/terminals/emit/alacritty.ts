import { modeOf } from '../../core/mode.ts'
import type { Theme } from '../../core/theme.ts'
import { inOther, owned } from '../../core/theme.ts'
import { banner, type Emitter, type Output } from './types.ts'

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

function block(header: string, colors: readonly string[]): string {
  return [header, ...NAMES.map((name, i) => `${name} = '${colors[i]}'`), ''].join('\n')
}

export const alacritty: Emitter = {
  id: 'alacritty',
  limits: 'no runtime color API (OSC only)',

  emit(theme: Theme): Output[] {
    return [theme, ...inOther(theme)].map((shade) => ({
      path: `alacritty/themes/${owned(theme.name)}.${modeOf(shade)}.toml`,
      content: [
        ...banner(shade),
        '',
        '[colors.primary]',
        `background = '${shade.background}'`,
        `foreground = '${shade.foreground}'`,
        '',
        '[colors.cursor]',
        `cursor = '${shade.cursor}'`,
        `text = '${shade.background}'`,
        '',
        '[colors.selection]',
        `background = '${shade.selectionBackground}'`,
        `text = '${shade.foreground}'`,
        '',
        block('[colors.normal]', shade.ansi.slice(0, 8)),
        block('[colors.bright]', shade.ansi.slice(8, 16)),
      ].join('\n'),
    }))
  },
}
