import { expect, test } from 'bun:test'
import type { Shade, Theme } from '@/lib/themes'
import { leadScript, WEAR_KEY } from '@/lib/wear'

function shade(background: string, foreground: string): Shade {
  return {
    background,
    foreground,
    cursor: foreground,
    selectionBackground: background,
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [1, 2, 3],
  }
}

function theme(name: string): Theme {
  return {
    ...shade('#101010', '#f0f0f0'),
    id: `ttheme/${name}`,
    marketplace: 'ttheme',
    name,
    subject: null,
    work: null,
    also: [],
    character: null,
    from: null,
    mode: 'dark',
    other: shade('#f0f0f0', '#101010'),
  }
}

function landing(stored: string | null) {
  const attributes = new Map([
    ['data-mode', 'dark'],
    ['data-picked', ''],
  ])

  const style = new Map([['--palette-name', JSON.stringify(stored)]])

  const html = {
    style: { setProperty: (name: string, value: string) => style.set(name, value), colorScheme: '' },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    removeAttribute: (name: string) => attributes.delete(name),
  }

  const document = { documentElement: html, querySelector: () => null }

  const localStorage = {
    getItem: (key: string) => (key === WEAR_KEY && stored ? JSON.stringify({ t: { name: stored } }) : null),
  }

  new Function('document', 'localStorage', leadScript([theme('lead-one'), theme('lead-two')]))(document, localStorage)

  return { picked: attributes.has('data-picked'), name: style.get('--palette-name') }
}

test('the landing opens on its lead over a stored pick from outside the cast', () => {
  expect(landing('elsewhere')).toEqual({ picked: false, name: JSON.stringify('lead-one') })
})

test('the landing keeps a stored pick from its cast', () => {
  expect(landing('lead-two')).toEqual({ picked: true, name: JSON.stringify('lead-two') })
})
