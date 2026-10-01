import { createHash } from 'node:crypto'
import { luminance } from '../color.ts'
import type { Theme } from '../theme.ts'
import { owned } from '../theme.ts'
import type { Emitter, Output } from './types.ts'

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

export interface WarpPicture {
  image: string
  opacity: number
}

function block(header: string, colors: readonly string[]): string[] {
  return [`  ${header}:`, ...NAMES.map((name, i) => `    ${name}: "${colors[i]}"`)]
}

function hashed(name: string, parts: string[], extension: string): string {
  const hash = createHash('sha1')
  for (const part of parts) {
    hash.update(part)
  }
  return `${owned(name)}.${hash.digest('hex').slice(0, 8)}.${extension}`
}

export function warpPictureFile(name: string, image: string, background: string): string {
  let hash = 0x811c9dc5
  for (const byte of Buffer.from(`${image}\n${background.toLowerCase()}`, 'utf8')) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  }
  return `${owned(name)}.${hash.toString(16).padStart(8, '0')}.png`
}

export function warpThemeFile(name: string, picture?: WarpPicture): string {
  return picture ? hashed(name, [picture.image, String(warpOpacity(picture))], 'yaml') : `${owned(name)}.yaml`
}

function warpOpacity(picture: WarpPicture): number {
  return Math.max(0, Math.min(100, Math.round(picture.opacity * 100)))
}

export type WarpLook = Pick<Theme, 'name' | 'background' | 'foreground' | 'cursor' | 'ansi'>

export function warpTheme(theme: WarpLook, picture?: WarpPicture): string {
  return [
    `name: "${theme.name}"`,
    `background: "${theme.background}"`,
    `foreground: "${theme.foreground}"`,
    `accent: "${theme.cursor}"`,
    `cursor: "${theme.cursor}"`,
    `details: ${luminance(theme.background) < 0.18 ? 'darker' : 'lighter'}`,
    ...(picture ? ['background_image:', `  path: "${picture.image}"`, `  opacity: ${warpOpacity(picture)}`] : []),
    'terminal_colors:',
    ...block('normal', theme.ansi.slice(0, 8)),
    ...block('bright', theme.ansi.slice(8, 16)),
    '',
  ].join('\n')
}

export const warp: Emitter = {
  id: 'warp',
  limits: 'no selection color, and Warp paints one theme app-wide',

  emit(theme: Theme): Output[] {
    return [{ path: `warp/themes/${warpThemeFile(theme.name)}`, content: warpTheme(theme) }]
  },
}
