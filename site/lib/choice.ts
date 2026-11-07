import { json } from '@/lib/render'
import { RUNNERS } from '../../src/core/runner.ts'
import { SHELLS } from '../../src/core/shell.ts'

export const CHOICES = {
  runner: { key: 'ttheme-site-runner', values: RUNNERS },
  shell: { key: 'ttheme-site-shell', values: SHELLS },
} as const

export type Choice = keyof typeof CHOICES

const PICKS = Object.entries(CHOICES).map(([name, { key, values }]) => [name, key, values])

export const CHOICE_SCRIPT = `(function(){try{var d=document.documentElement.dataset,c=${json(PICKS)},i,v;for(i=0;i<c.length;i++){v=localStorage.getItem(c[i][1]);if(c[i][2].indexOf(v)>0)d[c[i][0]]=v}}catch(e){}})()`
