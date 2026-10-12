import { expect, test } from 'bun:test'
import { PNG } from 'pngjs'
import { faviconIco, touchIconPng } from '@/lib/tab-icon'
import type { Theme } from '@/lib/themes'

const theme: Theme = {
  id: 'kyubey',
  marketplace: null,
  name: 'kyubey',
  catalog: 'Madoka Magica',
  native: null,
  lead: false,
  ansiSource: 'test',
  background: '#fff8f7',
  foreground: '#1f1c39',
  cursor: '#b83b64',
  selectionBackground: '#edd0d9',
  signature: ['#b83b64', '#1f1c39', '#a66a01'],
  signatureSlots: ['cursor', 'foreground', 'ansi3'],
  ansi: Array.from({ length: 16 }, () => '#808080'),
  gate: [],
}

function corner(bytes: Buffer): string {
  const { data } = PNG.sync.read(bytes)
  return `#${[0, 1, 2].map((at) => (data[at] as number).toString(16).padStart(2, '0')).join('')}`
}

test('the touch icon and the favicon start on the palette background, not on half of it', () => {
  expect(corner(touchIconPng(theme))).toBe(theme.background)
  expect(corner(faviconIco(theme).subarray(22))).toBe(theme.background)
})
