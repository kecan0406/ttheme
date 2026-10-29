import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readAnchors } from './anchors.ts'

test('readAnchors keeps the slots in the order the file names them, colors lowercased', () => {
  const { anchors, problems } = readAnchors({
    bocchi: {
      slots: { cursor: ['hair', '#F5B2C6'], ansi4: ['eyes', '#6d9ad8'], ansi9: ['track jacket', '#f2a0bc'] },
      booru: 'gotoh_hitori',
      native_names: ['後藤ひとり'],
      source: 'https://example.com/bocchi.png',
    },
  })

  assert.deepEqual(problems, [])
  assert.deepEqual(anchors, [
    {
      name: 'bocchi',
      slots: [
        ['cursor', { part: 'hair', hex: '#f5b2c6' }],
        ['ansi4', { part: 'eyes', hex: '#6d9ad8' }],
        ['ansi9', { part: 'track jacket', hex: '#f2a0bc' }],
      ],
      booru: 'gotoh_hitori',
      nativeNames: ['後藤ひとり'],
      source: 'https://example.com/bocchi.png',
    },
  ])
})

test('readAnchors names every field it refuses by its path and reads none of that entry', () => {
  const { anchors, problems } = readAnchors({
    Bocchi: {
      slots: { foreground: ['hair', '#f5b2c'], ansi44: ['eyes', '#6d9ad8'] },
      booru: 'gotoh hitori',
      native_names: ['後藤|ひとり'],
      colour: 'pink',
    },
    kita: { slots: { cursor: ['', '#e0603a'], ansi3: ['eyes', '#d9b25a'], selection: 'uniform' } },
  })

  assert.deepEqual(anchors, [])
  assert.deepEqual(
    problems.map((p) => p.path),
    [
      'Bocchi',
      'Bocchi.colour',
      'Bocchi.slots',
      'Bocchi.slots.foreground[1]',
      'Bocchi.slots.ansi44',
      'Bocchi.booru',
      'Bocchi.native_names[0]',
      'kita.slots.cursor[0]',
      'kita.slots.selection',
    ],
  )
})

test('readAnchors reads a palette named like an object property as that palette, and refuses __proto__', () => {
  const slots = { cursor: ['hair', '#e0603a'], ansi3: ['eyes', '#d9b25a'], selection: ['uniform', '#3a3f6a'] }

  const { anchors, problems } = readAnchors(
    JSON.parse(
      `{"constructor": {"slots": ${JSON.stringify(slots)}}, "__proto__": {"slots": ${JSON.stringify(slots)}}}`,
    ),
  )

  assert.deepEqual(
    anchors.map((a) => [a.name, a.slots.length]),
    [['constructor', 3]],
  )
  assert.deepEqual(
    problems.map((p) => p.path),
    ['__proto__'],
  )
})

test('readAnchors refuses a file that is not an object of palettes', () => {
  for (const doc of [[], {}, 'bocchi', null]) {
    assert.deepEqual(readAnchors(doc).problems, [{ path: '', problem: 'must map each palette name to its anchors' }])
  }
})
