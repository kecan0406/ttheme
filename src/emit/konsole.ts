import { type Hex, mix, rgb } from '../color.ts'
import type { Theme } from '../theme.ts'
import { owned } from '../theme.ts'
import type { ProfileBackground } from './iterm2.ts'
import { banner, type Emitter, type Output } from './types.ts'

function entry(group: string, color: string): string[] {
  return [`[${group}]`, `Color=${rgb(color as Hex).join(',')}`, '']
}

export interface SchemeColors {
  background: string
  foreground: string
  ansi: readonly string[]
}

export function schemeLines(
  colors: SchemeColors,
  description: string,
  general: readonly string[] = ['Wallpaper='],
): string[] {
  const faint = (color: string) => mix(color as Hex, colors.background as Hex, 0.5)
  return [
    ...entry('Background', colors.background),
    ...entry('BackgroundFaint', colors.background),
    ...entry('BackgroundIntense', colors.background),
    ...colors.ansi
      .slice(0, 8)
      .flatMap((color, i) => [
        ...entry(`Color${i}`, color),
        ...entry(`Color${i}Faint`, faint(color)),
        ...entry(`Color${i}Intense`, colors.ansi[i + 8] as string),
      ]),
    ...entry('Foreground', colors.foreground),
    ...entry('ForegroundFaint', faint(colors.foreground)),
    ...entry('ForegroundIntense', colors.foreground),
    '[General]',
    'Blur=false',
    'ColorRandomization=false',
    `Description=${description}`,
    'Opacity=1',
    ...general,
    '',
  ]
}

const ANCHOR: Readonly<Record<string, string>> = { left: '0', top: '0', center: '0.5', right: '1', bottom: '1' }

function wallpaperLines(picture: ProfileBackground | undefined): string[] {
  if (!picture || picture.opacity <= 0) {
    return ['Wallpaper=']
  }
  const [y = 'center', x = 'center'] = picture.position.split('-')
  return [
    `Wallpaper=${picture.image}`,
    `FillStyle=${picture.cover ? 'Crop' : 'Adapt'}`,
    `Anchor=${ANCHOR[x] ?? '0.5'},${ANCHOR[y] ?? '0.5'}`,
    `WallpaperOpacity=${picture.opacity}`,
  ]
}

export function konsoleScheme(theme: Theme, picture?: ProfileBackground): string {
  return [...banner(theme), '', ...schemeLines(theme, `ttheme · ${theme.name}`, wallpaperLines(picture))].join('\n')
}

export const konsole: Emitter = {
  id: 'konsole',
  limits: 'draws no OSC 4, so a tab repaints by switching color scheme',

  emit(theme: Theme): Output[] {
    return [{ path: `konsole/${owned(theme.name)}.colorscheme`, content: konsoleScheme(theme) }]
  },
}
