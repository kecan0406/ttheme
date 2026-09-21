import { type Hex, rgb } from '../color.ts'
import type { Theme } from '../theme.ts'
import type { Emitter, Output } from './index.ts'

export interface ItermColor {
  'Alpha Component': number
  'Blue Component': number
  'Color Space': 'P3'
  'Green Component': number
  'Red Component': number
}

function color(hex: Hex): ItermColor {
  const [r, g, b] = rgb(hex)
  return {
    'Alpha Component': 1,
    'Blue Component': b / 255,
    'Color Space': 'P3',
    'Green Component': g / 255,
    'Red Component': r / 255,
  }
}

export function itermColors(theme: Theme): Record<string, ItermColor> {
  return {
    ...Object.fromEntries(theme.ansi.map((c, i) => [`Ansi ${i} Color`, color(c)])),
    'Background Color': color(theme.background),
    'Bold Color': color(theme.foreground),
    'Cursor Color': color(theme.cursor),
    'Cursor Text Color': color(theme.background),
    'Foreground Color': color(theme.foreground),
    'Selected Text Color': color(theme.foreground),
    'Selection Color': color(theme.selectionBackground),
  }
}

export function itermProfiles(themes: Theme[]): string {
  const profiles = themes.map((theme) => ({
    Name: `ttheme · ${theme.name}`,
    Guid: `ttheme-${theme.name}`,
    'Use Separate Colors for Light and Dark Mode': false,
    'Harmonize 256 Colors': true,
    ...itermColors(theme),
  }))
  return `${JSON.stringify({ Profiles: profiles }, null, 2)}\n`
}

function plistColor(key: string, c: ItermColor): string {
  return [
    `\t<key>${key}</key>`,
    '\t<dict>',
    ...Object.entries(c).flatMap(([k, v]) => [
      `\t\t<key>${k}</key>`,
      typeof v === 'string' ? `\t\t<string>${v}</string>` : `\t\t<real>${v}</real>`,
    ]),
    '\t</dict>',
  ].join('\n')
}

export const iterm2: Emitter = {
  id: 'iterm2',
  limits: 'colors only — font lives in the profile; colors are Display P3, the space iTerm2 reads OSC colors in',

  emit(theme: Theme): Output[] {
    const content = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      ...Object.entries(itermColors(theme)).map(([key, c]) => plistColor(key, c)),
      '</dict>',
      '</plist>',
      '',
    ].join('\n')

    return [{ path: `iterm2/${theme.name}.itermcolors`, content }]
  },
}
