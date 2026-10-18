import type { Point } from '@/lib/facets'
import { MODE_KEY, type Mode } from '@/lib/mode'
import { inMode, pair, type Shade, shades, type Theme } from '@/lib/themes'

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

export function wearScript(fallback: Theme): string {
  const light = JSON.stringify(wearVars(inMode(fallback, 'light')))

  return `(function(){try{var h=document.documentElement,s=h.style,m=document.querySelector('meta[name=theme-color]'),c=document.querySelector('link[rel=icon]'),a=[${ADVANCES.join(',')}],g='${GLYPHS}',q=localStorage.getItem('${MODE_KEY}'),l=q==='light'||(q==='auto'&&matchMedia('(prefers-color-scheme: light)').matches),d=l?'light':'dark',w=JSON.parse(localStorage.getItem('${WEAR_KEY}')),v=w&&w.v&&w.v[d],i,e=0,k,n,o;h.setAttribute('data-mode',d);h.setAttribute('data-setting',q==='light'||q==='auto'?q:'dark');if(!v||!v.length){if(!l)return;v=${light};w=null}for(i=0;i<v.length;i++)if(v[i][0].indexOf('--')===0){s.setProperty(v[i][0],v[i][1]);if(m&&v[i][0]==='--bg')m.content=v[i][1]}s.colorScheme=l?'light only':'dark only';n=w&&w.t&&w.t.name;if(typeof n==='string'){h.setAttribute('data-picked','');for(i=0;i<n.length;i++){k=g.indexOf(n[i]);e+=(k<0?${WIDEST}:a[k])+(${TRACKING})}s.setProperty('--palette-name',JSON.stringify(n));s.setProperty('--palette-catalog',JSON.stringify(w.t.catalog||''));s.setProperty('--palette-em',String(e/1000))}o=function(x){for(var z=0;z<v.length;z++)if(v[z][0]===x)return v[z][1]};if(c)c.href=(${ICON})(o('--bg'),o('--fg'),[o('--sg0'),o('--sg1'),o('--sg2')])}catch(x){}})()`
}

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

function slotsOf(shade: Shade): string[] {
  return [shade.background, shade.foreground, shade.cursor, shade.selectionBackground, ...shade.ansi]
}

export function wearSlots(theme: Theme): Vars {
  return named(SLOTS, slotsOf(theme))
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
  const { dark, light } = shades(theme)
  const [night, day] = [slotsOf(dark), slotsOf(light)]

  return SLOTS.map((slot, index) => `${slot}:${pair(day[index] as string, night[index] as string)}`).join(';')
}

export function rootStyle(theme: Theme, mode: Mode = 'dark'): string {
  const worn = inMode(theme, mode)
  const vars = [...wearVars(worn), ...wearOwn(worn)].map(([slot, value]) => `${slot}:${value}`).join(';')

  return `${vars};color-scheme:${mode} only`
}
