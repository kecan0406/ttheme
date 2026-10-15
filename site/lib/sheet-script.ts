import type { GateRule, Theme } from '@/lib/themes'
import { WEAR_KEY } from '@/lib/wear'

export const SHEET_AT = 'sheet-at'

export function sheetScript(themes: Theme[], gate: GateRule[]): string {
  const names = JSON.stringify(themes.map((theme) => theme.name))
  const floors = JSON.stringify(gate.map(({ min, max }) => [min ?? null, max ?? null]))

  return `(function(){try{var w=JSON.parse(localStorage.getItem('${WEAR_KEY}')),t=w&&w.t,i=t?${names}.indexOf(t.name):-1,s=document.documentElement.style,f=${floors},z=t&&t.signatureSlots||[],p=0,j,k,v,c,e;if(i<1)return;function q(n,x){s.setProperty(n,x)}q('--sheet-number',JSON.stringify(String(i+1).padStart(3,'0')));q('--sheet-lead',JSON.stringify(t.lead?' · lead':''));q('--sheet-ansi',JSON.stringify(t.ansiSource||''));q('--sheet-slots',JSON.stringify(z.join(' ')));q('--sheet-cursor',JSON.stringify(t.cursor||''));for(j=0;j<f.length;j++){v=t.gate&&t.gate[j];if(typeof v==='number'&&(f[j][0]!==null?v>=f[j][0]:f[j][1]===null||v<=f[j][1]))p++}q('--sheet-floors',JSON.stringify(p+' / '+f.length+' floors'));q('--sheet-tone',p===f.length?'var(--success)':'var(--warning)');for(j=0;j<3&&j<z.length;j++){k=z[j];c=k==='selection';q('--sheet-mark'+j,JSON.stringify(c?' sel ':'●'));q('--sheet-ground'+j,c?'var(--se)':'transparent');q('--sheet-ink'+j,c?'var(--fg)':'var(--'+({background:'bg',foreground:'fg',cursor:'cu'}[k]||'a'+k.slice(4))+')')}e=document.createElement('style');e.id='${SHEET_AT}';e.textContent='[data-sheet][aria-current]:not([data-sheet="'+i+'"]){outline:none;scroll-initial-target:none}[data-sheet="'+i+'"]{outline:2px solid var(--ring);scroll-initial-target:nearest}';document.head.appendChild(e)}catch(x){}})()`
}
