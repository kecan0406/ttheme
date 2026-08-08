import { type Hex, rgb } from '../color.ts'
import type { Theme } from '../theme.ts'
import type { Emitter, Output } from './index.ts'

function color(key: string, hex: Hex): string {
  const [r, g, b] = rgb(hex)
  const real = (c: number) => (c / 255).toFixed(4)
  return [
    `\t<key>${key}</key>`,
    '\t<dict>',
    '\t\t<key>Alpha Component</key>',
    '\t\t<real>1</real>',
    '\t\t<key>Blue Component</key>',
    `\t\t<real>${real(b)}</real>`,
    '\t\t<key>Color Space</key>',
    '\t\t<string>sRGB</string>',
    '\t\t<key>Green Component</key>',
    `\t\t<real>${real(g)}</real>`,
    '\t\t<key>Red Component</key>',
    `\t\t<real>${real(r)}</real>`,
    '\t</dict>',
  ].join('\n')
}

export const iterm2: Emitter = {
  id: 'iterm2',
  limits: 'colors only — font lives in the profile; ignores OSC 12, so the cursor keeps its profile color at runtime',

  emit(theme: Theme): Output[] {
    const entries = [
      ...theme.ansi.map((c, i) => color(`Ansi ${i} Color`, c)),
      color('Background Color', theme.background),
      color('Bold Color', theme.foreground),
      color('Cursor Color', theme.cursor),
      color('Cursor Text Color', theme.background),
      color('Foreground Color', theme.foreground),
      color('Selected Text Color', theme.foreground),
      color('Selection Color', theme.selectionBackground),
    ]

    const content = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      ...entries,
      '</dict>',
      '</plist>',
      '',
    ].join('\n')

    return [{ path: `iterm2/${theme.name}.itermcolors`, content }]
  },
}
