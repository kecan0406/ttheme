import type { Point } from '@/lib/facets'
import { MODE_KEY, type Mode } from '@/lib/mode'
import { json } from '@/lib/render'
import { inMode, pair, type Shade, shades, type Theme } from '@/lib/themes'
import { marksOf, tileSvg } from '../../src/core/mark.ts'

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

export const MARKS = ['--mark0', '--mark1', '--mark2']

const TILE = json(tileSvg('{b}', '{h}', ['{0}', '{1}', '{2}']))

const ICON = `function(b,f,s){var x=parseInt(f.slice(1),16),y=parseInt(b.slice(1),16),h='#'+[16,8,0].map(function(n){return('0'+Math.round((x>>n&255)*.22+(y>>n&255)*.78).toString(16)).slice(-2)}).join('');return'data:image/svg+xml,'+encodeURIComponent(${TILE}.replace('{b}',b).replace('{h}',h).replace('{0}',s[0]).replace('{1}',s[1]).replace('{2}',s[2]))}`

const LIFT = `function(c,b,f){function q(h){var n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]}function u(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}function y(h){var r=q(h).map(u);return .2126*r[0]+.7152*r[1]+.0722*r[2]}function k(a,z){var p=y(a),t=y(z);return(Math.max(p,t)+.05)/(Math.min(p,t)+.05)}function L(h){var r=q(h).map(u),l=Math.cbrt(.4122214708*r[0]+.5363325363*r[1]+.0514459929*r[2]),m=Math.cbrt(.2119034982*r[0]+.6806995451*r[1]+.1073969566*r[2]),s=Math.cbrt(.0883024619*r[0]+.2817188376*r[1]+.6299787005*r[2]);return[.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s]}function H(v){var l=Math.pow(v[0]+.3963377774*v[1]+.2158037573*v[2],3),m=Math.pow(v[0]-.1055613458*v[1]-.0638541728*v[2],3),s=Math.pow(v[0]-.0894841775*v[1]-1.291485548*v[2],3);return'#'+[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(function(x){x=x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055;return('0'+Math.round(Math.min(1,Math.max(0,x))*255).toString(16)).slice(-2)}).join('')}var A=L(c),E=L(f),m=c,i;for(i=1;i<=20&&k(m,b)<3;i++)m=H(A.map(function(x,j){return x+(E[j]-x)*i/20}));return m}`

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

export function wearIcon(background: string, foreground: string, marks: readonly string[]): string {
  return `data:image/svg+xml,${encodeURIComponent(tileSvg(background, hairOf(foreground, background), marks))}`
}

export function themeIcon({
  background,
  foreground,
  signature,
}: Pick<Theme, 'background' | 'foreground' | 'signature'>) {
  return wearIcon(background, foreground, marksOf(background, foreground, signature))
}

export function headlineEm(text: string): number {
  let em = 0

  for (const char of text) em += (ADVANCES[GLYPHS.indexOf(char)] ?? WIDEST) + TRACKING

  return em / 1000
}

export function wearScript(fallback: Theme): string {
  const light = json(wearVars(inMode(fallback, 'light')))

  return `(function(){try{var h=document.documentElement,s=h.style,m=document.querySelector('meta[name=theme-color]'),c=document.querySelector('link[rel=icon]'),a=[${ADVANCES.join(',')}],g='${GLYPHS}',q=localStorage.getItem('${MODE_KEY}'),l=q==='light'||(q==='auto'&&matchMedia('(prefers-color-scheme: light)').matches),d=l?'light':'dark',w=JSON.parse(localStorage.getItem('${WEAR_KEY}')),v=w&&w.v&&w.v[d],i,e=0,k,n,o,B,F,L,M,K=${json(MARKS)};h.setAttribute('data-mode',d);h.setAttribute('data-setting',q==='light'||q==='auto'?q:'dark');if(!v||!v.length){if(!l)return;v=${light};w=null}for(i=0;i<v.length;i++)if(v[i][0].indexOf('--')===0){s.setProperty(v[i][0],v[i][1]);if(m&&v[i][0]==='--bg')m.content=v[i][1]}s.colorScheme=l?'light only':'dark only';n=w&&w.t&&w.t.name;if(typeof n==='string'){h.setAttribute('data-picked','');for(i=0;i<n.length;i++){k=g.indexOf(n[i]);e+=(k<0?${WIDEST}:a[k])+(${TRACKING})}s.setProperty('--palette-name',JSON.stringify(n));s.setProperty('--palette-catalog',JSON.stringify(w.t.catalog||''));s.setProperty('--palette-em',String(e/1000))}o=function(x){for(var z=0;z<v.length;z++)if(v[z][0]===x)return v[z][1]};B=o('--bg');F=o('--fg');L=${LIFT};M=[L(o('--sg0'),B,F),L(o('--sg1'),B,F),L(o('--sg2'),B,F)];for(i=0;i<3;i++)s.setProperty(K[i],M[i]);if(c)c.href=(${ICON})(B,F,M)}catch(x){}})()`
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

export function withMarks(vars: Vars): Vars {
  const value = (name: string) => vars.find(([slot]) => slot === name)?.[1] ?? ''
  const [background, foreground] = [value('--bg'), value('--fg')]
  const signature = TONES.map(value)
  const rest = vars.filter(([name]) => !MARKS.includes(name))

  if (!background || !foreground || signature.some((tone) => !tone)) return rest

  return [...rest, ...named(MARKS, marksOf(background, foreground, signature))]
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

  const vars = withMarks([...wearVars(worn), ...wearOwn(worn)])
    .map(([slot, value]) => `${slot}:${value}`)
    .join(';')

  return `${vars};color-scheme:${mode} only`
}
