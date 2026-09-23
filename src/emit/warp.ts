import { luminance } from '../color.ts'
import type { Theme } from '../theme.ts'
import type { Emitter, Output } from './index.ts'

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

function block(header: string, colors: readonly string[]): string[] {
  return [`  ${header}:`, ...NAMES.map((name, i) => `    ${name}: "${colors[i]}"`)]
}

export const warp: Emitter = {
  id: 'warp',
  limits: 'colors only — no selection color, and Warp paints one theme app-wide',

  emit(theme: Theme): Output[] {
    const content = [
      `name: "${theme.name}"`,
      `background: "${theme.background}"`,
      `foreground: "${theme.foreground}"`,
      `accent: "${theme.cursor}"`,
      `cursor: "${theme.cursor}"`,
      `details: ${luminance(theme.background) < 0.18 ? 'darker' : 'lighter'}`,
      'terminal_colors:',
      ...block('normal', theme.ansi.slice(0, 8)),
      ...block('bright', theme.ansi.slice(8, 16)),
      '',
    ].join('\n')
    return [{ path: `warp/themes/ttheme-${theme.name}.yaml`, content }]
  },
}
