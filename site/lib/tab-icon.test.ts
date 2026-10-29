import { expect, test } from 'bun:test'
import { PNG } from 'pngjs'
import { faviconIco, touchIconPng } from '@/lib/tab-icon'
import type { Theme } from '@/lib/themes'

const theme: Theme = {
  id: 'ttheme/orla',
  marketplace: 'ttheme',
  name: 'orla',
  subject: 'starfall/orla',
  work: { id: 'starfall', name: 'Starfall', native: null, lang: null, lead: 'starfall/pip' },
  also: [],
  character: { id: 'orla', native: [] },
  from: null,
  background: '#fff8f7',
  foreground: '#1f1c39',
  cursor: '#b83b64',
  selectionBackground: '#edd0d9',
  ansi: Array.from({ length: 16 }, () => '#808080'),
  gate: [],
  mode: 'light',
  other: {
    background: '#201517',
    foreground: '#e4dfff',
    cursor: '#ec638c',
    selectionBackground: '#4c383f',
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [],
  },
}

function corner(bytes: Buffer): string {
  const { data } = PNG.sync.read(bytes)

  return `#${[0, 1, 2].map((at) => (data[at] as number).toString(16).padStart(2, '0')).join('')}`
}

test('the touch icon and the favicon start on the palette background, not on half of it', () => {
  expect(corner(touchIconPng(theme))).toBe(theme.background)
  const icon = faviconIco(theme)
  const at = icon.readUInt32LE(18)
  expect(corner(icon.subarray(at, at + icon.readUInt32LE(14)))).toBe(theme.background)
})
