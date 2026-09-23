import type { Theme } from '../theme.ts'
import type { Emitter, Output } from './index.ts'

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white']

export function wtScheme(theme: Theme): Record<string, string> {
  return {
    name: theme.name,
    background: theme.background,
    foreground: theme.foreground,
    cursorColor: theme.cursor,
    selectionBackground: theme.selectionBackground,
    ...Object.fromEntries(NAMES.map((name, i) => [name, theme.ansi[i] as string])),
    ...Object.fromEntries(
      NAMES.map((name, i) => [`bright${name[0]?.toUpperCase()}${name.slice(1)}`, theme.ansi[i + 8] as string]),
    ),
  }
}

export function wtFragment(themes: Theme[], profile?: string, startup?: string): string {
  const doc = {
    ...(profile && startup ? { profiles: [{ updates: profile, colorScheme: startup }] } : {}),
    schemes: themes.map(wtScheme),
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

export const windowsTerminal: Emitter = {
  id: 'windows-terminal',
  limits: 'colors only — no kitty graphics, so no pictures; OSC repaints per pane',

  emit(theme: Theme): Output[] {
    return [
      { path: `windows-terminal/schemes/${theme.name}.json`, content: `${JSON.stringify(wtScheme(theme), null, 2)}\n` },
    ]
  },

  emitShared(themes: Theme[]): Output[] {
    return [{ path: 'windows-terminal/ttheme.json', content: wtFragment(themes) }]
  },
}
