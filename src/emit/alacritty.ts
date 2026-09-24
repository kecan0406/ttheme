import type { Theme } from '../theme.ts'
import { banner, type Emitter, type Output, owned } from './index.ts'

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

function block(header: string, colors: readonly string[]): string {
  return [header, ...NAMES.map((name, i) => `${name} = '${colors[i]}'`), ''].join('\n')
}

export const alacritty: Emitter = {
  id: 'alacritty',
  limits: 'no runtime color API (OSC only)',

  emit(theme: Theme): Output[] {
    const colors = [
      ...banner(theme),
      '',
      '[colors.primary]',
      `background = '${theme.background}'`,
      `foreground = '${theme.foreground}'`,
      '',
      '[colors.cursor]',
      `cursor = '${theme.cursor}'`,
      `text = '${theme.background}'`,
      '',
      '[colors.selection]',
      `background = '${theme.selectionBackground}'`,
      `text = '${theme.foreground}'`,
      '',
      block('[colors.normal]', theme.ansi.slice(0, 8)),
      block('[colors.bright]', theme.ansi.slice(8, 16)),
    ].join('\n')

    return [{ path: `alacritty/themes/${owned(theme.name)}.toml`, content: colors }]
  },
}
