import { expect, test } from 'bun:test'
import { modeFor, nextOf, settingOf } from '@/lib/mode'
import { inMode, paint, pair, pinned, type Shade, shades, type Theme } from '@/lib/themes'

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

function theme(mode: 'dark' | 'light'): Theme {
  const made = mode === 'dark' ? shade('#101010', '#f0f0f0') : shade('#f0f0f0', '#101010')
  const other = mode === 'dark' ? shade('#f0f0f0', '#101010') : shade('#101010', '#f0f0f0')

  return {
    ...made,
    id: 'ttheme/x',
    marketplace: 'ttheme',
    name: 'x',
    subject: null,
    work: null,
    also: [],
    character: null,
    from: null,
    signatureSlots: ['cursor', 'foreground', 'ansi1'],
    mode,
    other,
  }
}

test('a palette made in the other mode is swapped for the asked one, and swaps back', () => {
  const light = theme('light')
  const dark = inMode(light, 'dark')

  expect(dark.mode).toBe('dark')
  expect(dark.background).toBe('#101010')
  expect(dark.other.background).toBe('#f0f0f0')
  expect(inMode(dark, 'light').background).toBe(light.background)
  expect(inMode(light, 'light')).toBe(light)
})

test('shades names the dark and the light colors whichever mode the palette was made in', () => {
  for (const mode of ['dark', 'light'] as const) {
    const { dark, light } = shades(theme(mode))

    expect(dark.background).toBe('#101010')
    expect(light.background).toBe('#f0f0f0')
  }
})

test('a color is a light-dark pair, and one color where both modes agree or the palette is pinned', () => {
  const made = theme('dark')

  expect(paint(made, (s) => s.background)).toBe('light-dark(#f0f0f0,#101010)')
  expect(paint(theme('light'), (s) => s.background)).toBe('light-dark(#f0f0f0,#101010)')
  expect(paint(made, (s) => s.ansi[0] as string)).toBe('#808080')
  expect(paint(pinned(made), (s) => s.background)).toBe('#101010')
  expect(pair('#fff', '#fff')).toBe('#fff')
})

test('the setting reads auto unless the visitor chose dark or light, auto follows the system, and the switch steps away from what the page shows', () => {
  expect(settingOf(null)).toBe('auto')
  expect(settingOf('sepia')).toBe('auto')
  expect(settingOf('dark')).toBe('dark')
  expect(settingOf('light')).toBe('light')
  expect(modeFor('auto', true)).toBe('light')
  expect(modeFor('auto', false)).toBe('dark')
  expect(modeFor('dark', true)).toBe('dark')
  expect(nextOf('auto', false)).toBe('light')
  expect(nextOf('light', false)).toBe('dark')
  expect(nextOf('dark', false)).toBe('auto')
  expect(nextOf('auto', true)).toBe('dark')
})
