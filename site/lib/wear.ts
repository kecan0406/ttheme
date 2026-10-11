import type { Point } from '@/lib/facets'
import { luminance } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'

export const WEAR_KEY = 'ttheme-site-wear'

export const WEAR_EVENT = 'ttheme:wear'

export const SHOW_EVENT = 'ttheme:show'

const GLYPHS = '0123456789abcdefghijklmnopqrstuvwxyz '

const ADVANCES = [
  600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 568, 620, 484, 620, 555, 402, 626, 606, 281, 287, 580, 348, 902,
  606, 602, 620, 620, 434, 496, 426, 601, 542, 868, 572, 541, 487, 286,
]

const WIDEST = 902

const TRACKING = -20

export function headlineEm(text: string): number {
  let em = 0
  for (const char of text) em += (ADVANCES[GLYPHS.indexOf(char)] ?? WIDEST) + TRACKING
  return em / 1000
}

export const WEAR_SCRIPT = `(function(){try{var w=JSON.parse(localStorage.getItem('${WEAR_KEY}')),s=document.documentElement.style,m=document.querySelector('meta[name=theme-color]'),a=[${ADVANCES.join(',')}],g='${GLYPHS}',i,e=0,k,n;if(!w||!w.v)return;for(i=0;i<w.v.length;i++)if(w.v[i][0].indexOf('--')===0){s.setProperty(w.v[i][0],w.v[i][1]);if(m&&w.v[i][0]==='--bg')m.content=w.v[i][1]}s.colorScheme=w.l?'light':'dark';n=w.t&&w.t.name;if(typeof n!=='string')return;for(i=0;i<n.length;i++){k=g.indexOf(n[i]);e+=(k<0?${WIDEST}:a[k])+(${TRACKING})}s.setProperty('--palette-name',JSON.stringify(n));s.setProperty('--palette-catalog',JSON.stringify(w.t.catalog||''));s.setProperty('--palette-em',String(e/1000))}catch(x){}})()`

export const SLOTS = ['--bg', '--fg', '--cu', '--se', ...Array.from({ length: 16 }, (_, index) => `--a${index}`)]

export const TONES = ['--sg0', '--sg1', '--sg2']

export const LABEL = '--wear-name'

export const SIGNS = [LABEL, ...TONES]

const OWN = ['--palette-name', '--palette-catalog', '--palette-em']

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

export function wearOwn(theme: Theme): Vars {
  return named(OWN, [JSON.stringify(theme.name), JSON.stringify(theme.catalog ?? ''), String(headlineEm(theme.name))])
}

export function wearStyle(theme: Theme): string {
  return wearSlots(theme)
    .map(([slot, color]) => `${slot}:${color}`)
    .join(';')
}

export function rootStyle(theme: Theme): string {
  const vars = [...wearVars(theme), ...wearOwn(theme)].map(([slot, value]) => `${slot}:${value}`).join(';')
  return `${vars};color-scheme:${isLight(theme) ? 'light' : 'dark'}`
}

export function isLight(theme: Theme): boolean {
  return luminance(theme.background) > 0.3
}
