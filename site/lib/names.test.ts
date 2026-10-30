import { expect, test } from 'bun:test'
import { answerOf, plainAnswer } from '@/lib/names'
import type { Work } from '../../src/core/commons.ts'
import type { NameHit } from '../../src/core/names.ts'

const works: Work[] = [
  {
    id: 'moonlit-harbor',
    name: 'Moonlit Harbor',
    danbooru: 'moonlit_harbor',
    characters: [{ id: 'nell', danbooru: 'nell_(moonlit_harbor)' }],
  },
  { id: 'tidewater', name: 'Tidewater', danbooru: 'tidewater', characters: [] },
]

function hit(kind: NameHit['kind'], label: string, tags: string[]): NameHit {
  return { id: `${kind}/${label}`, kind, label, names: [], tags, works: [] }
}

test('an answer keeps the works that have palettes and says what a character was read as', () => {
  const hits = [hit('character', 'ネル', ['nell_(moonlit_harbor)']), hit('work', 'Tidewater', ['tidewater'])]

  expect(answerOf('넬', hits, works, new Set(['moonlit-harbor']))).toEqual({
    works: [{ id: 'moonlit-harbor', read: 'ネル' }],
    label: 'ネル',
    asked: 'ネル',
    name: 'nell',
  })
})

test('a name no index knows is asked for and made as it was typed', () => {
  expect(plainAnswer('Glass Orchard')).toEqual({
    works: [],
    label: 'Glass Orchard',
    asked: 'Glass Orchard',
    name: 'glass-orchard',
  })
})
