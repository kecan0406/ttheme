import type { Point } from '@/lib/facets'
import { luminance } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'

export const WEAR_KEY = 'ttheme-site-wear'

export const WEAR_EVENT = 'ttheme:wear'

export const SHOW_EVENT = 'ttheme:show'

export const WEAR_SCRIPT = `try{var w=JSON.parse(localStorage.getItem('${WEAR_KEY}'));if(w&&w.v){var s=document.documentElement.style;for(var i=0;i<w.v.length;i++)if(w.v[i][0].indexOf('--')===0)s.setProperty(w.v[i][0],w.v[i][1]);s.colorScheme=w.l?'light':'dark'}}catch(e){}`

export const SLOTS = ['--bg', '--fg', '--cu', '--se', ...Array.from({ length: 16 }, (_, index) => `--a${index}`)]

export const SIGNS = ['--wear-name', '--sg0', '--sg1', '--sg2']

export type Vars = [string, string][]

export type Shown = { vars: Vars; origin: Point | null; instant: boolean }

function named(names: string[], values: string[]): Vars {
  return values.map((value, index): [string, string] => [names[index] as string, value])
}

export function wearSlots(theme: Theme): Vars {
  return named(SLOTS, [theme.background, theme.foreground, theme.cursor, theme.selectionBackground, ...theme.ansi])
}

export function wearSigns(theme: Theme): Vars {
  return named(SIGNS, [JSON.stringify(theme.name), ...theme.signature.slice(0, 3)])
}

export function wearVars(theme: Theme): Vars {
  return [...wearSlots(theme), ...wearSigns(theme)]
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
