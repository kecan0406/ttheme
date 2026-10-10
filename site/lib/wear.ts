import { luminance } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'

export const SETTLE_MS = 450

export const WEAR_KEY = 'ttheme-site-wear'

export const WEAR_EVENT = 'ttheme:wear'

export const SHOW_EVENT = 'ttheme:show'

export const WEAR_SCRIPT = `try{var w=JSON.parse(localStorage.getItem('${WEAR_KEY}'));if(w&&w.v){var s=document.documentElement.style;for(var i=0;i<w.v.length;i++)if(w.v[i][0].indexOf('--')===0)s.setProperty(w.v[i][0],w.v[i][1]);s.colorScheme=w.l?'light':'dark'}}catch(e){}`

export function wearSlots(theme: Theme): [string, string][] {
  return [
    ['--bg', theme.background],
    ['--fg', theme.foreground],
    ['--cu', theme.cursor],
    ['--se', theme.selectionBackground],
    ...theme.ansi.map((color, index): [string, string] => [`--a${index}`, color]),
  ]
}

export function wearVars(theme: Theme): [string, string][] {
  return [
    ...wearSlots(theme),
    ['--wear-name', JSON.stringify(theme.name)],
    ...theme.signature.slice(0, 3).map((color, index): [string, string] => [`--sg${index}`, color]),
  ]
}

export function wearStyle(theme: Theme): string {
  return wearSlots(theme)
    .map(([slot, color]) => `${slot}:${color}`)
    .join(';')
}

export function rootStyle(theme: Theme): string {
  const vars = wearVars(theme)
    .map(([slot, value]) => `${slot}:${value}`)
    .join(';')
  return `${vars};color-scheme:${isLight(theme) ? 'light' : 'dark'}`
}

export function isLight(theme: Theme): boolean {
  return luminance(theme.background) > 0.3
}
