import { modeOf } from '../../core/mode.ts'
import type { Theme } from '../../core/theme.ts'
import { inOther, owned } from '../../core/theme.ts'
import { banner, type Emitter, type Output } from './types.ts'

export const ghostty: Emitter = {
  id: 'ghostty',

  emit(theme: Theme): Output[] {
    const others = inOther(theme).map((shade) => ({
      ...shade,
      ghostty: { iconGhost: shade.cursor, iconScreen: [shade.cursor, shade.selectionBackground, shade.background] },
    }))

    return [theme, ...others].map((shade) => ({
      path: `ghostty/themes/${owned(theme.name)}.${modeOf(shade)}`,
      content: colors(shade),
    }))
  },
}

function colors(theme: Theme): string {
  return [
    ...banner(theme),
    `background = ${theme.background}`,
    `foreground = ${theme.foreground}`,
    `cursor-color = ${theme.cursor}`,
    `selection-background = ${theme.selectionBackground}`,
    `selection-foreground = ${theme.foreground}`,
    ...theme.ansi.map((c, i) => `palette = ${i}=${c}`),
    '',
    'macos-icon = custom-style',
    `macos-icon-ghost-color = ${theme.ghostty.iconGhost}`,
    `macos-icon-screen-color = ${theme.ghostty.iconScreen.join(',')}`,
    'macos-icon-frame = chrome',
    '',
  ].join('\n')
}
