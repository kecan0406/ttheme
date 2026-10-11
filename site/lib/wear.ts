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

const ICON = `function(b,f,s){var x=parseInt(f.slice(1),16),y=parseInt(b.slice(1),16),h='#'+[16,8,0].map(function(n){return('0'+Math.round((x>>n&255)*.22+(y>>n&255)*.78).toString(16)).slice(-2)}).join(''),d=[4.4,8,11.6].map(function(c,i){return"<circle cx='"+c+"' cy='8' r='1.9' fill='"+s[i]+"'/>"}).join('');return'data:image/svg+xml,'+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='.5' y='.5' width='15' height='15' rx='4' fill='"+b+"' stroke='"+h+"'/>"+d+'</svg>')}`

function hairOf(foreground: string, background: string): string {
  const ink = Number.parseInt(foreground.slice(1), 16)
  const ground = Number.parseInt(background.slice(1), 16)
  const channels = [16, 8, 0].map((shift) =>
    Math.round(((ink >> shift) & 255) * 0.22 + ((ground >> shift) & 255) * 0.78)
      .toString(16)
      .padStart(2, '0'),
  )
  return `#${channels.join('')}`
}

export function wearIcon({
  background,
  foreground,
  signature,
}: Pick<Theme, 'background' | 'foreground' | 'signature'>): string {
  const dots = [4.4, 8, 11.6]
    .map((x, index) => `<circle cx='${x}' cy='8' r='1.9' fill='${signature[index]}'/>`)
    .join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='.5' y='.5' width='15' height='15' rx='4' fill='${background}' stroke='${hairOf(foreground, background)}'/>${dots}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function headlineEm(text: string): number {
  let em = 0
  for (const char of text) em += (ADVANCES[GLYPHS.indexOf(char)] ?? WIDEST) + TRACKING
  return em / 1000
}

export const WEAR_SCRIPT = `(function(){try{var w=JSON.parse(localStorage.getItem('${WEAR_KEY}')),s=document.documentElement.style,m=document.querySelector('meta[name=theme-color]'),c=document.querySelector('link[rel=icon]'),a=[${ADVANCES.join(',')}],g='${GLYPHS}',i,e=0,k,n;if(!w||!w.v)return;for(i=0;i<w.v.length;i++)if(w.v[i][0].indexOf('--')===0){s.setProperty(w.v[i][0],w.v[i][1]);if(m&&w.v[i][0]==='--bg')m.content=w.v[i][1]}s.colorScheme=w.l?'light only':'dark only';n=w.t&&w.t.name;if(typeof n!=='string')return;document.documentElement.setAttribute('data-picked','');for(i=0;i<n.length;i++){k=g.indexOf(n[i]);e+=(k<0?${WIDEST}:a[k])+(${TRACKING})}s.setProperty('--palette-name',JSON.stringify(n));s.setProperty('--palette-catalog',JSON.stringify(w.t.catalog||''));s.setProperty('--palette-em',String(e/1000));if(c&&w.t.signature)c.href=(${ICON})(w.t.background,w.t.foreground,w.t.signature)}catch(x){}})()`

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
  return `${vars};color-scheme:${isLight(theme) ? 'light' : 'dark'} only`
}

export function isLight(theme: Theme): boolean {
  return luminance(theme.background) > 0.3
}
