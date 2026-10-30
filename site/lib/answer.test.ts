import { expect, test } from 'bun:test'
import { answerOf } from '@/lib/answer'
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

function asked(request: string): string | null {
  return new URL(request).searchParams.get('character')
}

test('an answer keeps the works that have palettes and says what a character was read as', () => {
  const hits = [hit('character', 'ネル', ['nell_(moonlit_harbor)']), hit('work', 'Tidewater', ['tidewater'])]
  const answer = answerOf('넬', hits, works, new Set(['moonlit-harbor']))

  expect(answer.works).toEqual([{ id: 'moonlit-harbor', read: 'ネル', by: 'character', characters: ['nell'] }])
  expect([answer.label, asked(answer.request), answer.name]).toEqual(['ネル', 'ネル', 'nell'])
})

test('a name no index knows is asked for and made as it was typed', () => {
  const answer = answerOf('Glass Orchard', [], works, new Set())

  expect(answer.works).toEqual([])
  expect([answer.label, asked(answer.request), answer.name]).toEqual([
    'Glass Orchard',
    'Glass Orchard',
    'glass-orchard',
  ])
})
