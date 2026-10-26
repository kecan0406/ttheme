import { modeOf } from '../../core/mode.ts'
import type { Shade, Theme } from '../../core/theme.ts'
import { inOther, owned } from '../../core/theme.ts'
import { banner, type Emitter, type Output } from './types.ts'

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

function block(header: string, colors: readonly string[]): string[] {
  return [`${header}:`, ...NAMES.map((name, i) => `    ${name}: '${colors[i]}'`)]
}

export function contourScheme(shade: Shade): string {
  return [
    'default:',
    `    background: '${shade.background}'`,
    `    foreground: '${shade.foreground}'`,
    'cursor:',
    `    default: '${shade.cursor}'`,
    `    text: '${shade.background}'`,
    'selection:',
    `    foreground: '${shade.foreground}'`,
    `    background: '${shade.selectionBackground}'`,
    ...block('normal', shade.ansi.slice(0, 8)),
    ...block('bright', shade.ansi.slice(8, 16)),
    '',
  ].join('\n')
}

export function contourTheme(shade: Theme): string {
  return [...banner(shade), '', contourScheme(shade)].join('\n')
}

export const contour: Emitter = {
  id: 'contour',
  limits: 'reads its profile at start, so a new default reaches a running Contour through the shell (OSC)',

  emit(theme: Theme): Output[] {
    return [theme, ...inOther(theme)].map((shade) => ({
      path: `contour/colorschemes/${owned(theme.name)}.${modeOf(shade)}.yml`,
      content: contourTheme(shade),
    }))
  },
}
