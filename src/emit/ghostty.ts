import type { Theme } from '../theme.ts'
import { banner, type Emitter, type Output, owned } from './index.ts'

export const ghostty: Emitter = {
  id: 'ghostty',

  emit(theme: Theme): Output[] {
    const colors = [
      ...banner(theme),
      `background = ${theme.background}`,
      `foreground = ${theme.foreground}`,
      `cursor-color = ${theme.cursor}`,
      `selection-background = ${theme.selectionBackground}`,
      `selection-foreground = ${theme.foreground}`,
      ...theme.ansi.map((c, i) => `palette = ${i}=${c}`),
      'palette-generate = true',
      '',
      'macos-icon = custom-style',
      `macos-icon-ghost-color = ${theme.ghostty.iconGhost}`,
      `macos-icon-screen-color = ${theme.ghostty.iconScreen.join(',')}`,
      'macos-icon-frame = chrome',
      '',
    ].join('\n')

    return [{ path: `ghostty/themes/${owned(theme.name)}`, content: colors }]
  },
}
